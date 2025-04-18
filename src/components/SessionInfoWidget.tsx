import React, { useState, useEffect } from 'react';
import { Widget } from './Widget';
import { useTelemetryData } from '../hooks/useTelemetryData';

interface SessionInfoWidgetProps {
  id: string;
  onClose?: () => void;
  initialWidth?: number;
  initialHeight?: number;
  initialX?: number;
  initialY?: number;
  title?: string;
}

type TabKey = 'track' | 'session' | 'driver' | 'raw';

interface SessionData {
  weekend?: {
    track_name?: string;
    track_id?: number;
    track_length?: string;
    track_display_name?: string;
    track_display_short_name?: string;
    track_config_name?: string;
    track_city?: string;
    track_country?: string;
    track_altitude?: string;
    track_turns?: number;
    track_pit_speed_limit?: string;
    track_type?: string;
    track_weather?: string;
    track_skies?: string;
    track_surface_temperature?: string;
    track_air_tempearture?: string; // Note the typo in the API
    track_wind_speed?: string;
    track_wind_direction?: string;
    options?: {
      relative_humidity?: string;
      temperature?: string;
      [key: string]: any;
    };
    [key: string]: any;
  };
  session?: {
    sessions?: Array<{
      session_number?: number;
      laps?: any;
      time?: string;
      session_type?: string;
      track_rubber_state?: string;
      [key: string]: any;
    }>;
    [key: string]: any;
  };
  drivers?: {
    idle_rpm?: number;
    red_line_rpm?: number;
    shift_light_shift_rpm?: number;
    fuel_capacity?: number;
    estimated_lap_time?: number;
    other_drivers?: Array<{
      user_name?: string;
      car_number?: number;
      car_screen_name?: string;
      team_name?: string;
      i_rating?: number;
      license?: string;
      [key: string]: any;
    }>;
    [key: string]: any;
  };
  [key: string]: any;
}

const SessionInfoWidget: React.FC<SessionInfoWidgetProps> = ({
  id,
  onClose,
  initialWidth = 600,
  initialHeight = 400,
  initialX = 20,
  initialY = 20,
  title = 'Session Info'
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('track');
  const [sessionInfo, setSessionInfo] = useState<string>('');
  const [parsedData, setParsedData] = useState<SessionData>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    trackDetails: true,
    weatherInfo: true,
    sessionDetails: true,
    driverDetails: true
  });
  
  // Use telemetry hook to get session info data
  const { data, isConnected } = useTelemetryData(`session-info-${id}`, {
    metrics: [],
    throttleUpdates: true,
    updateInterval: 5000 // Less frequent updates for session info
  });
  
  useEffect(() => {
    if (data && data.session_info !== undefined) {
      setSessionInfo(data.session_info);
      
      try {
        // The data comes as a Debug-formatted string of a Rust struct, not as YAML
        // Parse the Rust debug format string manually
        const parsedObj: SessionData = {};
        
        // Extract weekend information
        const weekendMatch = data.session_info.match(/weekend: WeekendInfo \{([^}]+)\}/);
        if (weekendMatch && weekendMatch[1]) {
          parsedObj.weekend = parseRustStruct(weekendMatch[1]);
        }
        
        // Extract session information
        const sessionMatch = data.session_info.match(/session: SessionInfo \{([^}]+)\}/);
        if (sessionMatch && sessionMatch[1]) {
          parsedObj.session = parseRustStruct(sessionMatch[1]);
          
          // Parse sessions array
          const sessionsMatch = data.session_info.match(/sessions: \[(.*?)\]/s);
          if (sessionsMatch && sessionsMatch[1]) {
            const sessionsStr = sessionsMatch[1];
            const sessionEntries = sessionsStr.match(/Session \{([^}]+)\}/g);
            
            if (sessionEntries) {
              parsedObj.session.sessions = sessionEntries.map(entry => {
                const contentMatch = entry.match(/Session \{([^}]+)\}/);
                return contentMatch ? parseRustStruct(contentMatch[1]) : {};
              });
            }
          }
        }
        
        // Extract driver information
        const driversMatch = data.session_info.match(/drivers: DriverInfo \{([^}]+)\}/);
        if (driversMatch && driversMatch[1]) {
          parsedObj.drivers = parseRustStruct(driversMatch[1]);
          
          // Parse other_drivers array
          const otherDriversMatch = data.session_info.match(/other_drivers: \[(.*?)\]/s);
          if (otherDriversMatch && otherDriversMatch[1]) {
            const driversStr = otherDriversMatch[1];
            const driverEntries = driversStr.match(/Driver \{([^}]+)\}/g);
            
            if (driverEntries) {
              parsedObj.drivers.other_drivers = driverEntries.map(entry => {
                const contentMatch = entry.match(/Driver \{([^}]+)\}/);
                return contentMatch ? parseRustStruct(contentMatch[1]) : {};
              });
            }
          }
        }
        
        console.log('Parsed data:', parsedObj);
        setParsedData(parsedObj);
      } catch (err) {
        console.error('Failed to parse session info:', err);
      }
    }
  }, [data]);
  
  // Helper function to parse Rust struct format into JavaScript object
  const parseRustStruct = (structStr: string): any => {
    const result: any = {};
    
    // Match field: value pairs
    const fieldPattern = /(\w+): ([^,]+),?/g;
    let match;
    
    while ((match = fieldPattern.exec(structStr)) !== null) {
      const key = match[1].trim();
      let value = match[2].trim();
      
      // Convert string representations to actual types
      if (value === 'None') {
        result[key] = null;
      } else if (value.startsWith('Some(') && value.endsWith(')')) {
        // Extract value from Some()
        const innerValue = value.substring(5, value.length - 1);
        // Remove quotes if string
        if (innerValue.startsWith('"') && innerValue.endsWith('"')) {
          result[key] = innerValue.substring(1, innerValue.length - 1);
        } else {
          // Try to parse as number
          const num = parseFloat(innerValue);
          result[key] = isNaN(num) ? innerValue : num;
        }
      } else if (value === 'true' || value === 'false') {
        result[key] = value === 'true';
      } else if (!isNaN(Number(value))) {
        result[key] = Number(value);
      } else if (value.startsWith('"') && value.endsWith('"')) {
        result[key] = value.substring(1, value.length - 1);
      } else {
        result[key] = value;
      }
    }
    
    return result;
  };
  
  const toggleSection = (section: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };
  
  const formatValue = (key: string, value: any): string => {
    if (value === null || value === undefined) {
      return 'N/A';
    }
    
    // Format based on common key patterns
    if (key.toLowerCase().includes('temp')) {
      return typeof value === 'string' ? value : `${value.toFixed(1)}°C`;
    }
    if (key.toLowerCase().includes('speed')) {
      return typeof value === 'string' ? value : `${value.toFixed(2)} km/h`;
    }
    if (key.toLowerCase().includes('time')) {
      return typeof value === 'string' ? value : `${value.toFixed(2)} s`;
    }
    if (key.toLowerCase().includes('rpm')) {
      return typeof value === 'string' ? value : `${value.toFixed(0)} RPM`;
    }
    
    return String(value);
  };

  const renderPropertyRow = (key: string, value: any, depth = 0) => {
    // Skip rendering if searching and no match
    if (searchTerm && !key.toLowerCase().includes(searchTerm.toLowerCase()) && 
        !(typeof value === 'string' && value.toLowerCase().includes(searchTerm.toLowerCase()))) {
      return null;
    }
    
    const displayKey = key.replace(/([A-Z])/g, ' $1').trim();
    
    if (typeof value === 'object' && value !== null) {
      return (
        <div key={key} style={{ marginLeft: `${depth * 12}px` }}>
          <div 
            className="property-header" 
            style={{ 
              fontWeight: 'bold', 
              cursor: 'pointer',
              padding: '4px 0',
              borderBottom: '1px solid rgba(255,255,255,0.1)',
              display: 'flex',
              alignItems: 'center'
            }}
            onClick={() => toggleSection(key)}
          >
            <span style={{ 
              display: 'inline-block', 
              width: '16px', 
              marginRight: '4px',
              transition: 'transform 0.2s'
            }}>
              {expandedSections[key] ? '▼' : '►'}
            </span>
            {displayKey}
          </div>
          
          {expandedSections[key] && (
            <div style={{ marginTop: '4px' }}>
              {Object.entries(value).map(([subKey, subValue]) => 
                renderPropertyRow(subKey, subValue, depth + 1)
              )}
            </div>
          )}
        </div>
      );
    }
    
    return (
      <div 
        key={key} 
        style={{ 
          marginLeft: `${depth * 12}px`,
          display: 'flex',
          padding: '2px 0',
          borderBottom: '1px solid rgba(255,255,255,0.05)'
        }}
      >
        <div style={{ flex: 1, color: '#9ca3af' }}>{displayKey}:</div>
        <div style={{ flex: 1.5, fontWeight: 500 }}>{formatValue(key, value)}</div>
      </div>
    );
  };
  
  const renderTrackTab = () => {
    const weekendInfo = parsedData.weekend || {};
    
    return (
      <div>
        <div className="section">
          <div 
            className="section-header"
            onClick={() => toggleSection('trackDetails')}
            style={{ cursor: 'pointer' }}
          >
            <h3>
              <span style={{ marginRight: '8px' }}>
                {expandedSections.trackDetails ? '▼' : '►'}
              </span>
              Track Details
            </h3>
          </div>
          
          {expandedSections.trackDetails && (
            <div className="section-content">
              {Object.entries({
                trackName: weekendInfo.track_display_name || weekendInfo.track_name,
                trackType: weekendInfo.track_type,
                trackLength: weekendInfo.track_length,
                trackTurns: weekendInfo.track_turns,
                trackCity: weekendInfo.track_city,
                trackCountry: weekendInfo.track_country,
                pitSpeedLimit: weekendInfo.track_pit_speed_limit
              }).map(([key, value]) => renderPropertyRow(key, value))}
            </div>
          )}
        </div>
        
        <div className="section">
          <div 
            className="section-header"
            onClick={() => toggleSection('weatherInfo')}
            style={{ cursor: 'pointer' }}
          >
            <h3>
              <span style={{ marginRight: '8px' }}>
                {expandedSections.weatherInfo ? '▼' : '►'}
              </span>
              Weather Conditions
            </h3>
          </div>
          
          {expandedSections.weatherInfo && (
            <div className="section-content">
              {Object.entries({
                weatherType: weekendInfo.track_weather,
                skies: weekendInfo.track_skies,
                temperature: weekendInfo.track_air_tempearture,
                surfaceTemp: weekendInfo.track_surface_temperature,
                humidity: weekendInfo.options?.relative_humidity,
                windSpeed: weekendInfo.track_wind_speed,
                windDirection: weekendInfo.track_wind_direction
              }).map(([key, value]) => renderPropertyRow(key, value))}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  const renderSessionTab = () => {
    const sessionInfo = parsedData.session || {};
    const sessions = sessionInfo.sessions || [];
    
    return (
      <div>
        <div className="section">
          <div 
            className="section-header"
            onClick={() => toggleSection('sessionDetails')}
            style={{ cursor: 'pointer' }}
          >
            <h3>
              <span style={{ marginRight: '8px' }}>
                {expandedSections.sessionDetails ? '▼' : '►'}
              </span>
              Session Details
            </h3>
          </div>
          
          {expandedSections.sessionDetails && (
            <div className="section-content">
              {sessions.map((session: any, index: number) => (
                <div key={index} style={{ marginBottom: '12px' }}>
                  <h4 style={{ margin: '8px 0', color: '#60a5fa' }}>
                    {session.session_type || `Session ${index + 1}`}
                  </h4>
                  {Object.entries({
                    sessionNumber: session.session_number,
                    laps: session.laps,
                    time: session.time,
                    trackState: session.track_rubber_state
                  }).map(([key, value]) => renderPropertyRow(key, value))}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  const renderDriverTab = () => {
    const driverInfo = parsedData.drivers || {};
    const drivers = driverInfo.other_drivers || [];
    
    return (
      <div>
        <div className="section">
          <div 
            className="section-header"
            onClick={() => toggleSection('driverDetails')}
            style={{ cursor: 'pointer' }}
          >
            <h3>
              <span style={{ marginRight: '8px' }}>
                {expandedSections.driverDetails ? '▼' : '►'}
              </span>
              Driver & Car Details
            </h3>
          </div>
          
          {expandedSections.driverDetails && (
            <div className="section-content">
              {drivers.map((driver: any, index: number) => (
                <div key={index} style={{ marginBottom: '16px' }}>
                  <h4 style={{ margin: '8px 0', color: '#60a5fa' }}>
                    {driver.user_name || `Driver ${index + 1}`}
                  </h4>
                  {Object.entries({
                    carNumber: driver.car_number,
                    carName: driver.car_screen_name,
                    teamName: driver.team_name,
                    iRating: driver.i_rating,
                    license: driver.license
                  }).map(([key, value]) => renderPropertyRow(key, value))}
                </div>
              ))}
              
              <h4 style={{ margin: '16px 0 8px 0', color: '#60a5fa' }}>Car Specs</h4>
              {Object.entries({
                idleRPM: driverInfo.idle_rpm,
                redlineRPM: driverInfo.red_line_rpm,
                shiftRPM: driverInfo.shift_light_shift_rpm,
                fuelCapacity: driverInfo.fuel_capacity,
                estimatedLapTime: driverInfo.estimated_lap_time
              }).map(([key, value]) => renderPropertyRow(key, value))}
            </div>
          )}
        </div>
      </div>
    );
  };
  
  const renderRawTab = () => {
    return (
      <div style={{ 
        fontFamily: 'monospace',
        fontSize: '12px',
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-all',
        overflowX: 'auto',
        padding: '10px',
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderRadius: '4px'
      }}>
        {sessionInfo || 'No session info available'}
      </div>
    );
  };
  
  return (
    <Widget
      id={id}
      title={title}
      onClose={onClose}
      width={initialWidth}
      height={initialHeight}
      initialPosition={{ x: initialX, y: initialY }}
    >
      <div className="session-info-widget" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {!isConnected && (
          <div style={{
            padding: '8px',
            margin: '0 0 10px 0',
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            borderRadius: '4px',
            fontSize: '12px',
            textAlign: 'center'
          }}>
            Not connected to telemetry
          </div>
        )}
        
        <div style={{ padding: '0 10px', marginBottom: '10px' }}>
          <input
            type="text"
            placeholder="Search session info..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{
              width: '100%',
              padding: '6px 10px',
              backgroundColor: 'rgba(30, 41, 59, 0.8)',
              border: '1px solid rgba(71, 85, 105, 0.5)',
              borderRadius: '4px',
              color: 'white',
              fontSize: '13px'
            }}
          />
        </div>
        
        <div style={{ 
          display: 'flex', 
          borderBottom: '1px solid rgba(100, 130, 255, 0.2)',
          marginBottom: '10px'
        }}>
          {(["track", "session", "driver", "raw"] as TabKey[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                flex: '1',
                padding: '8px 0',
                backgroundColor: 'transparent',
                border: 'none',
                borderBottom: activeTab === tab 
                  ? '2px solid #3b82f6' 
                  : '2px solid transparent',
                color: activeTab === tab ? '#3b82f6' : '#9ca3af',
                fontWeight: activeTab === tab ? 'bold' : 'normal',
                cursor: 'pointer',
                transition: 'all 0.2s',
                textTransform: 'capitalize'
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        
        <div style={{ 
          flex: 1, 
          overflowY: 'auto', 
          padding: '0 10px 10px 10px'
        }}>
          {activeTab === 'track' && renderTrackTab()}
          {activeTab === 'session' && renderSessionTab()}
          {activeTab === 'driver' && renderDriverTab()}
          {activeTab === 'raw' && renderRawTab()}
        </div>
      </div>
    </Widget>
  );
};

export default SessionInfoWidget; 