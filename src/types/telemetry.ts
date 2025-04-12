/**
 * Enum representing track surface values for iRacing
 * Matches the numerical values received from the backend
 */
export enum TrackSurface {
  OffTrack = 0,
  PitStall = 1,
  PitLane = 2,
  OnTrack = 3,
  NotInWorld = 4
} 

/**
 * Enum representing car left/right indicators from iRacing SDK
 * Matches the exact enum values from the Rust backend
 */
export enum CarLeftRight {
  Off = "Off",
  Clear = "Clear",       // no cars around us
  CarLeft = "CarLeft",   // there is a car to our left
  CarRight = "CarRight", // there is a car to our right
  CarLeftRight = "CarLeftRight", // there are cars on each side
  TwoCarsLeft = "TwoCarsLeft",   // there are two cars to our left
  TwoCarsRight = "TwoCarsRight"  // there are two cars to our right
}