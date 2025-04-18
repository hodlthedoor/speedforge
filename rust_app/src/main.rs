mod telemetry_fields;
mod websocket_server;

use iracing::telemetry::Connection;
use std::{thread, time::Duration};
use std::{env, io};
use std::io::{stdout, Write};
use websocket_server::TelemetryWebSocketServer;
use std::time::{SystemTime, UNIX_EPOCH};
use std::sync::{Arc, Mutex};
use serde_json::Value;
use chrono;
use serde_yaml;

// Create a direct wrapper for lower-level iRacing SDK access 
// This is a workaround to bypass the ResultsPositions deserialization issue
#[cfg(target_os = "windows")]
mod iracing_wrapper {
    use std::result::Result;
    use std::error::Error;
    use iracing::telemetry::Connection;
    use std::fs::File;
    use std::io::Write;
    
    pub fn get_raw_session_info(conn: &mut Connection) -> Result<String, Box<dyn Error>> {
        // We're going to take a different approach - try to get the raw data directly from the SDK
        // Instead of parsing through serde_yaml, we'll just dump whatever we get
        
        // This uses internal details of the Connection type, which is unsafe
        // but necessary to bypass the parsing error
        #[cfg(feature = "telemetry")]
        unsafe {
            use iracing::sys::*;
            
            let mut data_len: i32 = 0;
            let c_str = irsdk_getSessionInfoStr();
            
            if !c_str.is_null() {
                while *c_str.offset(data_len as isize) != 0 {
                    data_len += 1;
                }
                
                if data_len > 0 {
                    // Got data, now copy it
                    let yaml_bytes = std::slice::from_raw_parts(c_str as *const u8, data_len as usize);
                    if let Ok(yaml_str) = String::from_utf8(yaml_bytes.to_vec()) {
                        // Save the raw YAML to a file without any parsing
                        let now = chrono::Local::now();
                        let filename = format!("raw_iracing_yaml_{}.yaml", now.format("%Y%m%d_%H%M%S"));
                        
                        if let Ok(mut file) = File::create(&filename) {
                            if file.write_all(yaml_str.as_bytes()).is_ok() {
                                // Log success
                                println!("[INFO] Saved raw iRacing YAML to {}", filename);
                            }
                        }
                        
                        return Ok(yaml_str);
                    }
                }
            }
        }
        
        // Fallback to the original method if the direct access fails
        match conn.session_info() {
            Ok(session) => {
                // Convert to debug format
                let raw_str = format!("{:?}", session);
                Ok(raw_str)
            },
            Err(e) => {
                // Convert the error to a string to avoid trait issues
                let error_str = format!("Session info error: {}", e);
                Err(error_str.into())
            }
        }
    }
}

#[cfg(not(target_os = "windows"))]
mod iracing_wrapper {
    use std::result::Result;
    use std::error::Error;
    use iracing::telemetry::Connection;
    use std::fs::File;
    use std::io::Write;
    
    pub fn get_raw_session_info(_conn: &mut Connection) -> Result<String, Box<dyn Error>> {
        // On non-Windows platforms, this is just a stub that returns an error
        let error_msg = "iRacing SDK not available on non-Windows platforms";
        println!("[DEBUG] {} - Stub implementation called.", error_msg);
        
        // Create a dummy YAML file for testing
        let yaml_content = r#"---
WeekendInfo:
  TrackName: Test Track
  TrackID: 123
  TrackLength: "4.5 km"
  # Additional fields would be here
SessionInfo:
  Sessions:
    - SessionNum: 0
      SessionType: Practice
      # Additional fields would be here
DriverInfo:
  Drivers:
    - CarIdx: 0
      UserName: "Test Driver"
      # The LicLevel field is intentionally missing
      CarID: 123
      # Additional fields would be here
"#;

        // Save the test YAML to a file
        let now = chrono::Local::now();
        let filename = format!("test_yaml_{}.yaml", now.format("%Y%m%d_%H%M%S"));
        
        if let Ok(mut file) = File::create(&filename) {
            if file.write_all(yaml_content.as_bytes()).is_ok() {
                // Log success
                println!("[INFO] Saved test YAML to {}", filename);
            }
        }
        
        Err(error_msg.into())
    }
}

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

// Helper function to get fallback session info
fn get_fallback_session_info(
    track_temp_c: f32, 
    air_temp_c: f32, 
    wind_vel_ms: f32, 
    wind_dir_rad: f32, 
    humidity_pct: f32, 
    fog_level_pct: f32
) -> String {
    format!("\
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
        track_temp = track_temp_c,
        air_temp = air_temp_c,
        wind_vel = wind_vel_ms,
        wind_dir = wind_dir_rad * 180.0 / std::f32::consts::PI,
        humidity = humidity_pct,
        fog = fog_level_pct
    )
}

// Add this function before main()
fn save_session_yaml_to_file(yaml_data: &str) -> Result<(), std::io::Error> {
    use std::fs::File;
    use std::io::Write;
    
    // Create the filename with timestamp to avoid overwriting
    let now = chrono::Local::now();
    let filename = format!("session_data_{}.yaml", now.format("%Y%m%d_%H%M%S"));
    
    log_info!("Saving session data to file: {}", filename);
    
    // Write the data to file
    let mut file = File::create(&filename)?;
    file.write_all(yaml_data.as_bytes())?;
    
    log_info!("Successfully wrote {} bytes to {}", yaml_data.len(), filename);
    Ok(())
}

// Add this new function to create a string debug dump of any value
fn debug_to_file(label: &str, data: impl std::fmt::Debug) -> std::io::Result<()> {
    use std::fs::File;
    use std::io::Write;
    
    let filename = format!("debug_{}_{}.txt", label, chrono::Local::now().format("%Y%m%d_%H%M%S"));
    let mut file = File::create(&filename)?;
    
    // Write the debug representation to file
    writeln!(file, "{:#?}", data)?;
    
    log_info!("Wrote debug info to {}", filename);
    Ok(())
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
    
    // Check if we're running on Windows, as iRacing SDK only works on Windows
    if !cfg!(target_os = "windows") {
        log_error!("iRacing SDK only works on Windows OS");
        log_info!("Running in simulation mode since this is not Windows");
        log_info!("Real iRacing telemetry and session data will not be available");
    }
    
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
    
    // Set WebSocket server to verbose mode if we're in verbose mode
    ws_server.set_verbose_mode(is_verbose());
    
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
                        
                        // Always log session info attempt in normal mode too
                        log_info!("Attempting to get raw iRacing session info directly...");
                        
                        // First get the raw session info string directly, bypassing the problematic deserialization
                        let raw_yaml = match iracing_wrapper::get_raw_session_info(&mut conn) {
                            Ok(raw_str) => {
                                log_info!("Successfully retrieved raw session info, length: {} bytes", raw_str.len());
                                
                                // Print a preview of the raw data
                                let preview = if raw_str.len() > 200 {
                                    &raw_str[0..200]
                                } else {
                                    &raw_str
                                };
                                log_info!("Raw session info preview: {}", preview);
                                
                                // Save the raw debug string to file
                                if let Err(e) = debug_to_file("session_raw", &raw_str) {
                                    log_error!("Failed to write debug file: {}", e);
                                }
                                
                                // Also save using our normal function
                                if let Err(e) = save_session_yaml_to_file(&raw_str) {
                                    log_error!("Failed to save session YAML to file: {}", e);
                                }
                                
                                // Use the raw string directly, we'll handle parsing issues in the UI
                                raw_str
                            },
                            Err(e) => {
                                // If we couldn't get the raw data, try a fallback approach
                                log_error!("Failed to get raw session info: {:?}", e);
                                log_info!("Attempting fallback...");
                                
                                String::new()
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
                                        // Only log samples in verbose mode
                                        if is_verbose() {
                                            log_debug!("Received telemetry sample");
                                        }
                                        
                                        // Extract basic telemetry data
                                        let mut telemetry_data = telemetry_fields::extract_telemetry(&sample);
                                        
                                        // Use the session info we got from the connection
                                        if !raw_yaml.is_empty() {
                                            telemetry_data.session_info = raw_yaml.clone();
                                            
                                            // Periodically log that we're using real session data
                                            if should_log_telemetry_update() {
                                                log_info!("Using raw session info data in telemetry");
                                            }
                                        } else {
                                            // Periodically try to get session info again if it failed before
                                            static mut LAST_SESSION_RETRY: u64 = 0;
                                            let now = SystemTime::now()
                                                .duration_since(UNIX_EPOCH)
                                                .unwrap_or_default()
                                                .as_secs();
                                                
                                            let should_retry = unsafe {
                                                if now - LAST_SESSION_RETRY > 30 {
                                                    LAST_SESSION_RETRY = now;
                                                    true
                                                } else {
                                                    false
                                                }
                                            };
                                            
                                            if should_retry {
                                                log_info!("Retrying to get raw session info...");
                                                match iracing_wrapper::get_raw_session_info(&mut conn) {
                                                    Ok(raw_str) => {
                                                        log_info!("Retry: Raw session info length: {} bytes", raw_str.len());
                                                        // Dump a preview of the data for debugging
                                                        let preview = if raw_str.len() > 200 {
                                                            &raw_str[0..200]
                                                        } else {
                                                            &raw_str
                                                        };
                                                        log_info!("Retry: Session info preview: {}", preview);
                                                        
                                                        // Save the raw YAML to a file on successful retry
                                                        if let Err(e) = save_session_yaml_to_file(&raw_str) {
                                                            log_error!("Failed to save session YAML to file on retry: {}", e);
                                                        }
                                                        
                                                        // Update the telemetry data with the new session info
                                                        telemetry_data.session_info = raw_str;
                                                        log_info!("Updated telemetry with new session info");
                                                    },
                                                    Err(e) => {
                                                        log_error!("Retry: Failed to get raw session info: {:?}", e);
                                                        
                                                        // Use fallback data since we don't have real session info
                                                        telemetry_data.session_info = get_fallback_session_info(
                                                            telemetry_data.track_temp_c,
                                                            telemetry_data.air_temp_c,
                                                            telemetry_data.wind_vel_ms,
                                                            telemetry_data.wind_dir_rad,
                                                            telemetry_data.humidity_pct,
                                                            telemetry_data.fog_level_pct
                                                        );
                                                    }
                                                }
                                            } else {
                                                // If we're not retrying this time, use the fallback
                                                telemetry_data.session_info = get_fallback_session_info(
                                                    telemetry_data.track_temp_c,
                                                    telemetry_data.air_temp_c,
                                                    telemetry_data.wind_vel_ms,
                                                    telemetry_data.wind_dir_rad,
                                                    telemetry_data.humidity_pct,
                                                    telemetry_data.fog_level_pct
                                                );
                                            }
                                        }
                                        
                                        // Convert TelemetryData to serde_json::Value
                                        let json_value = serde_json::to_value(&telemetry_data).unwrap_or_else(|e| {
                                            log_error!("Failed to convert telemetry data to JSON: {}", e);
                                            serde_json::json!({})
                                        });
                                        
                                        match ws_server_clone.broadcast_telemetry(&json_value) {
                                            Ok(_) => {
                                                // Only log broadcasts in verbose mode or periodically
                                                if should_log_telemetry_update() {
                                                    log_info!("Broadcast telemetry data to {} clients", ws_server_clone.client_count());
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

