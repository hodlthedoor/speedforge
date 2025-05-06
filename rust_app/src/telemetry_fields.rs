use serde::{Serialize, Deserialize};
use std::collections::HashMap;
use iracing::telemetry::Value;
use std::convert::TryInto;
use std::f32::consts::PI;

/// Represents car left/right indicators from iRacing SDK
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub enum CarLeftRight {
    Off,
    Clear,       // no cars around us
    CarLeft,     // there is a car to our left
    CarRight,    // there is a car to our right
    CarLeftRight, // there are cars on each side
    TwoCarsLeft, // there are two cars to our left
    TwoCarsRight // there are two cars to our right
}

impl Default for CarLeftRight {
    fn default() -> Self {
        Self::Off
    }
}

/// Engine warning flags from iRacing SDK
#[derive(Serialize, Deserialize, Clone, Debug, PartialEq, Eq)]
pub struct EngineWarnings {
    pub water_temp_warning: bool,
    pub fuel_pressure_warning: bool,
    pub oil_pressure_warning: bool,
    pub engine_stalled: bool,
    pub pit_speed_limiter: bool,
    pub rev_limiter_active: bool,
    pub oil_temp_warning: bool,
    pub raw_value: u32,
}

impl Default for EngineWarnings {
    fn default() -> Self {
        Self {
            water_temp_warning: false,
            fuel_pressure_warning: false,
            oil_pressure_warning: false,
            engine_stalled: false,
            pit_speed_limiter: false,
            rev_limiter_active: false,
            oil_temp_warning: false,
            raw_value: 0,
        }
    }
}

/// Represents all telemetry data organized into logical sections
#[derive(Serialize, Deserialize, Default, Clone, Debug)]
pub struct TelemetryData {
    // Car State
    pub speed_kph: f32,
    pub speed_mph: f32,
    pub rpm: f32,
    pub gear: String,
    pub gear_num: i32,
    pub velocity_ms: f32,
    pub shift_indicator_pct: f32,
    pub on_pit_road: bool,
    pub track_surface: String,
    pub PlayerTrackSurface: i32,  // Raw numeric value
    pub car_left_right: CarLeftRight, // Cars to left/right indicator
    pub car_left_right_raw: i32,  // Raw numeric value for car_left_right
    pub BrakeABSactive: bool,     // ABS activation status
    
    // Engine Warnings
    pub engine_warnings: EngineWarnings,
    
    // Velocity Vectors (Car Local Coordinates)
    pub VelocityX: f32,     // Forward/backward velocity (car's local X axis)
    pub VelocityY: f32,     // Left/right velocity (car's local Y axis)
    pub VelocityZ: f32,     // Up/down velocity (car's local Z axis)
    
    // Driver Inputs
    pub throttle_pct: f32,
    pub brake_pct: f32,
    pub clutch_pct: f32,
    pub steering_angle_deg: f32,
    
    // Dynamics
    pub lateral_accel_ms2: f32,
    pub longitudinal_accel_ms2: f32,
    pub vertical_accel_ms2: f32,
    pub yaw_rate_deg_s: f32,
    pub g_force_lat: f32,
    pub g_force_lon: f32,
    pub car_slip_angle_deg: f32,
    
    // Track Position
    pub lap_dist_pct: f32,
    pub lap_dist: f32,
    
    // Location
    pub lat: f64,
    pub lon: f64,
    
    // Timing
    pub current_lap_time: f32,
    pub last_lap_time: f32,
    pub best_lap_time: f32,
    pub lap_completed: i32,
    pub delta_best: f32,
    pub delta_session_best: f32,
    pub delta_optimal: f32,
    pub position: i32,
    pub incident_count: i32, // PlayerCarDriverIncidentCount
    
    // Fuel & Temps
    pub fuel_level: f32,
    pub fuel_pct: f32,
    pub fuel_use_per_hour: f32,
    pub track_temp_c: f32,
    pub air_temp_c: f32,
    pub water_temp_c: f32,
    pub oil_temp_c: f32,
    pub humidity_pct: f32,
    pub fog_level_pct: f32,
    pub wind_vel_ms: f32,
    pub wind_dir_rad: f32,
    pub skies: String,
    
    // Tires
    pub tire_temps_c: [f32; 4],     // LF, RF, LR, RR
    pub tire_pressures_kpa: [f32; 4],
    pub ride_height_mm: [f32; 4],
    pub wheel_rpm: [f32; 4],
    pub brake_temps_c: [f32; 4],
    
    // Suspension
    pub shock_defl_mm: [f32; 4],
    
    // Damage
    pub repair_required_sec: f32,
    pub opt_repair_sec: f32,
    
    // Flags
    pub session_flags: u32,
    pub active_flags: Vec<String>,
    pub warnings: Vec<String>,
    
    // Session Info - Raw YAML string from iRacing
    pub session_info: String,
    
    // Raw values for any values that were captured
    #[serde(skip_serializing_if = "HashMap::is_empty")]
    pub raw_values: HashMap<String, serde_json::Value>,
    
    // CarIdx fields (arrays with data for each car)
    // These will be set from raw_values during extraction but appear at top level in JSON
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxPosition: Option<Vec<i32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxLapDistPct: Option<Vec<f32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxLap: Option<Vec<i32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxLapCompleted: Option<Vec<i32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxF2Time: Option<Vec<f32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxClassPosition: Option<Vec<i32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxClass: Option<Vec<i32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxGear: Option<Vec<i32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxRPM: Option<Vec<f32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxOnPitRoad: Option<Vec<bool>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxP2P_Count: Option<Vec<i32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxP2P_Status: Option<Vec<bool>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxBestLapNum: Option<Vec<i32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxBestLapTime: Option<Vec<f32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxEstTime: Option<Vec<f32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxFastRepairsUsed: Option<Vec<i32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxPaceFlags: Option<Vec<i32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxPaceLine: Option<Vec<i32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxPaceRow: Option<Vec<i32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxQualTireCompound: Option<Vec<i32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxQualTireCompoundLocked: Option<Vec<bool>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxSteer: Option<Vec<f32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxTireCompound: Option<Vec<i32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxTrackSurface: Option<Vec<i32>>,
    
    #[serde(skip_serializing_if = "Option::is_none")]
    pub CarIdxTrackSurfaceMaterial: Option<Vec<i32>>,
    
    // New field for SessionTime
    pub SessionTime: f32,
}

/// Flag constants based on iRacing SDK
pub const FLAG_CHECKERED: u32 = 0x00000001;
pub const FLAG_WHITE: u32 = 0x00000002;
pub const FLAG_GREEN: u32 = 0x00000004;
pub const FLAG_YELLOW: u32 = 0x00000008;
pub const FLAG_RED: u32 = 0x00000010;
pub const FLAG_BLUE: u32 = 0x00000020;
pub const FLAG_BLACK: u32 = 0x00000040;
pub const FLAG_BLACK_WHITE: u32 = 0x00000080;

/// Engine warning constants based on iRacing SDK
pub const ENGINE_WATER_TEMP_WARNING: u32 = 0x0001;
pub const ENGINE_FUEL_PRESSURE_WARNING: u32 = 0x0002;
pub const ENGINE_OIL_PRESSURE_WARNING: u32 = 0x0004;
pub const ENGINE_STALLED: u32 = 0x0008;
pub const ENGINE_PIT_SPEED_LIMITER: u32 = 0x0010;
pub const ENGINE_REV_LIMITER_ACTIVE: u32 = 0x0020;
pub const ENGINE_OIL_TEMP_WARNING: u32 = 0x0040;

/// Convert any telemetry value to a serde_json Value for storage
fn telemetry_value_to_json(value: Value) -> serde_json::Value {
    match value {
        Value::BOOL(b) => serde_json::json!(b),
        Value::INT(i) => serde_json::json!(i),
        Value::BITS(b) => serde_json::json!(b),
        Value::FLOAT(f) => serde_json::json!(f),
        Value::DOUBLE(d) => serde_json::json!(d),
        Value::CHAR(c) => serde_json::json!(c.to_string()),
        _ => serde_json::json!(null),
    }
}

/// Extract all telemetry data from an iRacing telemetry sample
pub fn extract_telemetry(telem: &iracing::telemetry::Sample) -> TelemetryData {
    use iracing::telemetry::Value;
    
    let mut data = TelemetryData::default();
    let mut raw_values = HashMap::new();
    
    // Extract Car State - Direct call approach without closures
    // Speed data
    if let Ok(speed) = telem.get("Speed") {
        if let Ok(speed_val) = TryInto::<f32>::try_into(speed) {
            let speed_f32: f32 = speed_val;
            raw_values.insert("Speed".to_string(), serde_json::json!(speed_f32));
            data.speed_kph = speed_f32 * 3.6; // Convert to km/h
            data.speed_mph = speed_f32 * 2.23694; // Convert to mph
        }
    }
    
    // Extract BrakeABSactive status
    if let Ok(abs_active) = telem.get("BrakeABSactive") {
        if let Ok(abs_val) = TryInto::<bool>::try_into(abs_active) {
            raw_values.insert("BrakeABSactive".to_string(), serde_json::json!(abs_val));
            data.BrakeABSactive = abs_val;
        }
    }
    
    // Extract CarLeftRight status
    if let Ok(car_left_right) = telem.get("CarLeftRight") {
        if let Ok(car_lr_val) = TryInto::<i32>::try_into(car_left_right) {
            // Store raw value
            raw_values.insert("CarLeftRight".to_string(), serde_json::json!(car_lr_val));
            data.car_left_right_raw = car_lr_val;
            
            // Convert to our enum representation
            data.car_left_right = match car_lr_val {
                0 => CarLeftRight::Off,
                1 => CarLeftRight::Clear,      // no cars around us
                2 => CarLeftRight::CarLeft,    // there is a car to our left
                3 => CarLeftRight::CarRight,   // there is a car to our right
                4 => CarLeftRight::CarLeftRight, // there are cars on each side
                5 => CarLeftRight::TwoCarsLeft, // there are two cars to our left
                6 => CarLeftRight::TwoCarsRight, // there are two cars to our right
                _ => CarLeftRight::Off,        // default for unknown values
            };
        }
    }
    
    // Extract Engine Warnings
    if let Ok(engine_warnings) = telem.get("EngineWarnings") {
        if let Ok(warnings_val) = TryInto::<u32>::try_into(engine_warnings) {
            // Store raw value
            raw_values.insert("EngineWarnings".to_string(), serde_json::json!(warnings_val));
            
            // Process engine warnings
            data.engine_warnings = EngineWarnings {
                water_temp_warning: (warnings_val & ENGINE_WATER_TEMP_WARNING) != 0,
                fuel_pressure_warning: (warnings_val & ENGINE_FUEL_PRESSURE_WARNING) != 0,
                oil_pressure_warning: (warnings_val & ENGINE_OIL_PRESSURE_WARNING) != 0,
                engine_stalled: (warnings_val & ENGINE_STALLED) != 0,
                pit_speed_limiter: (warnings_val & ENGINE_PIT_SPEED_LIMITER) != 0,
                rev_limiter_active: (warnings_val & ENGINE_REV_LIMITER_ACTIVE) != 0,
                oil_temp_warning: (warnings_val & ENGINE_OIL_TEMP_WARNING) != 0,
                raw_value: warnings_val,
            };
        }
    }
    
    // Extract CarIdx (Car Index) fields - These are arrays with data for all cars
    let car_idx_fields = [
        "CarIdxPosition", "CarIdxLapDistPct", "CarIdxLap", "CarIdxLapCompleted",
        "CarIdxF2Time", "CarIdxClassPosition", "CarIdxClass", "CarIdxGear",
        "CarIdxRPM", "CarIdxOnPitRoad", "CarIdxP2P_Count", "CarIdxP2P_Status",
        "CarIdxBestLapNum", "CarIdxBestLapTime", "CarIdxEstTime", "CarIdxFastRepairsUsed",
        "CarIdxPaceFlags", "CarIdxPaceLine", "CarIdxPaceRow", "CarIdxQualTireCompound",
        "CarIdxQualTireCompoundLocked", "CarIdxSteer", "CarIdxTireCompound",
        "CarIdxTrackSurface", "CarIdxTrackSurfaceMaterial"
    ];
    
    // Process each CarIdx field
    for field_name in car_idx_fields.iter() {
        if let Ok(value) = telem.get(field_name) {
            match value {
                Value::IntVec(values) => {
                    // Only include fields with actual data (non-empty arrays)
                    if !values.is_empty() {
                        // Convert Vec<i32> to JSON array
                        let json_array: Vec<i32> = values.clone();
                        raw_values.insert(field_name.to_string(), serde_json::json!(json_array));
                        
                        // Set the actual struct field based on field name
                        match *field_name {
                            "CarIdxPosition" => data.CarIdxPosition = Some(json_array),
                            "CarIdxLap" => data.CarIdxLap = Some(json_array),
                            "CarIdxLapCompleted" => data.CarIdxLapCompleted = Some(json_array),
                            "CarIdxClassPosition" => data.CarIdxClassPosition = Some(json_array),
                            "CarIdxClass" => data.CarIdxClass = Some(json_array),
                            "CarIdxGear" => data.CarIdxGear = Some(json_array),
                            "CarIdxP2P_Count" => data.CarIdxP2P_Count = Some(json_array),
                            "CarIdxBestLapNum" => data.CarIdxBestLapNum = Some(json_array),
                            "CarIdxFastRepairsUsed" => data.CarIdxFastRepairsUsed = Some(json_array),
                            "CarIdxPaceFlags" => data.CarIdxPaceFlags = Some(json_array),
                            "CarIdxPaceLine" => data.CarIdxPaceLine = Some(json_array),
                            "CarIdxPaceRow" => data.CarIdxPaceRow = Some(json_array),
                            "CarIdxQualTireCompound" => data.CarIdxQualTireCompound = Some(json_array),
                            "CarIdxTrackSurface" => data.CarIdxTrackSurface = Some(json_array),
                            "CarIdxTrackSurfaceMaterial" => data.CarIdxTrackSurfaceMaterial = Some(json_array),
                            _ => {}, // Ignore other fields
                        }
                    }
                },
                Value::FloatVec(values) => {
                    // Only include fields with actual data (non-empty arrays)
                    if !values.is_empty() {
                        // Convert Vec<f32> to JSON array 
                        let json_array: Vec<f32> = values.clone();
                        raw_values.insert(field_name.to_string(), serde_json::json!(json_array));
                        
                        // Set the actual struct field based on field name
                        match *field_name {
                            "CarIdxLapDistPct" => data.CarIdxLapDistPct = Some(json_array),
                            "CarIdxF2Time" => data.CarIdxF2Time = Some(json_array),
                            "CarIdxRPM" => data.CarIdxRPM = Some(json_array),
                            "CarIdxBestLapTime" => data.CarIdxBestLapTime = Some(json_array),
                            "CarIdxEstTime" => data.CarIdxEstTime = Some(json_array),
                            "CarIdxSteer" => data.CarIdxSteer = Some(json_array),
                            _ => {}, // Ignore other fields
                        }
                    }
                },
                Value::BoolVec(values) => {
                    // Only include fields with actual data (non-empty arrays)
                    if !values.is_empty() {
                        // Convert Vec<bool> to JSON array
                        let json_array: Vec<bool> = values.clone();
                        raw_values.insert(field_name.to_string(), serde_json::json!(json_array));
                        
                        // Set the actual struct field based on field name
                        match *field_name {
                            "CarIdxOnPitRoad" => data.CarIdxOnPitRoad = Some(json_array),
                            "CarIdxP2P_Status" => data.CarIdxP2P_Status = Some(json_array),
                            "CarIdxQualTireCompoundLocked" => data.CarIdxQualTireCompoundLocked = Some(json_array),
                            _ => {}, // Ignore other fields
                        }
                    }
                },
                _ => {
                    // For non-array values, try processing them individually
                    // Add the raw value to the map
                    raw_values.insert(field_name.to_string(), telemetry_value_to_json(value.clone()));
                }
            }
        }
    }
    
    // RPM
    if let Ok(rpm) = telem.get("RPM") {
        if let Ok(rpm_val) = TryInto::<f32>::try_into(rpm) {
            let rpm_f32: f32 = rpm_val;
            raw_values.insert("RPM".to_string(), serde_json::json!(rpm_f32));
            data.rpm = rpm_f32;
        }
    }
    
    // Gear
    if let Ok(gear) = telem.get("Gear") {
        if let Ok(gear_val) = TryInto::<i32>::try_into(gear) {
            let gear_i32: i32 = gear_val;
            raw_values.insert("Gear".to_string(), serde_json::json!(gear_i32));
            data.gear_num = gear_i32;
            data.gear = match gear_i32 {
                -1 => "R".to_string(),
                0 => "N".to_string(),
                n => n.to_string(),
            };
        }
    }
    
    // Shift Indicator
    if let Ok(shift) = telem.get("ShiftIndicatorPct") {
        if let Ok(shift_val) = TryInto::<f32>::try_into(shift) {
            let shift_f32: f32 = shift_val;
            raw_values.insert("ShiftIndicatorPct".to_string(), serde_json::json!(shift_f32));
            data.shift_indicator_pct = shift_f32 * 100.0;
        }
    }
    
    // On Pit Road
    data.on_pit_road = TryInto::<bool>::try_into(telem.get("OnPitRoad").unwrap_or(Value::BOOL(false))).unwrap_or(false);
    
    // Calculate 3D velocity magnitude
    let mut vx: f32 = 0.0;
    let mut vy: f32 = 0.0;
    let mut vz: f32 = 0.0;
    
    if let Ok(vel_x) = telem.get("VelocityX") {
        if let Ok(vel_x_val) = TryInto::<f32>::try_into(vel_x) {
            vx = vel_x_val;
            raw_values.insert("VelocityX".to_string(), serde_json::json!(vx));
            data.VelocityX = vx;
        }
    }
    
    if let Ok(vel_y) = telem.get("VelocityY") {
        if let Ok(vel_y_val) = TryInto::<f32>::try_into(vel_y) {
            vy = vel_y_val;
            raw_values.insert("VelocityY".to_string(), serde_json::json!(vy));
            data.VelocityY = vy;
        }
    }
    
    if let Ok(vel_z) = telem.get("VelocityZ") {
        if let Ok(vel_z_val) = TryInto::<f32>::try_into(vel_z) {
            vz = vel_z_val;
            raw_values.insert("VelocityZ".to_string(), serde_json::json!(vz));
            data.VelocityZ = vz;
        }
    }
    
    data.velocity_ms = (vx*vx + vy*vy + vz*vz).sqrt();
    
    // Driver Inputs
    data.throttle_pct = TryInto::<f32>::try_into(telem.get("Throttle").unwrap_or(Value::FLOAT(0.0))).unwrap() * 100.0;
    data.brake_pct = TryInto::<f32>::try_into(telem.get("Brake").unwrap_or(Value::FLOAT(0.0))).unwrap() * 100.0;
    data.clutch_pct = (1.0 - TryInto::<f32>::try_into(telem.get("Clutch").unwrap_or(Value::FLOAT(1.0))).unwrap()) * 100.0;
    data.steering_angle_deg = TryInto::<f32>::try_into(telem.get("SteeringWheelAngle").unwrap_or(Value::FLOAT(0.0))).unwrap() * 180.0 / PI;
    
    // Dynamics
    data.lateral_accel_ms2 = TryInto::<f32>::try_into(telem.get("LatAccel").unwrap_or(Value::FLOAT(0.0))).unwrap();
    data.longitudinal_accel_ms2 = TryInto::<f32>::try_into(telem.get("LongAccel").unwrap_or(Value::FLOAT(0.0))).unwrap();
    data.vertical_accel_ms2 = TryInto::<f32>::try_into(telem.get("VertAccel").unwrap_or(Value::FLOAT(0.0))).unwrap();
    data.yaw_rate_deg_s = TryInto::<f32>::try_into(telem.get("YawRate").unwrap_or(Value::FLOAT(0.0))).unwrap() * 180.0 / PI;
    
    // G-Forces
    data.g_force_lat = data.lateral_accel_ms2 / 9.8;
    data.g_force_lon = data.longitudinal_accel_ms2 / 9.8;
    
    // Car slip angle (if velocity components available)
    if vx.abs() > 0.1 {
        data.car_slip_angle_deg = (vy / vx).atan() * 180.0 / PI;
    }
    
    // Track Position
    data.lap_dist_pct = TryInto::<f32>::try_into(telem.get("LapDistPct").unwrap_or(Value::FLOAT(0.0))).unwrap();
    data.lap_dist = TryInto::<f32>::try_into(telem.get("LapDist").unwrap_or(Value::FLOAT(0.0))).unwrap();
    
    // Location
    if let Ok(lat_value) = telem.get("Lat") {
        data.lat = TryInto::<f64>::try_into(lat_value).unwrap_or(0.0);
    } else if let Ok(lat_value) = telem.get("Latitude") {
        data.lat = TryInto::<f64>::try_into(lat_value).unwrap_or(0.0);
    } else if let Ok(lat_value) = telem.get("GPSLat") {
        data.lat = TryInto::<f64>::try_into(lat_value).unwrap_or(0.0);
    }
    
    if let Ok(lon_value) = telem.get("Lon") {
        data.lon = TryInto::<f64>::try_into(lon_value).unwrap_or(0.0);
    } else if let Ok(lon_value) = telem.get("Longitude") {
        data.lon = TryInto::<f64>::try_into(lon_value).unwrap_or(0.0);
    } else if let Ok(lon_value) = telem.get("GPSLon") {
        data.lon = TryInto::<f64>::try_into(lon_value).unwrap_or(0.0);
    }
    
    // Timing
    data.current_lap_time = TryInto::<f32>::try_into(telem.get("LapCurrentLapTime").unwrap_or(Value::FLOAT(0.0))).unwrap();
    data.last_lap_time = TryInto::<f32>::try_into(telem.get("LapLastLapTime").unwrap_or(Value::FLOAT(0.0))).unwrap();
    data.best_lap_time = TryInto::<f32>::try_into(telem.get("LapBestLapTime").unwrap_or(Value::FLOAT(0.0))).unwrap();
    data.lap_completed = TryInto::<i32>::try_into(telem.get("Lap").unwrap_or(Value::INT(0))).unwrap();
    data.delta_best = TryInto::<f32>::try_into(telem.get("LapDeltaToBestLap").unwrap_or(Value::FLOAT(0.0))).unwrap();
    data.delta_session_best = TryInto::<f32>::try_into(telem.get("LapDeltaToSessionBestLap").unwrap_or(Value::FLOAT(0.0))).unwrap();
    data.delta_optimal = TryInto::<f32>::try_into(telem.get("LapDeltaToOptimalLap").unwrap_or(Value::FLOAT(0.0))).unwrap();
    data.position = TryInto::<i32>::try_into(telem.get("PlayerCarPosition").unwrap_or(Value::INT(0))).unwrap();
    
    // Extract SessionTime
    if let Ok(session_time) = telem.get("SessionTime") {
        println!("Raw SessionTime from iRacing: {:?}", session_time);
        // First convert to f64, then to f32
        if let Ok(session_time_f64) = TryInto::<f64>::try_into(session_time) {
            data.SessionTime = session_time_f64 as f32;
            println!("Converted SessionTime: {}", data.SessionTime);
            raw_values.insert("SessionTime".to_string(), serde_json::json!(data.SessionTime));
        } else {
            println!("Failed to convert SessionTime to f64");
            data.SessionTime = 0.0;
        }
    } else {
        println!("SessionTime not found in telemetry data");
        data.SessionTime = 0.0;
    }
    
    // Incident count
    data.incident_count = TryInto::<i32>::try_into(telem.get("PlayerCarDriverIncidentCount").unwrap_or(Value::INT(0))).unwrap();
    
    // Fuel & Temps
    data.fuel_level = TryInto::<f32>::try_into(telem.get("FuelLevel").unwrap_or(Value::FLOAT(0.0))).unwrap();
    data.fuel_pct = TryInto::<f32>::try_into(telem.get("FuelLevelPct").unwrap_or(Value::FLOAT(0.0))).unwrap() * 100.0;
    data.fuel_use_per_hour = TryInto::<f32>::try_into(telem.get("FuelUsePerHour").unwrap_or(Value::FLOAT(0.0))).unwrap();
    data.track_temp_c = TryInto::<f32>::try_into(telem.get("TrackTemp").unwrap_or(Value::FLOAT(0.0))).unwrap();
    data.air_temp_c = TryInto::<f32>::try_into(telem.get("AirTemp").unwrap_or(Value::FLOAT(0.0))).unwrap();
    data.water_temp_c = TryInto::<f32>::try_into(telem.get("WaterTemp").unwrap_or(Value::FLOAT(0.0))).unwrap();
    data.oil_temp_c = TryInto::<f32>::try_into(telem.get("OilTemp").unwrap_or(Value::FLOAT(0.0))).unwrap();
    data.humidity_pct = TryInto::<f32>::try_into(telem.get("RelativeHumidity").unwrap_or(Value::FLOAT(0.0))).unwrap() * 100.0;
    data.fog_level_pct = TryInto::<f32>::try_into(telem.get("FogLevel").unwrap_or(Value::FLOAT(0.0))).unwrap() * 100.0;
    data.wind_vel_ms = TryInto::<f32>::try_into(telem.get("WindVel").unwrap_or(Value::FLOAT(0.0))).unwrap();
    data.wind_dir_rad = TryInto::<f32>::try_into(telem.get("WindDir").unwrap_or(Value::FLOAT(0.0))).unwrap();
    
    // Sky conditions
    let skies_value = TryInto::<i32>::try_into(telem.get("Skies").unwrap_or(Value::INT(0))).unwrap();
    data.skies = match skies_value {
        0 => "Clear".to_string(),
        1 => "Partly Cloudy".to_string(),
        2 => "Mostly Cloudy".to_string(),
        3 => "Overcast".to_string(),
        _ => "Unknown".to_string(),
    };
    
    // Tires
    data.tire_temps_c = [
        TryInto::<f32>::try_into(telem.get("LFtempCL").unwrap_or(Value::FLOAT(0.0))).unwrap(),
        TryInto::<f32>::try_into(telem.get("RFtempCL").unwrap_or(Value::FLOAT(0.0))).unwrap(),
        TryInto::<f32>::try_into(telem.get("LRtempCL").unwrap_or(Value::FLOAT(0.0))).unwrap(),
        TryInto::<f32>::try_into(telem.get("RRtempCL").unwrap_or(Value::FLOAT(0.0))).unwrap()
    ];
    
    data.tire_pressures_kpa = [
        TryInto::<f32>::try_into(telem.get("LFpress").unwrap_or(Value::FLOAT(0.0))).unwrap(),
        TryInto::<f32>::try_into(telem.get("RFpress").unwrap_or(Value::FLOAT(0.0))).unwrap(),
        TryInto::<f32>::try_into(telem.get("LRpress").unwrap_or(Value::FLOAT(0.0))).unwrap(),
        TryInto::<f32>::try_into(telem.get("RRpress").unwrap_or(Value::FLOAT(0.0))).unwrap()
    ];
    
    data.ride_height_mm = [
        TryInto::<f32>::try_into(telem.get("LFrideHeight").unwrap_or(Value::FLOAT(0.0))).unwrap() * 1000.0,
        TryInto::<f32>::try_into(telem.get("RFrideHeight").unwrap_or(Value::FLOAT(0.0))).unwrap() * 1000.0,
        TryInto::<f32>::try_into(telem.get("LRrideHeight").unwrap_or(Value::FLOAT(0.0))).unwrap() * 1000.0,
        TryInto::<f32>::try_into(telem.get("RRrideHeight").unwrap_or(Value::FLOAT(0.0))).unwrap() * 1000.0
    ];
    
    data.wheel_rpm = [
        TryInto::<f32>::try_into(telem.get("LFrpm").unwrap_or(Value::FLOAT(0.0))).unwrap(),
        TryInto::<f32>::try_into(telem.get("RFrpm").unwrap_or(Value::FLOAT(0.0))).unwrap(),
        TryInto::<f32>::try_into(telem.get("LRrpm").unwrap_or(Value::FLOAT(0.0))).unwrap(),
        TryInto::<f32>::try_into(telem.get("RRrpm").unwrap_or(Value::FLOAT(0.0))).unwrap()
    ];
    
    data.brake_temps_c = [
        TryInto::<f32>::try_into(telem.get("LFbrakeTemp").unwrap_or(Value::FLOAT(0.0))).unwrap(),
        TryInto::<f32>::try_into(telem.get("RFbrakeTemp").unwrap_or(Value::FLOAT(0.0))).unwrap(),
        TryInto::<f32>::try_into(telem.get("LRbrakeTemp").unwrap_or(Value::FLOAT(0.0))).unwrap(),
        TryInto::<f32>::try_into(telem.get("RRbrakeTemp").unwrap_or(Value::FLOAT(0.0))).unwrap()
    ];
    
    // Suspension
    data.shock_defl_mm = [
        TryInto::<f32>::try_into(telem.get("LFshockDefl").unwrap_or(Value::FLOAT(0.0))).unwrap() * 1000.0,
        TryInto::<f32>::try_into(telem.get("RFshockDefl").unwrap_or(Value::FLOAT(0.0))).unwrap() * 1000.0,
        TryInto::<f32>::try_into(telem.get("LRshockDefl").unwrap_or(Value::FLOAT(0.0))).unwrap() * 1000.0,
        TryInto::<f32>::try_into(telem.get("RRshockDefl").unwrap_or(Value::FLOAT(0.0))).unwrap() * 1000.0
    ];
    
    // Damage
    data.repair_required_sec = TryInto::<f32>::try_into(telem.get("PitRepairLeft").unwrap_or(Value::FLOAT(0.0))).unwrap();
    data.opt_repair_sec = TryInto::<f32>::try_into(telem.get("PitOptRepairLeft").unwrap_or(Value::FLOAT(0.0))).unwrap();
    
    // Session flags
    data.session_flags = TryInto::<u32>::try_into(telem.get("SessionFlags").unwrap_or(Value::BITS(0))).unwrap();
    
    // Process active flags
    data.active_flags = Vec::new();
    if data.session_flags & FLAG_GREEN != 0 { data.active_flags.push("GREEN FLAG".to_string()); }
    if data.session_flags & FLAG_YELLOW != 0 { data.active_flags.push("YELLOW FLAG".to_string()); }
    if data.session_flags & FLAG_RED != 0 { data.active_flags.push("RED FLAG".to_string()); }
    if data.session_flags & FLAG_BLUE != 0 { data.active_flags.push("BLUE FLAG".to_string()); }
    if data.session_flags & FLAG_WHITE != 0 { data.active_flags.push("WHITE FLAG".to_string()); }
    if data.session_flags & FLAG_CHECKERED != 0 { data.active_flags.push("CHECKERED FLAG".to_string()); }
    if data.session_flags & FLAG_BLACK != 0 { data.active_flags.push("BLACK FLAG".to_string()); }
    if data.session_flags & FLAG_BLACK_WHITE != 0 { data.active_flags.push("BLACK/WHITE FLAG".to_string()); }
    
    // Track Surface - This information shows if you're off-track
    let track_surf_val = TryInto::<i32>::try_into(telem.get("PlayerTrackSurface").unwrap_or(Value::INT(0))).unwrap_or(0);
    
    // Store the raw numeric value
    data.PlayerTrackSurface = track_surf_val;
    
    // Updated mapping based on actual observed values:
    // 0 = off road (grass), 1 = pit stall, 2 = pit lane, 3 = on track (road)
    data.track_surface = match track_surf_val {
        0 => "Off track".to_string(),
        1 => "In pit stall".to_string(),
        2 => "Pit lane".to_string(),
        3 => "On track".to_string(),
        4 => "Not in world".to_string(),
        _ => format!("Unknown ({})", track_surf_val),
    };
    raw_values.insert("PlayerTrackSurface".to_string(), serde_json::json!(track_surf_val));
    
    // Get material value if available
    if let Ok(material) = telem.get("PlayerTrackSurfaceMaterial") {
        if let Ok(material_val) = TryInto::<i32>::try_into(material) {
            raw_values.insert("PlayerTrackSurfaceMaterial".to_string(), serde_json::json!(material_val));
            
            // Only use material info if we're off track (value = 0)
            if track_surf_val == 0 {  // When off track
                data.track_surface = match material_val {
                    0 => "Asphalt (off track)".to_string(),
                    1 => "Concrete (off track)".to_string(),
                    2 => "Dirt".to_string(),
                    3 => "Grass".to_string(),
                    4 => "Sand".to_string(),
                    5 => "Gravel".to_string(),
                    6 => "Rumble Strip".to_string(),
                    7 => "Water".to_string(),
                    15 => "Grass".to_string(), 
                    16 => "Grass".to_string(),
                    19 => "Sand".to_string(),
                    24 => "Gravel".to_string(), // As observed - common off-track value
                    _ => format!("Surface Material {}", material_val),
                };
            }
        }
    }
    
    // Store the raw values
    data.raw_values = raw_values;
    
    data
}

/// Format telemetry data as a human-readable string for display in console
pub fn format_telemetry_display(data: &TelemetryData) -> String {
    let mut display = String::new();
    
    let pit_status = if data.on_pit_road { "IN PITS" } else { "ON TRACK" };
    display.push_str(&format!("=== CAR STATE ({}) ===\n", pit_status));
    display.push_str(&format!("Speed: {:.2} km/h\n", data.speed_kph));
    display.push_str(&format!("RPM: {:.0}\n", data.rpm));
    display.push_str(&format!("Gear: {}\n", data.gear));
    display.push_str(&format!("Surface: {}\n", data.track_surface));
    
    // Display car left/right status
    let car_status = match data.car_left_right {
        CarLeftRight::Off => "Off",
        CarLeftRight::Clear => "Clear",
        CarLeftRight::CarLeft => "Car Left",
        CarLeftRight::CarRight => "Car Right",
        CarLeftRight::CarLeftRight => "Cars Left & Right",
        CarLeftRight::TwoCarsLeft => "Two Cars Left",
        CarLeftRight::TwoCarsRight => "Two Cars Right",
    };
    display.push_str(&format!("Cars: {} ({})\n", car_status, data.car_left_right_raw));
    
    if data.shift_indicator_pct > 0.0 {
        display.push_str(&format!("Shift Indicator: {:.0}%\n", data.shift_indicator_pct));
    }
    
    display.push_str(&format!("Speed Vector: {:.2} m/s\n", data.velocity_ms));
    
    // Driver inputs
    display.push_str("\n=== DRIVER INPUTS ===\n");
    display.push_str(&format!("Throttle: {:.1}%\n", data.throttle_pct));
    display.push_str(&format!("Brake: {:.1}%\n", data.brake_pct));
    display.push_str(&format!("Clutch: {:.1}%\n", data.clutch_pct));
    display.push_str(&format!("Steering: {:.1}°\n", data.steering_angle_deg));
    
    // Dynamics
    display.push_str("\n=== DYNAMICS ===\n");
    display.push_str(&format!("Lateral Accel: {:.2}m/s²\n", data.lateral_accel_ms2));
    display.push_str(&format!("Longitudinal Accel: {:.2}m/s²\n", data.longitudinal_accel_ms2));
    display.push_str(&format!("Yaw Rate: {:.2}°/s\n", data.yaw_rate_deg_s));
    display.push_str(&format!("Vertical Accel: {:.2}m/s²\n", data.vertical_accel_ms2));
    display.push_str(&format!("G-Force: Lon:{:.2}G Lat:{:.2}G\n", data.g_force_lon, data.g_force_lat));
    
    if data.car_slip_angle_deg.abs() > 0.01 {
        display.push_str(&format!("Car Slip Angle: {:.2}°\n", data.car_slip_angle_deg));
    }
    
    // Add track position display
    display.push_str("\n=== TRACK POSITION ===\n");
    display.push_str(&format!("Lap Distance: {:.1}m\n", data.lap_dist));
    display.push_str(&format!("Track Position: {:.1}%\n", data.lap_dist_pct * 100.0));
    
    // Add location data display
    if data.lat != 0.0 || data.lon != 0.0 {
        display.push_str("\n=== LOCATION ===\n");
        display.push_str(&format!("Latitude: {:.6}\n", data.lat));
        display.push_str(&format!("Longitude: {:.6}\n", data.lon));
    }
    
    // Timing
    display.push_str("\n=== TIMING ===\n");
    display.push_str(&format!("Lap: {}\n", data.lap_completed));
    
    let format_time = |time: f32| -> String {
        if time <= 0.0 {
            return "N/A".to_string();
        }
        let minutes = (time / 60.0) as i32;
        let seconds = time % 60.0;
        format!("{:02}:{:06.3}", minutes, seconds)
    };
    
    display.push_str(&format!("Current: {}\n", format_time(data.current_lap_time)));
    
    if data.last_lap_time > 0.0 {
        display.push_str(&format!("Last Lap: {}\n", format_time(data.last_lap_time)));
    }
    
    if data.best_lap_time > 0.0 {
        display.push_str(&format!("Best Lap: {}\n", format_time(data.best_lap_time)));
    }
    
    // Delta times
    if data.delta_best != 0.0 {
        let sign = if data.delta_best >= 0.0 { "+" } else { "" };
        display.push_str(&format!("Delta to Best: {}{}s\n", sign, data.delta_best));
    }
    
    if data.delta_session_best != 0.0 {
        let sign = if data.delta_session_best >= 0.0 { "+" } else { "" };
        display.push_str(&format!("Delta to Session Best: {}{}s\n", sign, data.delta_session_best));
    }
    
    if data.delta_optimal != 0.0 {
        let sign = if data.delta_optimal >= 0.0 { "+" } else { "" };
        display.push_str(&format!("Delta to Optimal: {}{}s\n", sign, data.delta_optimal));
    }
    
    if data.position > 0 {
        display.push_str(&format!("Position: {}\n", data.position));
    }
    
    // Fuel & Temps
    display.push_str("\n=== FUEL & TEMPS ===\n");
    display.push_str(&format!("Fuel: {:.2}L\n", data.fuel_level));
    display.push_str(&format!("Fuel: {:.1}%\n", data.fuel_pct));
    display.push_str(&format!("Fuel Use: {:.2}L/hr\n", data.fuel_use_per_hour));
    display.push_str(&format!("Track Temp: {:.1}°C\n", data.track_temp_c));
    display.push_str(&format!("Air Temp: {:.1}°C\n", data.air_temp_c));
    display.push_str(&format!("Humidity: {:.0}%\n", data.humidity_pct));
    
    display.push_str(&format!("Wind: {:.1} m/s @ {:.0}°\n", 
        data.wind_vel_ms, data.wind_dir_rad * 180.0 / PI));
    
    display.push_str(&format!("Fog Level: {:.0}%\n", data.fog_level_pct));
    display.push_str(&format!("Skies: {}\n", data.skies));
    
    display.push_str(&format!("Water Temp: {:.1}°C\n", data.water_temp_c));
    display.push_str(&format!("Oil Temp: {:.1}°C\n", data.oil_temp_c));
    
    // Wheel data
    display.push_str("\n=== WHEEL DATA ===\n");
    display.push_str(&format!("Tire Temps (°C): LF:{:.1} RF:{:.1} LR:{:.1} RR:{:.1}\n", 
        data.tire_temps_c[0], data.tire_temps_c[1], data.tire_temps_c[2], data.tire_temps_c[3]));
    
    display.push_str(&format!("Tire Press (kPa): LF:{:.1} RF:{:.1} LR:{:.1} RR:{:.1}\n", 
        data.tire_pressures_kpa[0], data.tire_pressures_kpa[1], 
        data.tire_pressures_kpa[2], data.tire_pressures_kpa[3]));
    
    display.push_str(&format!("Ride Height (mm): LF:{:.1} RF:{:.1} LR:{:.1} RR:{:.1}\n", 
        data.ride_height_mm[0], data.ride_height_mm[1], 
        data.ride_height_mm[2], data.ride_height_mm[3]));
    
    // Wheel dynamics
    display.push_str("\n=== WHEEL DYNAMICS ===\n");
    
    if data.wheel_rpm.iter().any(|&rpm| rpm > 0.0) {
        display.push_str(&format!("Wheel RPM: LF:{:.0} RF:{:.0} LR:{:.0} RR:{:.0}\n", 
            data.wheel_rpm[0], data.wheel_rpm[1], data.wheel_rpm[2], data.wheel_rpm[3]));
    }
    
    display.push_str(&format!("Brake Temp (°C): LF:{:.1} RF:{:.1} LR:{:.1} RR:{:.1}\n", 
        data.brake_temps_c[0], data.brake_temps_c[1], 
        data.brake_temps_c[2], data.brake_temps_c[3]));
    
    // Suspension
    display.push_str("\n=== SUSPENSION ===\n");
    display.push_str(&format!("Shock Defl (mm): LF:{:.1} RF:{:.1} LR:{:.1} RR:{:.1}\n", 
        data.shock_defl_mm[0], data.shock_defl_mm[1], 
        data.shock_defl_mm[2], data.shock_defl_mm[3]));
    
    // Car damage
    display.push_str("\n=== DAMAGE ===\n");
    if data.repair_required_sec > 0.0 {
        display.push_str(&format!("Required Repairs: {:.1}s\n", data.repair_required_sec));
    } else {
        display.push_str("Required Repairs: None\n");
    }
    
    if data.opt_repair_sec > 0.0 {
        display.push_str(&format!("Optional Repairs: {:.1}s\n", data.opt_repair_sec));
    } else {
        display.push_str("Optional Repairs: None\n");
    }
    
    // Session flags
    if !data.active_flags.is_empty() {
        display.push_str("\n=== FLAGS ===\n");
        for flag in &data.active_flags {
            display.push_str(&format!("{}\n", flag));
        }
    }
    
    if !data.warnings.is_empty() {
        display.push_str(&format!("Warnings: {}\n", data.warnings.join(", ")));
    }
    
    display
} 