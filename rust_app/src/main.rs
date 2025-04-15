mod telemetry_fields;
mod websocket_server;

use iracing::Connection;
use std::{thread, time::Duration};
use std::{env, io};
use std::io::{stdout, Write};
use websocket_server::TelemetryWebSocketServer;
use std::time::{SystemTime, UNIX_EPOCH};
use std::sync::{Arc, Mutex};
use serde_json::Value;
use chrono;

// Global flag for verbose logging
static mut VERBOSE_LOGGING: bool = false;

// Safe wrapper to check verbose flag
fn is_verbose() -> bool {
    unsafe { VERBOSE_LOGGING }
}

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

// Enhanced logging macros
macro_rules! log_info {
    ($($arg:tt)*) => {
        println!("[{}] INFO: {}", get_timestamp(), format!($($arg)*));
    };
}

macro_rules! log_debug {
    ($($arg:tt)*) => {
        if is_verbose() {
            println!("[{}] DEBUG: {}", get_timestamp(), format!($($arg)*));
        }
    };
}

macro_rules! log_error {
    ($($arg:tt)*) => {
        eprintln!("[{}] ERROR: {}", get_timestamp(), format!($($arg)*));
    };
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

fn print_startup_info() {
    log_info!("SpeedForge iRacing Telemetry Monitor");
    log_info!("=====================================");
    
    // Print environment details
    log_debug!("Current directory: {:?}", env::current_dir().unwrap_or_default());
    log_debug!("Command line args: {:?}", env::args().collect::<Vec<_>>());
    log_debug!("Executable path: {:?}", env::current_exe().unwrap_or_default());
    
    // Print system information
    if cfg!(target_os = "windows") {
        log_debug!("Operating System: Windows");
    } else if cfg!(target_os = "macos") {
        log_debug!("Operating System: macOS");
    } else if cfg!(target_os = "linux") {
        log_debug!("Operating System: Linux");
    } else {
        log_debug!("Operating System: Unknown");
    }
    
    log_debug!("Environment variables:");
    for (key, value) in env::vars() {
        // Only log certain environment variables to avoid clutter
        if key.starts_with("RUST_") || key == "PATH" || key == "TEMP" || key == "TMP" {
            log_debug!("  {}={}", key, value);
        }
    }
}

// Add a throttled logging function to reduce output frequency
fn should_log_telemetry_update() -> bool {
    static mut LAST_TELEMETRY_LOG: u64 = 0;
    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    
    unsafe {
        // Only log telemetry updates every 5 seconds in non-verbose mode
        if now - LAST_TELEMETRY_LOG > 5 {
            LAST_TELEMETRY_LOG = now;
            return true;
        }
        // In verbose mode, we still throttle but less aggressively
        if is_verbose() && now - LAST_TELEMETRY_LOG > 1 {
            LAST_TELEMETRY_LOG = now;
            return true;
        }
        false
    }
}

#[tokio::main]
async fn main() {
    // Process command line arguments
    let args: Vec<String> = env::args().collect();
    
    // Check for verbose flag
    for arg in &args {
        if arg == "--verbose" || arg == "-v" {
            // Set global verbose flag
            unsafe {
                VERBOSE_LOGGING = true;
            }
        }
    }
    
    // Print startup information
    print_startup_info();
    
    // Initialize WebSocket server (default port 8080)
    let server_address = "0.0.0.0:8080";
    log_info!("Initializing WebSocket server on {}", server_address);
    
    let ws_server = match TelemetryWebSocketServer::new(server_address) {
        Ok(server) => server,
        Err(e) => {
            log_error!("Failed to create WebSocket server: {}", e);
            return;
        }
    };
    
    log_debug!("WebSocket server created, starting...");
    
    if let Err(e) = ws_server.start().await {
        log_error!("Failed to start WebSocket server: {}", e);
        return;
    }
    
    log_info!("WebSocket server started and running");
    
    // Create a shared WebSocket server that can be accessed from a separate thread
    let ws_server_arc = Arc::new(ws_server);
    let ws_server_clone = ws_server_arc.clone();
    
    log_debug!("Starting iRacing telemetry thread");
    
    // Start a separate thread (not async task) for the iRacing connection
    let iracing_thread = thread::spawn(move || {
        let mut last_attempt = SystemTime::now();
        const CONNECTION_CHECK_INTERVAL: u64 = 5000; // 5 seconds between connection attempts
        let mut connection_status = "disconnected";
        
        loop {
            // Check if enough time has passed since the last attempt
            if last_attempt.elapsed().unwrap_or(Duration::from_secs(0)) >= Duration::from_millis(CONNECTION_CHECK_INTERVAL) {
                log_debug!("Attempting to connect to iRacing");
                
                match Connection::new() {
                    Ok(mut conn) => {
                        if connection_status != "connected" {
                            log_info!("Successfully connected to iRacing!");
                            connection_status = "connected";
                        }
                        
                        // Get session info from the connection object
                        let session_info_str = match conn.session_info() {
                            Ok(session) => {
                                // Check if session info is actually populated
                                let session_str = format!("{:#?}", session);
                                if session_str.trim().is_empty() || session_str == "\"\"" {
                                    log_error!("Session info is empty or invalid");
                                    String::from("")
                                } else {
                                    log_debug!("Retrieved session info successfully, length: {} bytes", session_str.len());
                                    session_str
                                }
                            },
                            Err(e) => {
                                log_error!("Failed to get session info: {:?}", e);
                                String::from("")
                            }
                        };
                        
                        // Create a blocking telemetry handle
                        if let Ok(blocking) = conn.blocking() {
                            // Start monitoring telemetry
                            log_info!("Starting telemetry monitoring...");
                            
                            // Main telemetry loop
                            loop {
                                match blocking.sample(Duration::from_millis(100)) {
                                    Ok(sample) => {
                                        log_debug!("Received telemetry sample");
                                        
                                        // Extract basic telemetry data
                                        let mut telemetry_data = telemetry_fields::extract_telemetry(&sample);
                                        
                                        // Use the session info we got from the connection
                                        if !session_info_str.is_empty() {
                                            telemetry_data.session_info = session_info_str.clone();
                                        } else {
                                            // Fallback to our placeholder if session_info wasn't available
                                            telemetry_data.session_info = format!("\
---
SessionInfo:
  Sessions:
    - SessionNum: 0
      SessionType: Practice
      SessionName: Practice
      SessionStartTime: {session_time}
      SessionState: Racing
      SessionTime: {elapsed_time:.1} sec
      SessionTimeRemain: 3600.0 sec
  WeekendInfo:
    TrackName: Unknown
    TrackID: 0
    TrackLength: 0.0
    TrackDisplayName: Telemetry Connected
    TrackDisplayShortName: Connected
    TrackConfigName: Test Mode
    TrackCity: SpeedForge
    TrackCountry: Telemetry
    TrackAltitude: 0
    TrackLatitude: 0
    TrackLongitude: 0
    TrackNorthOffset: 0.0
    TrackNumTurns: 0
    TrackPitSpeedLimit: 0.0
    TrackType: Road
    TrackDirection: Clockwise
    TrackWeatherType: Constant
    TrackSkies: Clear
    TrackSurfaceTemp: {track_temp:.1}
    TrackAirTemp: {air_temp:.1}
    TrackAirPressure: 0
    TrackWindVel: {wind_vel:.1}
    TrackWindDir: {wind_dir:.1}
    TrackRelativeHumidity: {humidity:.1}
    TrackFogLevel: {fog:.1}
  DriverInfo:
    DriverCarIdx: 0
    DriverUserID: 0
    PaceCarIdx: -1
    DriverHeadPosX: 0.0
    DriverHeadPosY: 0.0
    DriverHeadPosZ: 0.0
    DriverCarIdleRPM: 0
    DriverCarRedLine: 0
    DriverCarEngCylinderCount: 0
    DriverCarFuelKgPerLtr: 0.0
    DriverCarSLFirstRPM: 0
    DriverCarSLShiftRPM: 0
    DriverCarSLLastRPM: 0
    DriverCarSLBlinkRPM: 0
note: This is simulated session info. The actual session_info was not available.",
                                session_time = chrono::Local::now().format("%Y-%m-%d %H:%M:%S"),
                                elapsed_time = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_secs_f32() % 3600.0,
                                track_temp = telemetry_data.track_temp_c,
                                air_temp = telemetry_data.air_temp_c,
                                wind_vel = telemetry_data.wind_vel_ms,
                                wind_dir = telemetry_data.wind_dir_rad * 180.0 / std::f32::consts::PI,
                                humidity = telemetry_data.humidity_pct,
                                fog = telemetry_data.fog_level_pct
                            );
                                        }
                                        
                                        // Convert TelemetryData to serde_json::Value
                                        let json_value = serde_json::to_value(&telemetry_data).unwrap_or_else(|e| {
                                            log_error!("Failed to convert telemetry data to JSON: {}", e);
                                            serde_json::json!({})
                                        });
                                        
                                        match ws_server_clone.broadcast_telemetry(&json_value) {
                                            Ok(_) => {
                                                if should_log_telemetry_update() {
                                                    log_info!("Broadcast telemetry data to {} clients", ws_server_clone.client_count());
                                                } else if is_verbose() {
                                                    log_debug!("Broadcast telemetry data to clients");
                                                }
                                            },
                                            Err(e) => {
                                                log_error!("Error broadcasting telemetry: {}", e);
                                                // Don't break here, just log the error and continue
                                            }
                                        }
                                    },
                                    Err(e) => {
                                        log_error!("Error sampling telemetry: {:?}", e);
                                        connection_status = "disconnected";
                                        break; // Exit the telemetry loop and try reconnecting
                                    }
                                }
                                thread::sleep(Duration::from_millis(50));
                            }
                        }
                    },
                    Err(e) => {
                        if connection_status != "disconnected" {
                            log_error!("Lost connection to iRacing: {}", e);
                            connection_status = "disconnected";
                        } else if is_verbose() {
                            log_debug!("Still waiting for iRacing connection: {}", e);
                        } else if should_log_telemetry_update() {
                            // Only log this message periodically when not in verbose mode
                            log_info!("Waiting for iRacing connection...");
                        }
                    }
                }
                last_attempt = SystemTime::now();
            }
            
            // Sleep for a short time to avoid busy waiting
            thread::sleep(Duration::from_millis(100));
        }
    });
    
    // Start a background task to monitor WebSocket connections
    let ws_server_for_monitoring = ws_server_arc.clone();
    tokio::spawn(async move {
        let mut last_report = SystemTime::now();
        const REPORT_INTERVAL: u64 = 30000; // 30 seconds between reports
        
        loop {
            if last_report.elapsed().unwrap_or(Duration::from_secs(0)) >= Duration::from_millis(REPORT_INTERVAL) {
                let client_count = ws_server_for_monitoring.client_count();
                log_info!("Status: {} WebSocket clients connected", client_count);
                last_report = SystemTime::now();
            }
            tokio::time::sleep(Duration::from_millis(1000)).await;
        }
    });
    
    // Keep the main thread alive
    log_info!("Telemetry service running. Waiting for iRacing connection...");
    log_info!("Press Ctrl+C to exit.");
    
    // Wait indefinitely
    loop {
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}
