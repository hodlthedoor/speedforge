use iracing::Connection;
use std::convert::TryInto;
use std::{thread, time::Duration};
use std::io::{self, stdout, Write};

// Function to clear the screen in a cross-platform way
#[cfg(target_os = "windows")]
fn clear_screen() {
    // On Windows, use direct Win32 API calls for better performance
    // Just use ANSI escape codes instead of process command
    print!("\x1B[2J\x1B[1;1H");
    stdout().flush().unwrap();
}

#[cfg(not(target_os = "windows"))]
fn clear_screen() {
    // On Unix systems, use ANSI escape codes
    print!("{}[2J{}[1;1H", 27 as char, 27 as char);
    stdout().flush().unwrap(); // Ensure the escape codes are processed immediately
}

fn main() {
    println!("SpeedForge iRacing Telemetry Monitor");
    println!("Attempting to connect to iRacing...");
    
    // Create a telemetry connection
    let conn = match Connection::new() {
        Ok(c) => {
            println!("Successfully connected to iRacing!");
            c
        },
        Err(e) => {
            println!("Failed to connect to iRacing: {}", e);
            println!("Make sure iRacing is running.");
            return;
        }
    };
    
    // List all available telemetry variables
    println!("\nAvailable telemetry variables:");
    if let Ok(telem) = conn.telemetry() {
        let all_vars = telem.all();
        
        // Create a vector of variable names for easier sorting
        let mut var_names: Vec<String> = all_vars.iter()
            .map(|var| var.name.clone())
            .collect();
        
        // Sort the variable names alphabetically
        var_names.sort();
        
        // Print variables in columns (5 per line)
        for (i, name) in var_names.iter().enumerate() {
            print!("{:<20}", name);
            if (i + 1) % 4 == 0 {
                println!();
            }
        }
        if var_names.len() % 4 != 0 {
            println!();
        }
        
        println!("\nTotal: {} variables available", var_names.len());
        
        // List some interesting categories of variables
        println!("\nSome interesting variable categories:");
        println!("Car state: Speed, RPM, Gear, Throttle, Brake, Clutch, HandbrackPct, Steer");
        println!("Lap timing: Lap, LapCurrentLapTime, LapBestLapTime, LapLastLapTime");
        println!("Position: LapDist, LapDistPct, LatAccel, LongAccel, YawRate");
        println!("Track: TrackTemp, TrackSurfaceMaterial, WeatherAirTemp, WeatherHumidity");
        println!("Fuel: FuelLevel, FuelLevelPct, FuelUsePerHour");
        println!("Wheels: LFtempCL, RFtempCL, LRtempCL, RRtempCL, LFpressure, RFpressure, LRpressure, RRpressure");
        println!("Suspension: LFshockDefl, RFshockDefl, LRshockDefl, RRshockDefl");
        println!("Flags/Status: SessionFlags, OnPitRoad, PitRepairLeft, PitOptRepairLeft");
        println!("Wheel Dynamics: LFslipAngle, RFslipAngle, LRslipAngle, RRslipAngle, LFmaxBrakeTemp, RFmaxBrakeTemp");
    }
    
    // Create a blocking telemetry handle
    let blocking = match conn.blocking() {
        Ok(b) => b,
        Err(e) => {
            println!("Failed to create telemetry handle: {}", e);
            return;
        }
    };

    println!("\nMonitoring telemetry data. Press Ctrl+C to exit.");
    println!("Press any key to start monitoring...");
    let _ = std::io::stdin().read_line(&mut String::new());
    
    // Give user time to switch to iRacing
    for i in (1..=3).rev() {
        clear_screen();
        println!("Starting in {} seconds...", i);
        thread::sleep(Duration::from_secs(1));
    }
    
    // Main loop to display telemetry data
    loop {
        // Get telemetry sample
        let telem = match blocking.sample(Duration::from_millis(100)) {
            Ok(sample) => sample,
            Err(e) => {
                println!("Error sampling telemetry: {:?}", e);
                continue;
            }
        };
        
        // Create a String to hold all display output
        let mut display = String::new();
        
        // Clear the screen first - this should be outside of our buffer
        clear_screen();
        
        // Check if on pit road
        let on_pit_road = telem.get("OnPitRoad").map(|v| v.try_into().unwrap_or(false)).unwrap_or(false);
        let pit_status = if on_pit_road { "IN PITS" } else { "ON TRACK" };
        
        display.push_str(&format!("=== CAR STATE ({}) ===\n", pit_status));
        
        // Get and display some basic telemetry values
        if let Ok(speed) = telem.get("Speed").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Speed: {:.2} km/h\n", speed * 3.6)); // Convert to km/h
        }
        
        if let Ok(rpm) = telem.get("RPM").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("RPM: {:.0}\n", rpm));
        }
        
        // Add gearbox and shifter info
        if let Ok(gear) = telem.get("Gear").map(|v| v.try_into().unwrap_or(0i32)) {
            let gear_str = match gear {
                -1 => "R".to_string(),
                0 => "N".to_string(),
                n => n.to_string(),
            };
            display.push_str(&format!("Gear: {}\n", gear_str));
        }
        
        // Add shift indicator if available
        if let Ok(shift_indicator) = telem.get("ShiftIndicatorPct").map(|v| v.try_into().unwrap_or(0.0f32)) {
            if shift_indicator > 0.0 {
                display.push_str(&format!("Shift Indicator: {:.0}%\n", shift_indicator * 100.0));
            }
        }
        
        // Add car position information
        if let Ok(x) = telem.get("VelocityX").map(|v| v.try_into().unwrap_or(0.0f32)) {
            if let Ok(y) = telem.get("VelocityY").map(|v| v.try_into().unwrap_or(0.0f32)) {
                if let Ok(z) = telem.get("VelocityZ").map(|v| v.try_into().unwrap_or(0.0f32)) {
                    // Calculate 3D velocity magnitude
                    let velocity_magnitude = (x*x + y*y + z*z).sqrt();
                    display.push_str(&format!("Speed Vector: {:.2} m/s\n", velocity_magnitude));
                }
            }
        }
        
        // Driver inputs
        display.push_str("\n=== DRIVER INPUTS ===\n");
        if let Ok(throttle) = telem.get("Throttle").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Throttle: {:.1}%\n", throttle * 100.0));
        }
        
        if let Ok(brake) = telem.get("Brake").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Brake: {:.1}%\n", brake * 100.0));
        }
        
        if let Ok(clutch) = telem.get("Clutch").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Clutch: {:.1}%\n", (1.0 - clutch) * 100.0)); // Convert to percentage
        }
        
        if let Ok(steer) = telem.get("SteeringWheelAngle").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Steering: {:.1}°\n", steer * 180.0 / std::f32::consts::PI)); // Convert to degrees
        }
        
        // Acceleration data
        display.push_str("\n=== DYNAMICS ===\n");
        if let Ok(lat_accel) = telem.get("LatAccel").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Lateral Accel: {:.2}m/s²\n", lat_accel));
        }

        if let Ok(long_accel) = telem.get("LongAccel").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Longitudinal Accel: {:.2}m/s²\n", long_accel));
        }

        if let Ok(yaw_rate) = telem.get("YawRate").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Yaw Rate: {:.2}°/s\n", yaw_rate * 180.0 / std::f32::consts::PI));
        }

        if let Ok(vert_accel) = telem.get("VertAccel").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Vertical Accel: {:.2}m/s²\n", vert_accel));
        }

        // G-Forces
        if let Ok(long_g) = telem.get("LongAccel").map(|v| v.try_into().unwrap_or(0.0f32)) {
            let long_g = long_g / 9.8;
            if let Ok(lat_g) = telem.get("LatAccel").map(|v| v.try_into().unwrap_or(0.0f32)) {
                let lat_g = lat_g / 9.8;
                display.push_str(&format!("G-Force: Lon:{:.2}G Lat:{:.2}G\n", long_g, lat_g));
            }
        }
        
        // Track position
        if let Ok(track_surf) = telem.get("TrackSurface").map(|v| v.try_into().unwrap_or(0i32)) {
            let surface = match track_surf {
                0 => "Not in world",
                1 => "On track",
                2 => "Off track",
                3 => "Grass/dirt",
                4 => "Gravel/sand",
                _ => "Unknown",
            };
            display.push_str(&format!("Surface: {}\n", surface));
        }
        
        // Car orientation
        display.push_str("\n=== CAR ORIENTATION ===\n");
        if let Ok(pitch) = telem.get("Pitch").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Pitch: {:.2}°\n", pitch * 180.0 / std::f32::consts::PI));
        }

        if let Ok(roll) = telem.get("Roll").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Roll: {:.2}°\n", roll * 180.0 / std::f32::consts::PI));
        }

        if let Ok(yaw) = telem.get("Yaw").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Yaw: {:.2}°\n", yaw * 180.0 / std::f32::consts::PI));
        }
        
        // Lap and timing
        display.push_str("\n=== LAP TIMING ===\n");
        if let Ok(lap) = telem.get("Lap").map(|v| v.try_into().unwrap_or(0i32)) {
            display.push_str(&format!("Lap: {}\n", lap));
        }
        
        if let Ok(lap_time) = telem.get("LapCurrentLapTime").map(|v| v.try_into().unwrap_or(0.0f32)) {
            let minutes = (lap_time / 60.0) as i32;
            let seconds = lap_time % 60.0;
            display.push_str(&format!("Current Lap: {}:{:06.3}\n", minutes, seconds));
        }
        
        if let Ok(best_lap_time) = telem.get("LapBestLapTime").map(|v| v.try_into().unwrap_or(0.0f32)) {
            if best_lap_time > 0.0 {
                let minutes = (best_lap_time / 60.0) as i32;
                let seconds = best_lap_time % 60.0;
                display.push_str(&format!("Best Lap: {}:{:06.3}\n", minutes, seconds));
            }
        }
        
        if let Ok(last_lap_time) = telem.get("LapLastLapTime").map(|v| v.try_into().unwrap_or(0.0f32)) {
            if last_lap_time > 0.0 {
                let minutes = (last_lap_time / 60.0) as i32;
                let seconds = last_lap_time % 60.0;
                display.push_str(&format!("Last Lap: {}:{:06.3}\n", minutes, seconds));
            }
        }
        
        if let Ok(lap_dist_pct) = telem.get("LapDistPct").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Lap Progress: {:.1}%\n", lap_dist_pct * 100.0));
        }

        // Add delta time to best lap
        if let Ok(delta_best) = telem.get("LapDeltaToBestLap").map(|v| v.try_into().unwrap_or(0.0f32)) {
            let sign = if delta_best >= 0.0 { "+" } else { "" };
            display.push_str(&format!("Delta to Best: {}{}s\n", sign, delta_best));
        }

        // Add delta to session best lap
        if let Ok(delta_session) = telem.get("LapDeltaToSessionBestLap").map(|v| v.try_into().unwrap_or(0.0f32)) {
            let sign = if delta_session >= 0.0 { "+" } else { "" };
            display.push_str(&format!("Delta to Session Best: {}{}s\n", sign, delta_session));
        }

        // Add delta to optimal lap
        if let Ok(delta_optimal) = telem.get("LapDeltaToOptimalLap").map(|v| v.try_into().unwrap_or(0.0f32)) {
            let sign = if delta_optimal >= 0.0 { "+" } else { "" };
            display.push_str(&format!("Delta to Optimal: {}{}s\n", sign, delta_optimal));
        }
        
        // Race position
        if let Ok(position) = telem.get("PlayerCarPosition").map(|v| v.try_into().unwrap_or(0i32)) {
            display.push_str(&format!("Position: {}\n", position));
        }
        
        // Fuel and temperatures
        display.push_str("\n=== FUEL & TEMPS ===\n");
        if let Ok(fuel_level) = telem.get("FuelLevel").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Fuel: {:.2}L\n", fuel_level));
        }

        if let Ok(fuel_pct) = telem.get("FuelLevelPct").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Fuel: {:.1}%\n", fuel_pct * 100.0));
        }

        if let Ok(fuel_use) = telem.get("FuelUsePerHour").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Fuel Use: {:.2}L/hr\n", fuel_use));
        }

        if let Ok(track_temp) = telem.get("TrackTemp").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Track Temp: {:.1}°C\n", track_temp));
        }

        if let Ok(air_temp) = telem.get("AirTemp").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Air Temp: {:.1}°C\n", air_temp));
        }

        // Add additional weather info
        if let Ok(humidity) = telem.get("RelativeHumidity").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Humidity: {:.0}%\n", humidity * 100.0));
        }

        if let Ok(wind_dir) = telem.get("WindDir").map(|v| v.try_into().unwrap_or(0.0f32)) {
            if let Ok(wind_vel) = telem.get("WindVel").map(|v| v.try_into().unwrap_or(0.0f32)) {
                display.push_str(&format!("Wind: {:.1} m/s @ {:.0}°\n", wind_vel, wind_dir * 180.0 / std::f32::consts::PI));
            }
        }

        // Add fog level and skies
        if let Ok(fog) = telem.get("FogLevel").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Fog Level: {:.0}%\n", fog * 100.0));
        }

        if let Ok(skies) = telem.get("Skies").map(|v| v.try_into().unwrap_or(0i32)) {
            let sky_condition = match skies {
                0 => "Clear",
                1 => "Partly Cloudy",
                2 => "Mostly Cloudy",
                3 => "Overcast",
                _ => "Unknown",
            };
            display.push_str(&format!("Skies: {}\n", sky_condition));
        }
        
        if let Ok(water_temp) = telem.get("WaterTemp").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Water Temp: {:.1}°C\n", water_temp));
        }
        
        if let Ok(oil_temp) = telem.get("OilTemp").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Oil Temp: {:.1}°C\n", oil_temp));
        }
        
        // WHEEL DATA section 
        display.push_str("\n=== WHEEL DATA ===\n");
        // Try to get wheel temperatures
        let lf_temp = telem.get("LFtempCL").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        let rf_temp = telem.get("RFtempCL").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        let lr_temp = telem.get("LRtempCL").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        let rr_temp = telem.get("RRtempCL").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        
        display.push_str(&format!("Tire Temps (°C): LF:{:.1} RF:{:.1} LR:{:.1} RR:{:.1}\n", 
            lf_temp, rf_temp, lr_temp, rr_temp));
        
        // Try to get wheel pressures
        let lf_press = telem.get("LFpressure").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        let rf_press = telem.get("RFpressure").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        let lr_press = telem.get("LRpressure").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        let rr_press = telem.get("RRpressure").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        
        display.push_str(&format!("Tire Press (kPa): LF:{:.1} RF:{:.1} LR:{:.1} RR:{:.1}\n", 
            lf_press, rf_press, lr_press, rr_press));
        
        // Try to get wheel ride height
        let lf_rideheight = telem.get("LFrideHeight").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        let rf_rideheight = telem.get("RFrideHeight").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        let lr_rideheight = telem.get("LRrideHeight").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        let rr_rideheight = telem.get("RRrideHeight").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        
        display.push_str(&format!("Ride Height (mm): LF:{:.1} RF:{:.1} LR:{:.1} RR:{:.1}\n", 
            lf_rideheight * 1000.0, rf_rideheight * 1000.0, lr_rideheight * 1000.0, rr_rideheight * 1000.0));
        
        // Wheel slip angles and forces
        display.push_str("\n=== WHEEL DYNAMICS ===\n");
        
        // Get wheel slip
        // iRacing doesn't have direct "slip angle" variables but rather wheel velocities
        // Let's show the steering angle and yaw rate instead
        if let Ok(steer_angle) = telem.get("SteeringWheelAngle").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Steering Angle: {:.2}°\n", steer_angle * 180.0 / std::f32::consts::PI));
        }

        if let Ok(yaw_rate) = telem.get("YawRate").map(|v| v.try_into().unwrap_or(0.0f32)) {
            display.push_str(&format!("Yaw Rate: {:.2}°/s\n", yaw_rate * 180.0 / std::f32::consts::PI));
        }

        // Try to get tire loads - unfortunately it seems iRacing doesn't expose direct tire load variables
        // We could use suspension deflection as a proxy
        let lf_shock = telem.get("LFshockDefl").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        let rf_shock = telem.get("RFshockDefl").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        let lr_shock = telem.get("LRshockDefl").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        let rr_shock = telem.get("RRshockDefl").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);

        display.push_str(&format!("Shock Defl (mm): LF:{:.1} RF:{:.1} LR:{:.1} RR:{:.1}\n", 
            lf_shock * 1000.0, rf_shock * 1000.0, lr_shock * 1000.0, rr_shock * 1000.0));

        // Get wheel velocities in the car reference frame
        if let Ok(vx) = telem.get("VelocityX").map(|v| v.try_into().unwrap_or(0.0f32)) {
            if let Ok(vy) = telem.get("VelocityY").map(|v| v.try_into().unwrap_or(0.0f32)) {
                // Calculate approximate slip angle of the car
                let slip_angle = if vx.abs() > 0.1 { (vy / vx).atan() * 180.0 / std::f32::consts::PI } else { 0.0 };
                display.push_str(&format!("Car Slip Angle: {:.2}°\n", slip_angle));
            }
        }

        // Get wheel speeds if available
        if let Ok(lf_rpm) = telem.get("LFrpm").map(|v| v.try_into().unwrap_or(0.0f32)) {
            if let Ok(rf_rpm) = telem.get("RFrpm").map(|v| v.try_into().unwrap_or(0.0f32)) {
                if let Ok(lr_rpm) = telem.get("LRrpm").map(|v| v.try_into().unwrap_or(0.0f32)) {
                    if let Ok(rr_rpm) = telem.get("RRrpm").map(|v| v.try_into().unwrap_or(0.0f32)) {
                        display.push_str(&format!("Wheel RPM: LF:{:.0} RF:{:.0} LR:{:.0} RR:{:.0}\n", 
                            lf_rpm, rf_rpm, lr_rpm, rr_rpm));
                    }
                }
            }
        }

        // Try to get brake temperatures
        let lf_brake_temp = telem.get("LFbrakeTemp").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        let rf_brake_temp = telem.get("RFbrakeTemp").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        let lr_brake_temp = telem.get("LRbrakeTemp").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        let rr_brake_temp = telem.get("RRbrakeTemp").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);

        display.push_str(&format!("Brake Temp (°C): LF:{:.1} RF:{:.1} LR:{:.1} RR:{:.1}\n", 
            lf_brake_temp, rf_brake_temp, lr_brake_temp, rr_brake_temp));
        
        // SUSPENSION section 
        display.push_str("\n=== SUSPENSION ===\n");
        // Try to get shock deflection
        let lf_shock = telem.get("LFshockDefl").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        let rf_shock = telem.get("RFshockDefl").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        let lr_shock = telem.get("LRshockDefl").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        let rr_shock = telem.get("RRshockDefl").map(|v| v.try_into().unwrap_or(0.0f32)).unwrap_or(0.0);
        
        display.push_str(&format!("Shock Defl (mm): LF:{:.1} RF:{:.1} LR:{:.1} RR:{:.1}\n", 
            lf_shock * 1000.0, rf_shock * 1000.0, lr_shock * 1000.0, rr_shock * 1000.0));
        
        // Car damage
        display.push_str("\n=== DAMAGE ===\n");
        if let Ok(repair_left) = telem.get("PitRepairLeft").map(|v| v.try_into().unwrap_or(0.0f32)) {
            if repair_left > 0.0 {
                display.push_str(&format!("Required Repairs: {:.1}s\n", repair_left));
            } else {
                display.push_str("Required Repairs: None\n");
            }
        }
        
        if let Ok(opt_repair_left) = telem.get("PitOptRepairLeft").map(|v| v.try_into().unwrap_or(0.0f32)) {
            if opt_repair_left > 0.0 {
                display.push_str(&format!("Optional Repairs: {:.1}s\n", opt_repair_left));
            } else {
                display.push_str("Optional Repairs: None\n");
            }
        }
        
        // Session flags
        if let Ok(flags) = telem.get("SessionFlags").map(|v| v.try_into().unwrap_or(0u32)) {
            display.push_str("\n=== FLAGS ===\n");
            // Flag constants based on iRacing SDK
            const CHECKERED: u32 = 0x00000001;
            const WHITE: u32 = 0x00000002;
            const GREEN: u32 = 0x00000004;
            const YELLOW: u32 = 0x00000008;
            const RED: u32 = 0x00000010;
            const BLUE: u32 = 0x00000020;
            const BLACK: u32 = 0x00000040;
            const BLACK_WHITE: u32 = 0x00000080;
            
            if flags & GREEN != 0 { display.push_str("GREEN FLAG\n"); }
            if flags & YELLOW != 0 { display.push_str("YELLOW FLAG\n"); }
            if flags & RED != 0 { display.push_str("RED FLAG\n"); }
            if flags & BLUE != 0 { display.push_str("BLUE FLAG\n"); }
            if flags & WHITE != 0 { display.push_str("WHITE FLAG\n"); }
            if flags & CHECKERED != 0 { display.push_str("CHECKERED FLAG\n"); }
            if flags & BLACK != 0 { display.push_str("BLACK FLAG\n"); }
            if flags & BLACK_WHITE != 0 { display.push_str("BLACK/WHITE FLAG\n"); }
        }
        
        // After displaying the RPM, add engine warnings
        if let Ok(engine_warnings) = telem.get("EngineWarnings").map(|v| v.try_into().unwrap_or(0u32)) {
            // Engine warning bit flags
            const WATER_TEMP_WARNING: u32 = 0x01;
            const FUEL_PRESSURE_WARNING: u32 = 0x02;
            const OIL_PRESSURE_WARNING: u32 = 0x04;
            const ENGINE_STALLED: u32 = 0x08;
            const PIT_SPEED_LIMITER: u32 = 0x10;
            const REV_LIMITER_ACTIVE: u32 = 0x20;
            
            let mut warnings = Vec::new();
            if engine_warnings & WATER_TEMP_WARNING != 0 { warnings.push("WATER TEMP"); }
            if engine_warnings & FUEL_PRESSURE_WARNING != 0 { warnings.push("FUEL PRESS"); }
            if engine_warnings & OIL_PRESSURE_WARNING != 0 { warnings.push("OIL PRESS"); }
            if engine_warnings & ENGINE_STALLED != 0 { warnings.push("STALLED"); }
            if engine_warnings & PIT_SPEED_LIMITER != 0 { warnings.push("PIT LIMITER"); }
            if engine_warnings & REV_LIMITER_ACTIVE != 0 { warnings.push("REV LIMITER"); }
            
            if !warnings.is_empty() {
                display.push_str(&format!("Warnings: {}\n", warnings.join(", ")));
            }
        }
        
        // Final step - print the entire buffer in one go
        print!("{}", display);
        io::stdout().flush().unwrap();
        
        // Sleep to avoid hammering the CPU
        thread::sleep(Duration::from_millis(100));
    }
}
