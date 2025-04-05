  // Render telemetry content
  const renderTelemetryContent = () => {
    if (!connected) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="text-red-500 font-bold mb-2">Disconnected</div>
          <div className="text-sm">Attempting to connect...</div>
        </div>
      );
    }
    
    if (!telemetryData) {
      return (
        <div className="flex flex-col items-center justify-center h-full p-4">
          <div className="text-blue-500 font-bold mb-2">Connected</div>
          <div className="text-sm">Waiting for data...</div>
        </div>
      );
    }
    
    return (
      <div className="flex flex-col items-center justify-center h-full p-4">
        <div className="text-lg font-semibold">
          {getMetricName(selectedMetric)}
        </div>
        <div className="text-4xl font-bold mt-2">
          {formatMetricValue(selectedMetric, telemetryData[selectedMetric])}
        </div>
      </div>
    );
  }; 