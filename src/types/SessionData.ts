export interface SessionData {
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
      position?: number;
      incidents?: number;
      [key: string]: any;
    }>;
    [key: string]: any;
  };
  [key: string]: any;
} 