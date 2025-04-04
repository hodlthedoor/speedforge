/// <reference path="../types/electron.d.ts" />
import React from 'react';
import { BaseWidget, BaseWidgetProps } from './BaseWidget';
import { withWidgetRegistration } from './WidgetManager';

interface WeatherWidgetProps extends BaseWidgetProps {
  location?: string;
}

interface WeatherData {
  temperature: number;
  condition: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'snowy';
  humidity: number;
  windSpeed: number;
}

class WeatherWidgetBase extends BaseWidget<WeatherWidgetProps> {
  constructor(props: WeatherWidgetProps) {
    super(props);
    
    // Extend the base state with weather-specific properties
    this.state = {
      ...this.state,
      weather: this.generateMockWeatherData(),
      loading: false,
      error: null
    };
  }

  private refreshTimer: number | null = null;

  componentDidMount() {
    this.refreshTimer = window.setInterval(() => {
      this.updateWeather();
    }, 60000); // Update every minute
  }

  componentWillUnmount() {
    if (this.refreshTimer) {
      window.clearInterval(this.refreshTimer);
    }
  }

  updateWeather() {
    // In a real application, you would fetch actual weather data here
    this.setState({
      weather: this.generateMockWeatherData(),
      loading: false,
      error: null
    });
  }

  generateMockWeatherData(): WeatherData {
    const conditions: WeatherData['condition'][] = ['sunny', 'cloudy', 'rainy', 'stormy', 'snowy'];
    return {
      temperature: Math.floor(Math.random() * 35) - 5, // -5 to 30 degrees
      condition: conditions[Math.floor(Math.random() * conditions.length)],
      humidity: Math.floor(Math.random() * 100),
      windSpeed: Math.floor(Math.random() * 30),
    };
  }

  getConditionIcon(condition: WeatherData['condition']): string {
    switch (condition) {
      case 'sunny': return '☀️';
      case 'cloudy': return '☁️';
      case 'rainy': return '🌧️';
      case 'stormy': return '⛈️';
      case 'snowy': return '❄️';
      default: return '🌡️';
    }
  }

  renderContent() {
    const { weather, loading, error } = this.state;
    const { location = 'Current Location' } = this.props;

    if (loading) {
      return (
        <div className="h-full flex items-center justify-center">
          <p>Loading weather data...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="h-full flex items-center justify-center">
          <p className="text-red-500">Error: {error}</p>
        </div>
      );
    }

    return (
      <div className="h-full flex flex-col p-4">
        <h3 className="text-xl font-semibold mb-2">Weather</h3>
        <div className="text-sm text-gray-600 mb-4">{location}</div>
        
        <div className="flex items-center justify-center flex-1">
          <div className="text-5xl mr-4">{this.getConditionIcon(weather.condition)}</div>
          <div>
            <div className="text-3xl font-bold">{weather.temperature}°C</div>
            <div className="text-gray-600 capitalize">{weather.condition}</div>
          </div>
        </div>
        
        <div className="flex justify-between text-sm text-gray-600 mt-2">
          <div>Humidity: {weather.humidity}%</div>
          <div>Wind: {weather.windSpeed} km/h</div>
        </div>
        
        <button 
          onClick={() => this.updateWeather()}
          className="mt-3 text-sm text-blue-600 hover:text-blue-800 non-draggable"
        >
          Refresh
        </button>
      </div>
    );
  }
}

export const WeatherWidget = withWidgetRegistration<WeatherWidgetProps>(WeatherWidgetBase, 'weather'); 