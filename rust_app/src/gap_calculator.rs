use crate::telemetry_fields::{TelemetryData};
use std::collections::HashMap;
use std::cell::RefCell;

const CHECKPOINT_INTERVAL: f32 = 0.05;

// checkpoint history: car_idx -> (checkpoint_idx -> time)
thread_local! {
    static CHECKPOINT_HISTORY: RefCell<HashMap<i32, HashMap<i32, f32>>> = RefCell::new(HashMap::new());
    static LAST_SESSION_TIME: RefCell<f32> = RefCell::new(0.0);
}

/// Update positions and gaps (time behind) for each car.
pub fn calculate_gaps(telemetry_data: &mut TelemetryData) {
    let lap_dist = telemetry_data.CarIdxLapDistPct.as_ref().unwrap();
    let laps_done = telemetry_data.CarIdxLapCompleted.as_ref().unwrap();
    let t = telemetry_data.SessionTime;

    // reset history on new session
    LAST_SESSION_TIME.with(|lt| {
        let mut last = lt.borrow_mut();
        if t < *last {
            CHECKPOINT_HISTORY.with(|h| h.borrow_mut().clear());
        }
        *last = t;
    });

    // init output arrays
    let n = lap_dist.len().max(64);
    telemetry_data.CarIdxPosition.get_or_insert_with(|| vec![0; n]);
    telemetry_data.CarIdxF2Time.get_or_insert_with(|| vec![0.0; n]);

    // collect total_progress + current checkpoint
    let mut car_data = Vec::with_capacity(lap_dist.len());
    for (i, &pct) in lap_dist.iter().enumerate() {
        let car = i as i32;
        let total = pct + laps_done.get(i).copied().unwrap_or(0) as f32;
        let cp = (total / CHECKPOINT_INTERVAL).floor() as i32;

        // record first time we hit this cp
        CHECKPOINT_HISTORY.with(|h| {
            let mut H = h.borrow_mut();
            let ch = H.entry(car).or_default();
            ch.entry(cp).or_insert(t);
        });

        car_data.push((car, total, cp));
    }

    // sort by progress desc
    car_data.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

    let positions = telemetry_data.CarIdxPosition.as_mut().unwrap();
    let gaps = telemetry_data.CarIdxF2Time.as_mut().unwrap();

    for (idx, &(car, _, cp)) in car_data.iter().enumerate() {
        let ci = car as usize;
        positions[ci] = (idx + 1) as i32;

        // leader
        if idx == 0 {
            gaps[ci] = 0.0;
            continue;
        }
        let ahead = car_data[idx - 1].0;

        let gap = CHECKPOINT_HISTORY.with(|h| {
            let H = h.borrow();
            let me   = &H[&car];
            let him  = &H[&ahead];
            let t_me = me.get(&cp).copied().unwrap_or(0.0);
            let t_him= him.get(&cp).copied().unwrap_or(0.0);
            t_me - t_him
        });

        gaps[ci] = gap;
    }
}
