use crate::telemetry_fields::TelemetryData;
use futures_util::{SinkExt, StreamExt};
use std::collections::HashSet;
use std::net::SocketAddr;
use std::sync::{Arc, Mutex};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc::{self, UnboundedSender};
use tokio_tungstenite::{accept_async, tungstenite::Message};
use std::hash::{Hash, Hasher};

/// A wrapper for UnboundedSender that implements Hash and Eq
#[derive(Clone)]
struct ClientSender {
    id: usize,
    sender: UnboundedSender<String>,
}

impl ClientSender {
    fn new(sender: UnboundedSender<String>) -> Self {
        // Use the pointer address as a unique ID
        let id = &sender as *const _ as usize;
        Self { id, sender }
    }
    
    fn send(&self, msg: String) -> Result<(), mpsc::error::SendError<String>> {
        self.sender.send(msg)
    }
}

impl PartialEq for ClientSender {
    fn eq(&self, other: &Self) -> bool {
        self.id == other.id
    }
}

impl Eq for ClientSender {}

impl Hash for ClientSender {
    fn hash<H: Hasher>(&self, state: &mut H) {
        self.id.hash(state);
    }
}

/// Type alias for a set of WebSocket clients
type Clients = Arc<Mutex<HashSet<ClientSender>>>;

/// Represents a WebSocket server that broadcasts telemetry data
pub struct TelemetryWebSocketServer {
    clients: Clients,
    address: SocketAddr,
}

impl TelemetryWebSocketServer {
    /// Create a new WebSocket server
    pub fn new(address: &str) -> Self {
        let addr: SocketAddr = address.parse().expect("Failed to parse address");
        let clients = Arc::new(Mutex::new(HashSet::new()));
        
        Self {
            clients,
            address: addr,
        }
    }
    
    /// Start the WebSocket server
    pub async fn start(&self) -> Result<(), Box<dyn std::error::Error>> {
        let listener = TcpListener::bind(&self.address).await?;
        println!("WebSocket server listening on: {}", self.address);
        
        let clients = self.clients.clone();
        
        // Accept incoming connections
        tokio::spawn(async move {
            while let Ok((stream, addr)) = listener.accept().await {
                println!("New WebSocket connection: {}", addr);
                let clients = clients.clone();
                tokio::spawn(handle_connection(stream, addr, clients));
            }
        });
        
        Ok(())
    }
    
    /// Broadcast telemetry data to all connected clients
    pub fn broadcast_telemetry(&self, data: &TelemetryData) {
        if let Ok(json_string) = serde_json::to_string(data) {
            // Remove clients that fail to receive messages
            let mut disconnected = Vec::new();
            
            if let Ok(mut clients) = self.clients.lock() {
                for client in clients.iter() {
                    if let Err(_) = client.send(json_string.clone()) {
                        disconnected.push(client.clone());
                    }
                }
                
                // Remove disconnected clients
                for client in disconnected.iter() {
                    clients.remove(client);
                }
                
                if !disconnected.is_empty() {
                    println!("Removed {} disconnected clients, {} remaining", 
                        disconnected.len(), clients.len());
                }
            }
        }
    }
    
    /// Get the current number of connected clients
    pub fn client_count(&self) -> usize {
        self.clients.lock().map(|c| c.len()).unwrap_or(0)
    }
}

/// Handle an individual WebSocket connection
async fn handle_connection(stream: TcpStream, addr: SocketAddr, clients: Clients) {
    let ws_stream = match accept_async(stream).await {
        Ok(ws) => ws,
        Err(e) => {
            println!("Error during WebSocket handshake: {}", e);
            return;
        }
    };
    
    let (mut ws_sender, mut ws_receiver) = ws_stream.split();
    let (tx, mut rx) = mpsc::unbounded_channel();
    
    // Add new client to the set
    let client_sender = ClientSender::new(tx.clone());
    clients.lock().unwrap().insert(client_sender.clone());
    println!("Client connected: {}", addr);
    
    // Task that forwards messages from the channel to the WebSocket
    let forward_task = tokio::spawn(async move {
        while let Some(msg) = rx.recv().await {
            if let Err(e) = ws_sender.send(Message::Text(msg)).await {
                println!("Error sending message to {}: {}", addr, e);
                break;
            }
        }
    });
    
    // Process incoming WebSocket messages
    let receive_task = tokio::spawn(async move {
        while let Some(result) = ws_receiver.next().await {
            match result {
                Ok(msg) => {
                    if msg.is_close() {
                        break;
                    }
                    
                    // Optional: Handle client commands here if needed
                    if let Ok(text) = msg.to_text() {
                        println!("Received message from {}: {}", addr, text);
                        
                        // Example command handling
                        if text == "ping" {
                            let _ = tx.send("pong".to_string());
                        }
                    }
                }
                Err(e) => {
                    println!("Error from {}: {}", addr, e);
                    break;
                }
            }
        }
        
        // Client disconnected or error occurred
        println!("Client disconnected: {}", addr);
        if let Ok(mut clients_lock) = clients.lock() {
            clients_lock.remove(&client_sender);
        }
    });
    
    // Wait for either task to complete
    tokio::select! {
        _ = forward_task => {},
        _ = receive_task => {},
    }
} 