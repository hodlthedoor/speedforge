use crate::telemetry_fields::TelemetryData;
use std::cell::RefCell;
use std::collections::HashMap;

const CHECKPOINT_INTERVAL: f32 = 0.05;

thread_local! {
    static CHECKPOINT_HISTORY: RefCell<HashMap<i32, HashMap<i32, f32>>> = RefCell::new(HashMap::new());
    static LAST_SESSION_TIME: RefCell<f32> = RefCell::new(0.0);
}

pub fn calculate_gaps(telemetry_data: &mut TelemetryData) {
    let lap_dist = telemetry_data.CarIdxLapDistPct.as_ref().unwrap();
    let laps_done = telemetry_data.CarIdxLapCompleted.as_ref().unwrap();
    let t = telemetry_data.SessionTime;

    // clear on new session
    LAST_SESSION_TIME.with(|lt| {
        let mut last = lt.borrow_mut();
        if t < *last {
            CHECKPOINT_HISTORY.with(|h| h.borrow_mut().clear());
        }
        *last = t;
    });

    // ensure output arrays
    let n = lap_dist.len().max(64);
    telemetry_data
        .CarIdxPosition
        .get_or_insert_with(|| vec![0; n]);
    telemetry_data
        .CarIdxF2Time
        .get_or_insert_with(|| vec![0.0; n]);

    // gather (car, progress, cp)
    let mut car_data = Vec::with_capacity(lap_dist.len());
    for (i, &pct) in lap_dist.iter().enumerate() {
        let car = i as i32;
        let total = pct + laps_done.get(i).copied().unwrap_or(0) as f32;
        let cp = (total / CHECKPOINT_INTERVAL).floor() as i32;

        // record first-hit time
        CHECKPOINT_HISTORY.with(|h| {
            let mut hist = h.borrow_mut();
            hist.entry(car)
                .or_default()
                .entry(cp)
                .or_insert(t);
        });

        car_data.push((car, total, cp));
    }

    // sort desc by progress
    car_data.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap());

    let positions = telemetry_data.CarIdxPosition.as_mut().unwrap();
    let gaps = telemetry_data.CarIdxF2Time.as_mut().unwrap();

    for (idx, &(car, _, cp)) in car_data.iter().enumerate() {
        let ci = car as usize;
        positions[ci] = (idx + 1) as i32;

        if idx == 0 {
            gaps[ci] = 0.0;
            continue;
        }

        let ahead = car_data[idx - 1].0;
        // compute and apply only if >0
        CHECKPOINT_HISTORY.with(|h| {
            let H = h.borrow();
            if let (Some(&t_me), Some(&t_him)) =
                (H[&car].get(&cp), H[&ahead].get(&cp))
            {
                let delta = t_me - t_him;
                if delta > 0.0 {
                    gaps[ci] = delta;
                }
            }
        });
    }
}
