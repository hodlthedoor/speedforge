use crate::telemetry_fields::{TelemetryData, GapData};
use std::collections::HashMap;

const CHECKPOINT_INTERVAL: f32 = 0.05; // 5% intervals

/// Calculate gaps between cars based on their positions and checkpoint times
pub fn calculate_gaps(telemetry_data: &mut TelemetryData) {
    // Get required arrays from telemetry data
    let positions = telemetry_data.CarIdxLapDistPct.as_ref().unwrap_or(&vec![]);
    let lap_dist = telemetry_data.CarIdxLapDistPct.as_ref().unwrap_or(&vec![]);
    let checkpoints = telemetry_data.CarIdxLapDistPct.as_ref().unwrap_or(&vec![]);
    let session_time = telemetry_data.SessionTime;

    // Create a map of car data
    let mut car_data: HashMap<i32, (f32, f32, i32)> = HashMap::new();
    
    // Collect data for each car
    for (i, pos) in positions.iter().enumerate() {
        let dist = lap_dist.get(i).unwrap_or(&0.0);
        let checkpoint = (dist / CHECKPOINT_INTERVAL).floor() as i32;
        car_data.insert(i as i32, (*pos, *dist, checkpoint));
    }

    // Sort cars by position
    let mut sorted_cars: Vec<_> = car_data.into_iter().collect();
    sorted_cars.sort_by(|a, b| b.1.0.partial_cmp(&a.1.0).unwrap_or(std::cmp::Ordering::Equal));

    // Calculate gaps
    let mut gap_data = Vec::new();
    
    for (i, (car_idx, (position, lap_dist, checkpoint))) in sorted_cars.iter().enumerate() {
        let gap_to_leader = if i == 0 {
            0.0
        } else {
            let leader_checkpoint = sorted_cars[0].1.2;
            (checkpoint - leader_checkpoint) as f32 * CHECKPOINT_INTERVAL
        };

        let gap_to_next = if i == sorted_cars.len() - 1 {
            0.0
        } else {
            let next_checkpoint = sorted_cars[i + 1].1.2;
            (checkpoint - next_checkpoint) as f32 * CHECKPOINT_INTERVAL
        };

        let gap_to_prev = if i == 0 {
            0.0
        } else {
            let prev_checkpoint = sorted_cars[i - 1].1.2;
            (checkpoint - prev_checkpoint) as f32 * CHECKPOINT_INTERVAL
        };

        gap_data.push(GapData {
            car_idx: *car_idx,
            position: (i + 1) as i32,
            gap_to_leader,
            gap_to_next,
            gap_to_prev,
            last_checkpoint: *checkpoint,
            last_checkpoint_time: session_time,
        });
    }

    // Update telemetry data with calculated gaps
    telemetry_data.gap_data = Some(gap_data);
} 