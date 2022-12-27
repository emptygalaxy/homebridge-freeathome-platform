import {CreatePeriodInSeconds} from './PeriodInSeconds';
import {CreateAutomaticOff} from './AutomaticOff';

let SwitchProgram, AutomaticOff, PeriodInSeconds;
export function CreateSwitchProgram(Service, Characteristic): typeof Service {
  AutomaticOff = CreateAutomaticOff(Characteristic);
  PeriodInSeconds = CreatePeriodInSeconds(Characteristic);

  SwitchProgram = class extends Service {
    static readonly UUID: string = 'FD92B7CF-A343-4D7E-9467-FD251E22C374';

    constructor(displayName: string) {
      super(displayName, SwitchProgram.UUID);

      // Optional Characteristics
      this.addOptionalCharacteristic(PeriodInSeconds);
      this.addOptionalCharacteristic(AutomaticOff);
    }
  };

  return SwitchProgram;
}