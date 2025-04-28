use crate::telemetry_fields::TelemetryData;
use futures_util::{SinkExt, StreamExt};
use std::collections::HashSet;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc::{self, UnboundedSender};
use tokio_tungstenite::{accept_async, tungstenite::Message};
use std::hash::Hasher;
use std::time::{SystemTime, UNIX_EPOCH};
use std::io::{self, Write};
use std::error::Error;

// Remove incorrect import
// extern crate crate as main_crate;
// use main_crate::is_verbose;

// Track verbose mode
static mut WEBSOCKET_VERBOSE_MODE: bool = false;

// Safe wrapper for verbose mode
fn ws_is_verbose() -> bool {
    unsafe { WEBSOCKET_VERBOSE_MODE }
}

/// A wrapper for UnboundedSender that implements Hash and Eq
#[derive(Clone)]
struct ClientSender(UnboundedSender<Message>);

impl ClientSender {
    fn new(tx: UnboundedSender<Message>) -> Self {
        ClientSender(tx)
    }
}

impl PartialEq for ClientSender {
    fn eq(&self, other: &Self) -> bool {
        // Each sender has a unique address in memory that we can use for comparison
        std::ptr::eq(&self.0, &other.0)
    }
}

impl Eq for ClientSender {}

impl std::hash::Hash for ClientSender {
    fn hash<H: std::hash::Hasher>(&self, state: &mut H) {
        // Hash based on the memory address of the sender
        let ptr = &self.0 as *const _ as usize;
        ptr.hash(state);
    }
}

/// Type alias for a set of WebSocket clients
type Clients = Arc<Mutex<HashSet<ClientSender>>>;

/// Represents a WebSocket server that broadcasts telemetry data
#[derive(Clone)]
pub struct TelemetryWebSocketServer {
    clients: Arc<Mutex<HashSet<ClientSender>>>,
    address: String,
}

impl TelemetryWebSocketServer {
    /// Create a new WebSocket server
    pub fn new(address: &str) -> Result<Self, Box<dyn Error>> {
        println!("[{}] Creating WebSocket server on {}", get_timestamp(), address);
        Ok(TelemetryWebSocketServer {
            address: address.to_string(),
            clients: Arc::new(Mutex::new(HashSet::new())),
        })
    }
    
    /// Set verbose mode for WebSocket server
    pub fn set_verbose_mode(&self, verbose: bool) {
        unsafe {
            WEBSOCKET_VERBOSE_MODE = verbose;
        }
    }
    
    /// Start the WebSocket server
    pub async fn start(&self) -> Result<(), Box<dyn Error>> {
        // Parse the address string to a SocketAddr
        let addr: SocketAddr = self.address.parse()
            .map_err(|e| {
                eprintln!("[{}] Failed to parse address {}: {}", get_timestamp(), self.address, e);
                e
            })?;

        // Clone clients for the task
        let clients = self.clients.clone();

        println!("[{}] Starting WebSocket server on: {}", get_timestamp(), self.address);
        
        // Spawn a task to listen for incoming WebSocket connections
        tokio::spawn(async move {
            // Create the TCP listener
            let listener = match TcpListener::bind(addr).await {
                Ok(listener) => {
                    println!("[{}] WebSocket server listening on: {}", get_timestamp(), addr);
                    listener
                },
                Err(e) => {
                    eprintln!("[{}] Failed to bind WebSocket server to {}: {}", get_timestamp(), addr, e);
                    return;
                }
            };

            // Accept connections in a loop
            loop {
                match listener.accept().await {
                    Ok((stream, addr)) => {
                        // Only log new connections if verbose
                        if ws_is_verbose() {
                            let timestamp = get_timestamp();
                            println!("\n[{}] 🔌 New WebSocket connection attempt from: {}", timestamp, addr);
                        }
                        
                        // Clone clients for this connection
                        let clients = clients.clone();
                        
                        // Handle the connection in a separate task
                        tokio::spawn(async move {
                            if let Err(e) = handle_connection(stream, addr, clients).await {
                                eprintln!("[{}] Error handling WebSocket connection from {}: {}", 
                                    get_timestamp(), addr, e);
                            }
                        });
                    },
                    Err(e) => {
                        eprintln!("[{}] Error accepting connection: {}", get_timestamp(), e);
                        // Short sleep to avoid spinning in case of persistent errors
                        tokio::time::sleep(tokio::time::Duration::from_millis(100)).await;
                    }
                }
            }
        });

        Ok(())
    }
    
    /// Broadcast telemetry data to all connected clients
    pub fn broadcast_telemetry(&self, telemetry: &TelemetryData) {
        let clients = self.clients.lock().unwrap();
        if clients.is_empty() {
            return;
        }

        let message = serde_json::to_string(&telemetry).unwrap();
        
        // Send to each connected client
        for client in clients.iter() {
            if let Err(e) = client.0.send(Message::Text(message.clone())) {
                eprintln!("Error sending telemetry: {:?}", e);
            }
        }
    }
    
    /// Get the current number of connected clients
    pub fn client_count(&self) -> usize {
        if let Ok(clients) = self.clients.lock() {
            clients.len()
        } else {
            0
        }
    }
}

// Helper function to get a timestamp string
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

/// Handle an individual WebSocket connection
async fn handle_connection(
    stream: TcpStream, 
    addr: SocketAddr, 
    clients: Arc<Mutex<HashSet<ClientSender>>>
) -> Result<(), Box<dyn Error>> {
    let timestamp = get_timestamp();
    
    // Perform WebSocket handshake
    let ws_stream = match tokio_tungstenite::accept_async(stream).await {
        Ok(ws_stream) => {
            // Only log handshake completion if verbose
            if ws_is_verbose() {
                println!("[{}] 🤝 WebSocket handshake completed with {}", timestamp, addr);
            }
            ws_stream
        },
        Err(e) => {
            println!("[{}] ❌ Error during WebSocket handshake with {}: {}", timestamp, addr, e);
            return Err(Box::new(e));
        }
    };
    
    // Create a channel for sending messages to this client
    let (tx, mut rx) = tokio::sync::mpsc::unbounded_channel();
    let client_sender = ClientSender::new(tx);
    
    // Add the new client to our client set
    {
        // Only log client addition if verbose
        if ws_is_verbose() {
            println!("[{}] 👨‍👩‍👧‍👦 Adding client {} to client pool", timestamp, addr);
        }
        let mut clients = clients.lock().unwrap();
        clients.insert(client_sender.clone());
        println!("[{}] ℹ️ Now serving {} clients", timestamp, clients.len());
    }
    
    // Split WebSocket stream into sender and receiver
    let (ws_sender, ws_receiver) = ws_stream.split();
    
    // Task that forwards messages from the channel to the WebSocket
    let mut send_task = tokio::spawn(async move {
        let mut ws_sender = ws_sender;
        while let Some(msg) = rx.recv().await {
            if let Err(e) = ws_sender.send(msg).await {
                println!("[{}] 📤 Error sending message to {}: {}", get_timestamp(), addr, e);
                break;
            }
        }
    });
    
    // Process incoming WebSocket messages
    let mut recv_task = tokio::spawn(async move {
        let mut ws_receiver = ws_receiver;
        while let Some(result) = ws_receiver.next().await {
            match result {
                Ok(msg) => {
                    if msg.is_close() {
                        if ws_is_verbose() {
                            println!("[{}] 👋 Received close message from {}", get_timestamp(), addr);
                        }
                        break;
                    }
                    
                    // Handle other message types as needed, only log if verbose
                    if ws_is_verbose() && (msg.is_text() || msg.is_binary()) {
                        println!("[{}] 📥 Received message from {}", get_timestamp(), addr);
                        // In the future we might process client messages here
                    }
                },
                Err(e) => {
                    println!("[{}] ❌ Error receiving message from {}: {}", get_timestamp(), addr, e);
                    break;
                }
            }
        }
        
        if ws_is_verbose() {
            println!("[{}] 🔌 Client {} disconnected", get_timestamp(), addr);
        }
    });
    
    // Wait for either task to complete - this means the connection is closing
    tokio::select! {
        _ = &mut send_task => {},
        _ = &mut recv_task => {},
    }
    
    // Clean up the client when they disconnect
    {
        let mut clients = clients.lock().unwrap();
        clients.remove(&client_sender);
        // Only log client removal if verbose
        if ws_is_verbose() {
            println!("[{}] 👋 Removed client {}. Now serving {} clients", 
                    get_timestamp(), addr, clients.len());
        }
    }
    
    Ok(())
} 