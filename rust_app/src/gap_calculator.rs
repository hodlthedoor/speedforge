use crate::telemetry_fields::{TelemetryData, GapData};
use std::collections::HashMap;

const CHECKPOINT_INTERVAL: f32 = 0.05; // 5% intervals

/// Calculate gaps between cars based on their positions and checkpoint times
pub fn calculate_gaps(telemetry_data: &mut TelemetryData) {
    // Create default empty vectors that live for the entire function
    let empty_vec_f32: Vec<f32> = Vec::new();
    let empty_vec_i32: Vec<i32> = Vec::new();
    
    // Get required arrays from telemetry data
    let lap_dist_pcts = telemetry_data.CarIdxLapDistPct.as_ref().unwrap_or(&empty_vec_f32);
    let completed_laps = telemetry_data.CarIdxLapCompleted.as_ref().unwrap_or(&empty_vec_i32);
    let session_time = telemetry_data.SessionTime;

    // Create a map of car data with their current checkpoint and time
    let mut car_data: HashMap<i32, (f32, i32, f32)> = HashMap::new();
    
    // Collect data for each car
    for (i, &dist_pct) in lap_dist_pcts.iter().enumerate() {
        // Calculate which 5% checkpoint the car is at
        // Add completed laps to get total progress
        let completed_laps_f32 = *completed_laps.get(i).unwrap_or(&0) as f32;
        let total_progress = dist_pct + completed_laps_f32;
        let checkpoint = (total_progress / CHECKPOINT_INTERVAL).floor() as i32;
        car_data.insert(i as i32, (total_progress, checkpoint, session_time));
    }

    // Sort cars by total progress (descending)
    let mut sorted_cars: Vec<_> = car_data.into_iter().collect();
    sorted_cars.sort_by(|a, b| {
        b.1.0.partial_cmp(&a.1.0)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(a.1.2.partial_cmp(&b.1.2).unwrap_or(std::cmp::Ordering::Equal))
    });

    // Calculate gaps
    let mut gap_data = Vec::new();
    
    for (i, (car_idx, (total_progress, checkpoint, time))) in sorted_cars.iter().enumerate() {
        let gap_to_leader = if i == 0 {
            0.0
        } else {
            let leader_time = sorted_cars[0].1.2;
            time - leader_time
        };

        let gap_to_next = if i == sorted_cars.len() - 1 {
            0.0
        } else {
            let next_time = sorted_cars[i + 1].1.2;
            time - next_time
        };

        let gap_to_prev = if i == 0 {
            0.0
        } else {
            let prev_time = sorted_cars[i - 1].1.2;
            time - prev_time
        };

        // Debug logging for car in position 2
        if i == 1 {
            println!("Car in position 2 (idx: {})", car_idx);
            println!("  Total progress: {:.3}", total_progress);
            println!("  Current checkpoint: {}", checkpoint);
            println!("  Current time: {:.3}", time);
            println!("  Leader time: {:.3}", sorted_cars[0].1.2);
            println!("  Gap to leader: {:.3}", gap_to_leader);
            println!("  Gap to next: {:.3}", gap_to_next);
            println!("  Gap to prev: {:.3}", gap_to_prev);
            println!("  Raw lap distance: {:.3}", lap_dist_pcts[*car_idx as usize]);
            println!("  Completed laps: {}", completed_laps.get(*car_idx as usize).unwrap_or(&0));
        }

        gap_data.push(GapData {
            car_idx: *car_idx,
            position: (i + 1) as i32,
            gap_to_leader,
            gap_to_next,
            gap_to_prev,
            last_checkpoint: *checkpoint,
            last_checkpoint_time: *time,
        });
    }

    // Update telemetry data with calculated gaps
    telemetry_data.gap_data = Some(gap_data);
} 