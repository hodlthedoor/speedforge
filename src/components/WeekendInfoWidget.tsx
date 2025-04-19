import React from 'react';
import Widget from './Widget';
import { useTelemetryData, WeekendInfo } from '../hooks/useTelemetryData';

interface WeekendInfoWidgetProps {
  id: string;
  onClose?: () => void;
  initialPosition?: { x: number; y: number };
}

const WeekendInfoWidget: React.FC<WeekendInfoWidgetProps> = ({ 
  id, 
  onClose,
  initialPosition
}) => {
  // Use the hook to get the telemetry data including weather metrics
  const { data, isConnected } = useTelemetryData(id, {
    metrics: [
      'weekend_info',
      'track_temp_c',
      'air_temp_c',
      'humidity_pct',
      'wind_vel_ms',
      'wind_dir_rad',
      'skies',
      'fog_level_pct'
    ]
  });

  // Helper function to format track name with configuration
  const formatTrackName = () => {
    if (!data?.weekend_info) return 'Unknown Track';
    
    const { track_name, track_config } = data.weekend_info as WeekendInfo;
    
    if (track_config && track_config !== '') {
      return `${track_name} - ${track_config}`;
    }
    
    return track_name || 'Unknown Track';
  };

  // Helper function to format track length
  const formatTrackLength = () => {
    if (!(data?.weekend_info as WeekendInfo)?.track_length_km) return '';
    return `${(data.weekend_info as WeekendInfo).track_length_km.toFixed(2)} km`;
  };
  
  // Helper to format wind direction
  const formatWindDirection = () => {
    if (data?.wind_dir_rad === undefined) return '';
    
    // Convert radians to cardinal directions
    const degrees = (data.wind_dir_rad * 180 / Math.PI) % 360;
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N'];
    const index = Math.round(degrees / 45);
    
    return directions[index];
  };

  return (
    <Widget
      id={id}
      title="Track Info"
      onClose={onClose}
      initialPosition={initialPosition}
      className="min-w-[240px]"
    >
      <div className="p-3 flex flex-col space-y-3">
        {!isConnected ? (
          <div className="text-slate-400 text-sm">Waiting for data...</div>
        ) : (
          <>
            {/* Track information section */}
            <div className="text-center mb-1">
              <h3 className="text-lg font-semibold text-white">{formatTrackName()}</h3>
              <div className="text-sm text-slate-300">{formatTrackLength()}</div>
            </div>
            
            {/* Session information */}
            <div className="bg-slate-800/50 rounded-lg p-2">
              <h4 className="text-sm uppercase text-slate-400 font-medium mb-2">Session</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-slate-400">Type</div>
                  <div className="font-medium">{(data?.weekend_info as WeekendInfo)?.session_type || 'Unknown'}</div>
                </div>
                <div>
                  <div className="text-slate-400">Speed Unit</div>
                  <div className="font-medium">{(data?.weekend_info as WeekendInfo)?.speed_unit || 'Unknown'}</div>
                </div>
              </div>
            </div>
            
            {/* Weather information */}
            <div className="bg-slate-800/50 rounded-lg p-2">
              <h4 className="text-sm uppercase text-slate-400 font-medium mb-2">Weather</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <div className="text-slate-400">Track Temp</div>
                  <div className="font-medium">
                    {data?.track_temp_c !== undefined 
                      ? `${data.track_temp_c.toFixed(1)}°C` 
                      : 'Unknown'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Air Temp</div>
                  <div className="font-medium">
                    {data?.air_temp_c !== undefined 
                      ? `${data.air_temp_c.toFixed(1)}°C` 
                      : 'Unknown'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Conditions</div>
                  <div className="font-medium">
                    {data?.skies || 'Unknown'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Humidity</div>
                  <div className="font-medium">
                    {data?.humidity_pct !== undefined 
                      ? `${Math.round(data.humidity_pct)}%` 
                      : 'Unknown'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Wind</div>
                  <div className="font-medium">
                    {data?.wind_vel_ms !== undefined 
                      ? `${data.wind_vel_ms.toFixed(1)} m/s ${formatWindDirection()}` 
                      : 'Unknown'}
                  </div>
                </div>
                <div>
                  <div className="text-slate-400">Fog</div>
                  <div className="font-medium">
                    {data?.fog_level_pct !== undefined 
                      ? `${Math.round(data.fog_level_pct)}%` 
                      : 'Unknown'}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Widget>
  );
};

export default WeekendInfoWidget; 