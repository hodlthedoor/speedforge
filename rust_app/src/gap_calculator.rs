use crate::telemetry_fields::{TelemetryData, GapData};
use std::collections::HashMap;
use std::cell::RefCell;

const CHECKPOINT_INTERVAL: f32 = 0.05; // 5% intervals

// Store checkpoint history for each car using thread_local storage
thread_local! {
    static CHECKPOINT_HISTORY: RefCell<HashMap<i32, HashMap<i32, f32>>> = RefCell::new(HashMap::new());
}

/// Calculate gaps between cars based on their positions and checkpoint times
pub fn calculate_gaps(telemetry_data: &mut TelemetryData) {
    // Create default empty vectors that live for the entire function
    let empty_vec_f32: Vec<f32> = Vec::new();
    let empty_vec_i32: Vec<i32> = Vec::new();
    
    // Get required arrays from telemetry data
    let lap_dist_pcts = telemetry_data.CarIdxLapDistPct.as_ref().unwrap_or(&empty_vec_f32);
    let completed_laps = telemetry_data.CarIdxLapCompleted.as_ref().unwrap_or(&empty_vec_i32);
    let session_time = telemetry_data.SessionTime;

    // Initialize arrays if they don't exist
    if telemetry_data.CarIdxPosition.is_none() {
        telemetry_data.CarIdxPosition = Some(vec![0; 64]);
    }
    if telemetry_data.CarIdxF2Time.is_none() {
        telemetry_data.CarIdxF2Time = Some(vec![0.0; 64]);
    }

    // Create a map of car data with their current checkpoint and time
    let mut car_data: HashMap<i32, (f32, i32, f32)> = HashMap::new();
    
    // Collect data for each car
    for (i, &dist_pct) in lap_dist_pcts.iter().enumerate() {
        // Calculate total progress: raw lap % + (100% * completed laps)
        let completed_laps_f32 = *completed_laps.get(i).unwrap_or(&0) as f32;
        let total_progress = dist_pct + completed_laps_f32;
        
        // Calculate which 5% checkpoint the car is at
        let checkpoint = (total_progress / CHECKPOINT_INTERVAL).floor() as i32;
        
        // Debug output for checkpoint calculation
        if i == 19 { // Car in position 2
            println!("\nCheckpoint calculation for car {}:", i);
            println!("  Raw lap distance: {:.3}", dist_pct);
            println!("  Completed laps: {}", completed_laps_f32);
            println!("  Total progress: {:.3}", total_progress);
            println!("  Current checkpoint: {} ({:.1}%)", checkpoint, checkpoint as f32 * CHECKPOINT_INTERVAL * 100.0);
        }
        
        // Update checkpoint history
        CHECKPOINT_HISTORY.with(|history| {
            let mut history = history.borrow_mut();
            let car_history = history.entry(i as i32).or_insert_with(HashMap::new);
            
            // If we've passed a new checkpoint, record the time
            if !car_history.contains_key(&checkpoint) {
                car_history.insert(checkpoint, session_time);
                println!("Car {} passed checkpoint {} ({:.1}%) at time {:.3}", 
                    i, checkpoint, checkpoint as f32 * CHECKPOINT_INTERVAL * 100.0, session_time);
            }
        });
        
        car_data.insert(i as i32, (total_progress, checkpoint, session_time));
    }

    // Sort cars by total progress (descending)
    let mut sorted_cars: Vec<_> = car_data.into_iter().collect();
    sorted_cars.sort_by(|a, b| b.1.0.partial_cmp(&a.1.0).unwrap_or(std::cmp::Ordering::Equal));

    // Get mutable references to the arrays
    let positions = telemetry_data.CarIdxPosition.as_mut().unwrap();
    let gap_times = telemetry_data.CarIdxF2Time.as_mut().unwrap();
    
    // Calculate gaps and update arrays
    for (i, (car_idx, (total_progress, checkpoint, time))) in sorted_cars.iter().enumerate() {
        let car_idx_usize = *car_idx as usize;
        
        // Update position
        positions[car_idx_usize] = (i + 1) as i32;

        // Calculate gap to next car
        if i == sorted_cars.len() - 1 {
            gap_times[car_idx_usize] = 0.0;
        } else {
            let next_idx = sorted_cars[i + 1].0;
            
            CHECKPOINT_HISTORY.with(|history| {
                let history = history.borrow();
                if let Some(car_history) = history.get(car_idx) {
                    if let Some(next_history) = history.get(&next_idx) {
                        // Find the last common checkpoint
                        let mut common_checkpoint = *checkpoint;
                        let mut gap = 0.0;
                        
                        loop {
                            if common_checkpoint <= 0 {
                                break;
                            }
                            
                            if car_history.contains_key(&common_checkpoint) && 
                               next_history.contains_key(&common_checkpoint) {
                                let car_time = car_history.get(&common_checkpoint).unwrap();
                                let next_time = next_history.get(&common_checkpoint).unwrap();
                                gap = car_time - next_time;
                                println!("Car {} and next {} common checkpoint {} ({:.1}%): car={:.3}, next={:.3}, gap={:.3}", 
                                    car_idx, next_idx, common_checkpoint,
                                    common_checkpoint as f32 * CHECKPOINT_INTERVAL * 100.0,
                                    car_time, next_time, gap);
                                break;
                            }
                            common_checkpoint -= 1;
                        }
                        gap_times[car_idx_usize] = gap;
                    }
                }
            });
        }

        // Debug logging for car in position 2
        if i == 1 {
            println!("\nCar in position 2 (idx: {})", car_idx);
            println!("  Raw lap distance: {:.3}", lap_dist_pcts[car_idx_usize]);
            println!("  Completed laps: {}", completed_laps.get(car_idx_usize).unwrap_or(&0));
            println!("  Total progress: {:.3}", total_progress);
            println!("  Current checkpoint: {} ({:.1}%)", checkpoint, *checkpoint as f32 * CHECKPOINT_INTERVAL * 100.0);
            println!("  Current time: {:.3}", time);
            println!("  Leader checkpoint: {} ({:.1}%)", sorted_cars[0].1.1, sorted_cars[0].1.1 as f32 * CHECKPOINT_INTERVAL * 100.0);
            println!("  Leader time: {:.3}", sorted_cars[0].1.2);
            println!("  Gap to next: {:.3}", gap_times[car_idx_usize]);
            
            // Print checkpoint history for this car
            CHECKPOINT_HISTORY.with(|history| {
                let history = history.borrow();
                if let Some(car_history) = history.get(car_idx) {
                    println!("  Checkpoint history:");
                    for (checkpoint, time) in car_history.iter() {
                        println!("    Checkpoint {} ({:.1}%): {:.3}", 
                            checkpoint, *checkpoint as f32 * CHECKPOINT_INTERVAL * 100.0, time);
                    }
                }
            });
        }
    }
} 