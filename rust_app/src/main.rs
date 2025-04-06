mod telemetry_fields;
mod websocket_server;

use iracing::Connection;
use std::{thread, time::Duration};
use std::io::{self, stdout, Write};
use websocket_server::TelemetryWebSocketServer;
use std::time::{SystemTime, UNIX_EPOCH};

// Get timestamp function - reused from websocket_server.rs
fn get_timestamp() -> String {
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default();
    
    let secs = now.as_secs();
    let millis = now.subsec_millis();
    
    // Convert to hours, minutes, seconds in local time
    let hours = (secs % 86400) / 3600;
    let minutes = (secs % 3600) / 60;
    let seconds = secs % 60;
    
    format!("{:02}:{:02}:{:02}.{:03}", hours, minutes, seconds, millis)
}

// Function to clear the screen in a cross-platform way - NOT USED ANYMORE
#[cfg(target_os = "windows")]
fn clear_screen() {
    // This function is kept for reference but we're not using it
    // print!("\x1B[2J\x1B[1;1H");
    // stdout().flush().unwrap();
}

#[cfg(not(target_os = "windows"))]
fn clear_screen() {
    // This function is kept for reference but we're not using it
    // print!("{}[2J{}[1;1H", 27 as char, 27 as char);
    // stdout().flush().unwrap();
}

#[tokio::main]
async fn main() {
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
    
    // Initialize WebSocket server (default port 8080)
    let ws_server = TelemetryWebSocketServer::new("0.0.0.0:8080");
    if let Err(e) = ws_server.start().await {
        println!("Failed to start WebSocket server: {}", e);
        return;
    }
    
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
    println!("Starting monitoring automatically...");
    
    // Give user time before starting main loop
    for i in (1..=3).rev() {
        println!("[{}] Starting in {} seconds...", get_timestamp(), i);
        thread::sleep(Duration::from_secs(1));
    }
    
    println!("\n[{}] ▶️ Telemetry monitoring started", get_timestamp());
    
    // Main loop to display telemetry data
    loop {
        // Get telemetry sample
        let telem = match blocking.sample(Duration::from_millis(100)) {
            Ok(sample) => sample,
            Err(e) => {
                println!("[{}] Error sampling telemetry: {:?}", get_timestamp(), e);
                continue;
            }
        };
        
        // Don't clear the screen
        // clear_screen();
        
        // Extract telemetry using our trait-based approach
        let telemetry_data = telemetry_fields::extract_telemetry(&telem);
        
        // Format and display telemetry data
        let _display = telemetry_fields::format_telemetry_display(&telemetry_data);
        
        // Print the display buffer - commented out to avoid console spam
        // print!("{}", display);
        // io::stdout().flush().unwrap();
        
        // Broadcast telemetry data to WebSocket clients
        ws_server.broadcast_telemetry(&telemetry_data);
        
        // Show connected client count less frequently to avoid cluttering logs
        static mut COUNTER: u32 = 0;
        unsafe {
            COUNTER += 1;
            if COUNTER % 200 == 0 { // Reduced frequency (every ~10 seconds at 50ms intervals)
                let client_count = ws_server.client_count();
                let timestamp = get_timestamp();
                print!("\n[{}] 📊 Active WebSocket connections: {}", timestamp, client_count);
                
                // Print additional info if clients are connected
                if client_count > 0 {
                    println!(" - Data streaming to clients");
                } else {
                    println!(" - Waiting for clients to connect");
                }
                
                io::stdout().flush().unwrap();
                COUNTER = 0;
            }
        }
        
        // Sleep to avoid hammering the CPU
        thread::sleep(Duration::from_millis(50));
    }
}
