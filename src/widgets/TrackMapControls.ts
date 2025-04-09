import { useCallback } from 'react';
import { WidgetControlDefinition, WidgetControlType } from './WidgetRegistry';

export type MapBuildingState = 'idle' | 'recording' | 'complete';
export type ColorMode = 'curvature' | 'acceleration' | 'none';

export interface TrackMapState {
  mapBuildingState: MapBuildingState;
  colorMode: ColorMode;
}

/**
 * Hook to get TrackMap widget controls
 * @param state Current widget state
 * @param updateWidget Function to update widget state
 * @returns Array of control definitions
 */
export function useTrackMapControls(
  state: TrackMapState,
  updateWidget: (updates: Partial<TrackMapState>) => void
): WidgetControlDefinition[] {
  return useCallback(() => {
    const controls: WidgetControlDefinition[] = [
      {
        type: 'select' as WidgetControlType,
        id: 'colorMode',
        label: 'Color Mode',
        value: state.colorMode || 'none',
        options: [
          { value: 'none', label: 'Default' },
          { value: 'curvature', label: 'Curvature' },
          { value: 'acceleration', label: 'Acceleration' }
        ],
        onChange: (value) => updateWidget({ colorMode: value as ColorMode })
      }
    ];
    
    if (state.mapBuildingState === 'recording') {
      controls.push({
        type: 'button' as WidgetControlType,
        id: 'stopRecording',
        label: 'Stop Recording',
        value: undefined,
        options: [],
        onChange: () => updateWidget({ mapBuildingState: 'complete' })
      });
    } else if (state.mapBuildingState === 'complete') {
      controls.push({
        type: 'button' as WidgetControlType,
        id: 'startRecording',
        label: 'Start New Recording',
        value: undefined,
        options: [],
        onChange: () => updateWidget({ mapBuildingState: 'idle' })
      });
    }
    
    return controls;
  }, [state, updateWidget])();
}

export default useTrackMapControls; 