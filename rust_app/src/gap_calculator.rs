use crate::telemetry_fields::{TelemetryData, GapData};
use std::collections::HashMap;

const CHECKPOINT_INTERVAL: f32 = 0.05; // 5% intervals

/// Calculate gaps between cars based on their positions and checkpoint times
pub fn calculate_gaps(telemetry: &mut TelemetryData) {
    // Get required data
    let positions = match &telemetry.CarIdxPosition {
        Some(pos) => pos,
        None => return,
    };
    
    let lap_dist_pcts = match &telemetry.CarIdxLapDistPct {
        Some(dists) => dists,
        None => return,
    };
    
    let session_time = telemetry.SessionTime;
    
    // Create a map of car indices to their data
    let mut car_data: HashMap<i32, (i32, f32, i32)> = HashMap::new();
    
    // First pass: collect all car data
    for (idx, &position) in positions.iter().enumerate() {
        if position > 0 { // Only include cars that are in the race
            let lap_dist = lap_dist_pcts[idx];
            let checkpoint = (lap_dist / CHECKPOINT_INTERVAL).floor() as i32;
            car_data.insert(idx as i32, (position, lap_dist, checkpoint));
        }
    }
    
    // Sort cars by position
    let mut sorted_cars: Vec<_> = car_data.iter().collect();
    sorted_cars.sort_by_key(|&(_, (pos, _, _))| *pos);
    
    // Calculate gaps
    let mut gap_data = Vec::new();
    
    for (i, (&car_idx, &(position, lap_dist, checkpoint))) in sorted_cars.iter().enumerate() {
        let mut gap_to_leader = 0.0;
        let mut gap_to_next = 0.0;
        let mut gap_to_prev = 0.0;
        
        // Calculate gap to leader (first car)
        if i > 0 {
            let leader_idx = sorted_cars[0].0;
            let leader_checkpoint = sorted_cars[0].1.2;
            
            // If cars are in different sectors, use lap distance
            if checkpoint != leader_checkpoint {
                let leader_dist = sorted_cars[0].1.1;
                gap_to_leader = (lap_dist - leader_dist).abs();
            } else {
                // Cars are in same sector, use checkpoint time
                gap_to_leader = (session_time - telemetry.SessionTime).abs();
            }
        }
        
        // Calculate gap to next car
        if i < sorted_cars.len() - 1 {
            let next_idx = sorted_cars[i + 1].0;
            let next_checkpoint = sorted_cars[i + 1].1.2;
            
            if checkpoint != next_checkpoint {
                let next_dist = sorted_cars[i + 1].1.1;
                gap_to_next = (lap_dist - next_dist).abs();
            } else {
                gap_to_next = (session_time - telemetry.SessionTime).abs();
            }
        }
        
        // Calculate gap to previous car
        if i > 0 {
            let prev_idx = sorted_cars[i - 1].0;
            let prev_checkpoint = sorted_cars[i - 1].1.2;
            
            if checkpoint != prev_checkpoint {
                let prev_dist = sorted_cars[i - 1].1.1;
                gap_to_prev = (lap_dist - prev_dist).abs();
            } else {
                gap_to_prev = (session_time - telemetry.SessionTime).abs();
            }
        }
        
        gap_data.push(GapData {
            car_idx,
            position,
            gap_to_leader,
            gap_to_next,
            gap_to_prev,
            last_checkpoint: checkpoint,
            last_checkpoint_time: session_time,
        });
    }
    
    // Update telemetry data with calculated gaps
    telemetry.gap_data = Some(gap_data);
} 