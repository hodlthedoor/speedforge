use crate::telemetry_fields::{TelemetryData, GapData};
use std::collections::HashMap;

const CHECKPOINT_INTERVAL: f32 = 0.05; // 5% intervals

// Store checkpoint history for each car
static mut CHECKPOINT_HISTORY: Option<HashMap<i32, HashMap<i32, f32>>> = None;

/// Calculate gaps between cars based on their positions and checkpoint times
pub fn calculate_gaps(telemetry_data: &mut TelemetryData) {
    // Create default empty vectors that live for the entire function
    let empty_vec_f32: Vec<f32> = Vec::new();
    let empty_vec_i32: Vec<i32> = Vec::new();
    
    // Get required arrays from telemetry data
    let lap_dist_pcts = telemetry_data.CarIdxLapDistPct.as_ref().unwrap_or(&empty_vec_f32);
    let completed_laps = telemetry_data.CarIdxLapCompleted.as_ref().unwrap_or(&empty_vec_i32);
    let session_time = telemetry_data.SessionTime;

    // Initialize checkpoint history if needed
    unsafe {
        if CHECKPOINT_HISTORY.is_none() {
            CHECKPOINT_HISTORY = Some(HashMap::new());
        }
    }

    // Create a map of car data with their current checkpoint and time
    let mut car_data: HashMap<i32, (f32, i32, f32)> = HashMap::new();
    
    // Collect data for each car
    for (i, &dist_pct) in lap_dist_pcts.iter().enumerate() {
        // Calculate which 5% checkpoint the car is at
        // Add completed laps to get total progress
        let completed_laps_f32 = *completed_laps.get(i).unwrap_or(&0) as f32;
        let total_progress = dist_pct + completed_laps_f32;
        let checkpoint = (total_progress / CHECKPOINT_INTERVAL).floor() as i32;
        
        // Update checkpoint history
        unsafe {
            if let Some(history) = &mut CHECKPOINT_HISTORY {
                let car_history = history.entry(i as i32).or_insert_with(HashMap::new);
                
                // If we've passed a new checkpoint, record the time
                if !car_history.contains_key(&checkpoint) {
                    car_history.insert(checkpoint, session_time);
                }
            }
        }
        
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
        // Find the last common checkpoint with the car in front
        let gap_to_leader = if i == 0 {
            0.0
        } else {
            let leader_idx = sorted_cars[0].0;
            let leader_checkpoint = sorted_cars[0].1.1;
            
            unsafe {
                if let Some(history) = &CHECKPOINT_HISTORY {
                    if let Some(car_history) = history.get(car_idx) {
                        if let Some(leader_history) = history.get(&leader_idx) {
                            // Find the last common checkpoint
                            let mut common_checkpoint = *checkpoint;
                            while common_checkpoint > 0 {
                                if car_history.contains_key(&common_checkpoint) && 
                                   leader_history.contains_key(&common_checkpoint) {
                                    let car_time = car_history.get(&common_checkpoint).unwrap();
                                    let leader_time = leader_history.get(&common_checkpoint).unwrap();
                                    break car_time - leader_time;
                                }
                                common_checkpoint -= 1;
                            }
                            0.0 // Default if no common checkpoint found
                        } else {
                            0.0
                        }
                    } else {
                        0.0
                    }
                } else {
                    0.0
                }
            }
        };

        let gap_to_next = if i == sorted_cars.len() - 1 {
            0.0
        } else {
            let next_idx = sorted_cars[i + 1].0;
            let next_checkpoint = sorted_cars[i + 1].1.1;
            
            unsafe {
                if let Some(history) = &CHECKPOINT_HISTORY {
                    if let Some(car_history) = history.get(car_idx) {
                        if let Some(next_history) = history.get(&next_idx) {
                            // Find the last common checkpoint
                            let mut common_checkpoint = *checkpoint;
                            while common_checkpoint > 0 {
                                if car_history.contains_key(&common_checkpoint) && 
                                   next_history.contains_key(&common_checkpoint) {
                                    let car_time = car_history.get(&common_checkpoint).unwrap();
                                    let next_time = next_history.get(&common_checkpoint).unwrap();
                                    break car_time - next_time;
                                }
                                common_checkpoint -= 1;
                            }
                            0.0 // Default if no common checkpoint found
                        } else {
                            0.0
                        }
                    } else {
                        0.0
                    }
                } else {
                    0.0
                }
            }
        };

        let gap_to_prev = if i == 0 {
            0.0
        } else {
            let prev_idx = sorted_cars[i - 1].0;
            let prev_checkpoint = sorted_cars[i - 1].1.1;
            
            unsafe {
                if let Some(history) = &CHECKPOINT_HISTORY {
                    if let Some(car_history) = history.get(car_idx) {
                        if let Some(prev_history) = history.get(&prev_idx) {
                            // Find the last common checkpoint
                            let mut common_checkpoint = *checkpoint;
                            while common_checkpoint > 0 {
                                if car_history.contains_key(&common_checkpoint) && 
                                   prev_history.contains_key(&common_checkpoint) {
                                    let car_time = car_history.get(&common_checkpoint).unwrap();
                                    let prev_time = prev_history.get(&common_checkpoint).unwrap();
                                    break car_time - prev_time;
                                }
                                common_checkpoint -= 1;
                            }
                            0.0 // Default if no common checkpoint found
                        } else {
                            0.0
                        }
                    } else {
                        0.0
                    }
                } else {
                    0.0
                }
            }
        };

        // Debug logging for car in position 2
        if i == 1 {
            println!("Car in position 2 (idx: {})", car_idx);
            println!("  Total progress: {:.3}", total_progress);
            println!("  Current checkpoint: {}", checkpoint);
            println!("  Current time: {:.3}", time);
            println!("  Leader checkpoint: {}", sorted_cars[0].1.1);
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