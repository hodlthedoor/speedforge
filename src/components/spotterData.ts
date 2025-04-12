// Define trigger conditions for automatic TTS
export type TriggerCondition = 'manual' | 'interval' | 'telemetry' | 'threshold';

export interface TriggerConfig {
  condition: TriggerCondition;
  interval?: number; // in ms, for interval
  telemetryKey?: string; // for telemetry-based triggers
  threshold?: number; // for threshold-based triggers
  comparison?: 'gt' | 'lt' | 'eq' | 'change'; // greater than, less than, equal, any change
  lastValue?: any; // to track changes
  lastTriggered?: number; // timestamp of last trigger
  cooldown?: number; // minimum time between triggers in ms
  value?: number; // value for comparison
}

// Interface for trigger events
export interface TriggerEvent {
  id: string;
  name: string;
  enabled: boolean;
  trigger: TriggerConfig;
  phrases: string[]; // Array of possible phrases to choose from randomly
  lastUsedPhraseIndex?: number; // Optionally track last used phrase to avoid repetition
}

// Default spotter triggers
export const defaultTriggers: TriggerEvent[] = [
  { 
    id: '1',
    name: 'Speed Announcement',
    enabled: true,
    trigger: {
      condition: 'telemetry',
      telemetryKey: 'speed',
      comparison: 'change',
      interval: 50,
      cooldown: 10000
    },
    phrases: [
      "You're doing {{speed}} now",
      "Speed is {{speed}}",
      "{{speed}} on the dial",
      "Moving at {{speed}} now",
      "We're at {{speed}}",
      "{{speed}} keep it steady",
      "Running {{speed}} now"
    ]
  },
  {
    id: '2',
    name: 'Low Fuel Warning',
    enabled: true,
    trigger: {
      condition: 'telemetry',
      telemetryKey: 'fuelPercent',
      comparison: 'lt',
      value: 15,
      cooldown: 30000
    },
    phrases: [
      "Fuel's getting low you've got {{fuelLaps}} laps left",
      "Fuel warning {{fuelPercent}} percent remaining about {{fuelLaps}} laps left",
      "You're running on fumes {{fuelPercent}} percent left",
      "Fuel critical {{fuelLaps}} laps of fuel remaining",
      "Running low {{fuelPercent}} percent fuel left",
      "Watch your fuel {{fuelLaps}} laps remaining",
      "Fuel alert {{fuelPercent}} percent left in the tank",
      "Fuel situation critical {{fuelLaps}} laps left"
    ]
  },
  { 
    id: '3',
    name: 'Car Left Alert',
    enabled: true,
    trigger: { 
      condition: 'telemetry',
      telemetryKey: 'carLeft',
      comparison: 'change',
      lastValue: false,
      cooldown: 3000
    },
    phrases: [
      "Car on your left you blind fuck move or get your ass kissed!",
      "Left side's got a bastard sneaking don't let him tickle your nuts!",
      "Watch your left dipshit some prick's trying to steal your lunch!",
      "Left's got a greasy fucker block him or I'll slap you myself!",
      "Car left you twat wake up before he shoves it up your tailpipe!",
      "Left flank's got a cockroach squash that son of a bitch!",
      "Some asshole's on your left don't let him hump your bumper!",
      "Left's got a shit-stain closing in hold the line you animal!",
      "Car on your left genius quit jerking off and defend!",
      "Left's got a weasel sniffing your tires kick his nuts back!",
      "Watch left you muppet trouble's got a hard-on for you!",
      "Left side's got a turd don't let him wipe you out!",
      "Car left you numb-nuts he's itching to fuck your race!",
      "Left's got a sleazy prick keep him in the dirt mate!",
      "Some jackass is left slam the door or you're his bitch!",
      "Left's got a vulture circling don't let him pick your bones!",
      "Car on your left you wanker he's closer than your ex's lawyer!",
      "Left side's got a leech shake that fucker off now!",
      "Watch your left asshole someone's trying to ruin your day!",
      "Left's got a shit-kicker don't let him dance on your grave!",
      "Car left you slowpoke he's practically in your goddamn lap!",
      "Left's got a buzzard swat him before he shits on you!",
      "Some dickhead's on your left keep him back or I'll puke!",
      "Left side's got a snake don't let him slither past you nobber!",
      "Car on your left mate he's hungrier than a whore at closing!"
    ]
  },
  { 
    id: '4',
    name: 'Car Right Alert',
    enabled: true,
    trigger: { 
      condition: 'telemetry',
      telemetryKey: 'carRight',
      comparison: 'change',
      lastValue: false,
      cooldown: 3000
    },
    phrases: [
      "Car on your right you blind fuck move or get your ass kicked!",
      "Right side's got a bastard creeping don't let him tickle your nuts!",
      "Watch your right dipshit some prick's trying to steal your position!",
      "Right's got a greasy fucker block him or I'll slap you myself!",
      "Car right you twat wake up before he shoves it up your tailpipe!",
      "Right flank's got a cockroach squash that son of a bitch!",
      "Some asshole's on your right don't let him hump your bumper!",
      "Right's got a shit-stain closing in hold the line you animal!",
      "Car on your right genius quit jerking off and defend!",
      "Right's got a weasel sniffing your tires kick his nuts back!",
      "Watch right you muppet trouble's got a hard-on for you!",
      "Right side's got a turd don't let him wipe you out!",
      "Car right you numb-nuts he's itching to fuck your race!",
      "Right's got a sleazy prick keep him in the dirt mate!",
      "Some jackass is right slam the door or you're his bitch!",
      "Right's got a vulture circling don't let him pick your bones!",
      "Car on your right you wanker he's closer than your ex's lawyer!",
      "Right side's got a leech shake that fucker off now!",
      "Watch your right asshole someone's trying to ruin your day!",
      "Right's got a shit-kicker don't let him dance on your grave!",
      "Car right you slowpoke he's practically in your goddamn lap!",
      "Right's got a buzzard swat him before he shits on you!",
      "Some dickhead's on your right keep him back or I'll puke!",
      "Right side's got a snake don't let him slither past you nobber!",
      "Car on your right mate he's hungrier than a whore at closing!"
    ]
  },
  { 
    id: '5',
    name: 'Two Cars Left Alert',
    enabled: true,
    trigger: { 
      condition: 'telemetry',
      telemetryKey: 'twoCarsLeft',
      comparison: 'change',
      lastValue: false,
      cooldown: 3000
    },
    phrases: [
      "Two cars left, you blind fuck—they're gagging to gangbang your bumper!",
      "Left side's got a pair of pricks—don't let 'em double-team you!",
      "Watch your left, asshole—two bastards are sniffing your sweaty ass!",
      "Two on your left, dipshit—block 'em or you're their bitch!",
      "Left's got two greasy fuckers—hold tight or get fucked twice!",
      "Two cars left, you twat—they're closer than your ex's grudges!",
      "Left flank's got a duo of dicks—swat 'em before they screw you!",
      "Two shitheads on your left—don't let 'em spit-roast your race!",
      "Cars left, genius—two tools are ready to ruin your fucking day!",
      "Left's got a couple of cockroaches—squash 'em or cry, mate!",
      "Watch left, you muppet—two vultures want your nuts for lunch!",
      "Two turds on your left—keep 'em back or kiss your ass goodbye!",
      "Left's got two shit-stains—they're itching to wipe you out!",
      "Two cars left, you wanker—they're hungrier than whores at happy hour!",
      "Left side's got a pair of leeches—shake 'em off or bleed!",
      "Two jackasses left—don't let 'em shove it up your tailpipe!",
      "Left's got two buzzards circling—slam the door or you're roadkill!",
      "Two cars on your left, prick—they're closer than your bad decisions!",
      "Left's got a double dose of fuckwits—block 'em or eat dirt!",
      "Watch your left, nobber—two chumps are gunning for your glory!",
      "Two greasy pricks left—don't let 'em tag-team your tires!",
      "Left's got two snakes—don't let 'em slither into your goddamn lap!",
      "Two cars left, you slowpoke—they're ready to fuck you sideways!",
      "Left side's got a pair of shit-kickers—keep 'em in the gutter!",
      "Two tools on your left—hold the line or you're screwed twice!",
      "Left's got two filthy bastards—they're drooling for your spot!",
      "Watch left, you nutcase—two tossers want to piss on your race!",
      "Two cars left, mate—they're closer than a drunk's bad breath!",
      "Left's got a couple of weasels—don't let 'em hump your exhaust!",
      "Two fuckers on your left—fight 'em off or you're their lunch!"
    ]
  },
  { 
    id: '6',
    name: 'Two Cars Right Alert',
    enabled: true,
    trigger: { 
      condition: 'telemetry',
      telemetryKey: 'twoCarsRight',
      comparison: 'change',
      lastValue: false,
      cooldown: 3000
    },
    phrases: [
      "Two cars right, you blind fuck—they're gagging to gangbang your bumper!",
      "Right side's got a pair of pricks—don't let 'em double-team you!",
      "Watch your right, asshole—two bastards are sniffing your sweaty ass!",
      "Two on your right, dipshit—block 'em or you're their bitch!",
      "Right's got two greasy fuckers—hold tight or get fucked twice!",
      "Two cars right, you twat—they're closer than your ex's grudges!",
      "Right flank's got a duo of dicks—swat 'em before they screw you!",
      "Two shitheads on your right—don't let 'em spit-roast your race!",
      "Cars right, genius—two tools are ready to ruin your fucking day!",
      "Right's got a couple of cockroaches—squash 'em or cry, mate!",
      "Watch right, you muppet—two vultures want your nuts for lunch!",
      "Two turds on your right—keep 'em back or kiss your ass goodbye!",
      "Right's got two shit-stains—they're itching to wipe you out!",
      "Two cars right, you wanker—they're hungrier than whores at happy hour!",
      "Right side's got a pair of leeches—shake 'em off or bleed!",
      "Two jackasses right—don't let 'em shove it up your tailpipe!",
      "Right's got two buzzards circling—slam the door or you're roadkill!",
      "Two cars on your right, prick—they're closer than your bad decisions!",
      "Right's got a double dose of fuckwits—block 'em or eat dirt!",
      "Watch your right, nobber—two chumps are gunning for your glory!",
      "Two greasy pricks right—don't let 'em tag-team your tires!",
      "Right's got two snakes—don't let 'em slither into your goddamn lap!",
      "Two cars right, you slowpoke—they're ready to fuck you sideways!",
      "Right side's got a pair of shit-kickers—keep 'em in the gutter!",
      "Two tools on your right—hold the line or you're screwed twice!",
      "Right's got two filthy bastards—they're drooling for your spot!",
      "Watch right, you nutcase—two tossers want to piss on your race!",
      "Two cars right, mate—they're closer than a drunk's bad breath!",
      "Right's got a couple of weasels—don't let 'em hump your exhaust!",
      "Two fuckers on your right—fight 'em off or you're their lunch!"
    ]
  },
  { 
    id: '7',
    name: 'Cars Both Sides Alert',
    enabled: true,
    trigger: { 
      condition: 'telemetry',
      telemetryKey: 'carsLeftRight',
      comparison: 'change',
      lastValue: false,
      cooldown: 3000
    },
    phrases: [
      "CARS ON BOTH SIDES! You're sandwiched tight!",
      "BOTH SIDES! You're in the fucking middle!",
      "LEFT AND RIGHT! Squeeze yourself skinny!",
      "BOTH SIDES BOTH SIDES! You're getting double teamed!",
      "PINNED BETWEEN TWO CARS! Drive like a virgin!",
      "CARS EVERYWHERE! Don't even breathe!",
      "PINCHED LEFT AND RIGHT! They want your spot!",
      "DANGER BOTH SIDES! Thread the fucking needle!",
      "CARS LEFT AND RIGHT! Make yourself thin!",
      "SANDWICHED! Don't move an inch!"
    ]
  }
];

// Default telemetry data
export const defaultTelemetryData = {
  speed: 0,
  rpm: 0,
  gear: 0,
  fuel: 100,
  lap: 1,
  position: 1,
  carLeft: false,
  carRight: false,
  twoCarsLeft: false,
  twoCarsRight: false,
  carsLeftRight: false
};

// Helper function to process placeholder text with telemetry data
export function processText(text: string, telemetryData: Record<string, any>): string {
  return text.replace(/{([^}]+)}/g, (match, key) => {
    const value = telemetryData[key];
    
    if (value === undefined) {
      return match; // Keep original placeholder if key not found
    }
    
    // Format value based on type
    if (typeof value === 'number') {
      // Check if it's an integer by using Number.isInteger
      return value.toFixed(Number.isInteger(value) ? 0 : 1);
    }
    
    return String(value);
  });
}

// Create a new trigger with default values
export function createNewTrigger(): TriggerEvent {
  return {
    id: Date.now().toString(),
    name: 'New Trigger',
    enabled: true,
    trigger: {
      condition: 'manual'
    },
    phrases: ['New phrase']
  };
} 