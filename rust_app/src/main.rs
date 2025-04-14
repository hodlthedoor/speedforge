mod telemetry_fields;
mod websocket_server;

use iracing::Connection;
use std::{thread, time::Duration};
use std::io::{self, stdout, Write};
use websocket_server::TelemetryWebSocketServer;
use std::time::{SystemTime, UNIX_EPOCH};
use std::sync::{Arc, Mutex};

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
    
    // Initialize WebSocket server (default port 8080)
    let ws_server = TelemetryWebSocketServer::new("0.0.0.0:8080");
    if let Err(e) = ws_server.start().await {
        println!("Failed to start WebSocket server: {}", e);
        return;
    }
    
    // Create a shared WebSocket server that can be accessed from a separate thread
    let ws_server_arc = Arc::new(ws_server);
    let ws_server_clone = ws_server_arc.clone();
    
    // Start a separate thread (not async task) for the iRacing connection
    let iracing_thread = thread::spawn(move || {
        let mut last_attempt = SystemTime::now();
        const CONNECTION_CHECK_INTERVAL: u64 = 5000; // 5 seconds between connection attempts
        let mut connection_status = "disconnected";
        
        loop {
            // Check if enough time has passed since the last attempt
            if last_attempt.elapsed().unwrap_or(Duration::from_secs(0)) >= Duration::from_millis(CONNECTION_CHECK_INTERVAL) {
                match Connection::new() {
                    Ok(conn) => {
                        if connection_status != "connected" {
                            println!("[{}] Successfully connected to iRacing!", get_timestamp());
                            connection_status = "connected";
                        }
                        
                        // Create a blocking telemetry handle
                        if let Ok(blocking) = conn.blocking() {
                            // Start monitoring telemetry
                            println!("[{}] Starting telemetry monitoring...", get_timestamp());
                            
                            // Main telemetry loop
                            loop {
                                match blocking.sample(Duration::from_millis(100)) {
                                    Ok(sample) => {
                                        let telemetry_data = telemetry_fields::extract_telemetry(&sample);
                                        match ws_server_clone.broadcast_telemetry(&telemetry_data) {
                                            Ok(_) => {},
                                            Err(e) => {
                                                println!("[{}] Error broadcasting telemetry: {}", get_timestamp(), e);
                                                // Don't break here, just log the error and continue
                                            }
                                        }
                                    },
                                    Err(e) => {
                                        println!("[{}] Error sampling telemetry: {:?}", get_timestamp(), e);
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
                            println!("[{}] Lost connection to iRacing: {}", get_timestamp(), e);
                            connection_status = "disconnected";
                        }
                    }
                }
                last_attempt = SystemTime::now();
            }
            
            // Sleep for a short time to avoid busy waiting
            thread::sleep(Duration::from_millis(100));
        }
    });
    
    // Start a background task to monitor WebSocket connections - this is safe as async
    let ws_server_for_monitoring = ws_server_arc.clone();
    tokio::spawn(async move {
        let mut last_report = SystemTime::now();
        const REPORT_INTERVAL: u64 = 10000; // 10 seconds between reports
        
        loop {
            if last_report.elapsed().unwrap_or(Duration::from_secs(0)) >= Duration::from_millis(REPORT_INTERVAL) {
                let client_count = ws_server_for_monitoring.client_count();
                println!("[{}] Status: {} WebSocket clients connected", get_timestamp(), client_count);
                last_report = SystemTime::now();
            }
            tokio::time::sleep(Duration::from_millis(1000)).await;
        }
    });
    
    // Keep the main thread alive
    println!("[{}] Telemetry service running. Waiting for iRacing connection...", get_timestamp());
    println!("Press Ctrl+C to exit.");
    
    // Wait indefinitely
    loop {
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}
