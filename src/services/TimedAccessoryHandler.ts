import {DeviceHandler} from './DeviceHandler';
import type {
  API,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  Logging,
  PlatformAccessory,
  Service,
} from 'homebridge';
import {CharacteristicEventTypes, Perms} from 'homebridge';
import {AutomaticDoorOpener, DoorCall, DoorOpener} from 'freeathome-devices';
import {CreateSlider} from '../types/Slider';
import {CreateSliderValue} from '../types/SliderValue';
import {CreateSwitchProgram} from '../types/SwitchProgram';
import {CreateAutomaticOff} from '../types/AutomaticOff';
import {CreatePeriodInSeconds} from '../types/PeriodInSeconds';
import {TimerDeviceConfig} from '../FreeAtHomePlatformConfig';
import Timeout = NodeJS.Timeout;

let SwitchProgram, AutomaticOff, PeriodInSeconds, Slider, SliderValue;

export class TimedAccessoryHandler extends DeviceHandler {
  private readonly switchService?: Service;
  private readonly garageDoorService?: Service;
  private readonly switchProgramService: Service;
  private readonly sliderService?: Service;

  private readonly maxDelay: number = 15 * 60;
  private armed = false;
  private delay = 170;
  private timeLeft = 0;
  private timeout?: Timeout;

  private tickInterval?: Timeout;
  private readonly tickEnabled: boolean = true;
  private readonly tickFrequency = 1000;

  constructor(
    log: Logging,
    api: API,
    accessory: PlatformAccessory,
    device: AutomaticDoorOpener | DoorCall | DoorOpener,
    config?: TimerDeviceConfig,
  ) {
    super(log, api, accessory, device, config);

    // hap
    const Service = this.api.hap.Service;
    const Characteristic = this.api.hap.Characteristic;
    SwitchProgram = CreateSwitchProgram(Service, Characteristic);
    AutomaticOff = CreateAutomaticOff(Characteristic);
    PeriodInSeconds = CreatePeriodInSeconds(Characteristic);
    Slider = CreateSlider(Service, Characteristic);
    SliderValue = CreateSliderValue(Characteristic);

    // name
    const roomName = this.device.getDisplayName() || 'unknown';

    const displayName = roomName + ' timer';
    const timerAsGarageOpener = (config !== undefined && config.timer?.type === 'garagedoor');

    let expiredServiceType;

    // controller
    if (timerAsGarageOpener) {
      this.garageDoorService = accessory.getService(Service.GarageDoorOpener) ||
        accessory.addService(Service.GarageDoorOpener, displayName);
      this.garageDoorService.getCharacteristic(Characteristic.CurrentDoorState)
        .on(CharacteristicEventTypes.GET, this.getCurrentDoorState.bind(this));
      this.garageDoorService.getCharacteristic(Characteristic.TargetDoorState)
        .on(CharacteristicEventTypes.GET, this.getTargetDoorState.bind(this))
        .on(CharacteristicEventTypes.SET, this.setTargetDoorState.bind(this))
      ;
      this.garageDoorService.getCharacteristic(Characteristic.ObstructionDetected)
        .on(CharacteristicEventTypes.GET, TimedAccessoryHandler.getObstructionDetected.bind(this))
      ;

      expiredServiceType = Service.Switch;
    } else {
      this.switchService = accessory.getService(Service.Switch) || accessory.addService(Service.Switch, displayName);
      this.switchService.getCharacteristic(Characteristic.On)
        .on(CharacteristicEventTypes.GET, this.getSwitchOn.bind(this))
        .on(CharacteristicEventTypes.SET, this.setSwitchOn.bind(this))
      ;

      expiredServiceType = Service.GarageDoorOpener;
    }

    if (expiredServiceType) {
      const expiredService = accessory.getService(expiredServiceType);
      if (expiredService) {
        accessory.removeService(expiredService);
      }
    }

    // default times
    this.delay = config?.timer?.delay as number || this.delay;
    this.maxDelay = Math.max(this.maxDelay, this.delay);

    // timer
    this.switchProgramService = accessory.getService(SwitchProgram) || accessory.addService(SwitchProgram, 'Switch delay');
    this.switchProgramService.getCharacteristic(PeriodInSeconds)
      .on(CharacteristicEventTypes.GET, this.getSwitchProgramPeriodInSeconds.bind(this))
      .on(CharacteristicEventTypes.SET, this.setSwitchProgramPeriodInSeconds.bind(this))
      .setProps({
        minValue: 0,
        maxValue: this.maxDelay,
      })
    ;

    // slider
    if (this.tickEnabled) {
      this.sliderService = accessory.getService(Slider) || accessory.addService(Slider, 'Time left');
      this.sliderService.getCharacteristic(SliderValue)
        .on(CharacteristicEventTypes.GET, this.getSliderValue.bind(this))
        .setProps({
          minValue: 0,
          maxValue: this.maxDelay,
          perms: [Perms.PAIRED_READ],
        })
      ;
    }
  }

  private static getObstructionDetected(callback: CharacteristicGetCallback): void {
    callback(null, false);
  }

  public setDevice(device: AutomaticDoorOpener | DoorCall | DoorOpener): void {
    super.setDevice(device);
  }

  public arm(): void {
    this.log.info('Timer armed');
    this.armed = true;
    this.timeout = setTimeout(this.timerEnded.bind(this), this.delay * 1000);

    if (this.tickEnabled) {
      this.timeLeft = this.delay;
      this.tickInterval = setInterval(this.tick.bind(this), this.tickFrequency);
    }
  }

  public disarm(): void {
    this.armed = false;

    if (this.timeout) {
      clearTimeout(this.timeout);
      this.timeout = undefined;
    }

    if (this.tickInterval) {
      clearInterval(this.tickInterval);
      this.tickInterval = undefined;
    }

    this.timeLeft = 0;
    this.sliderService?.getCharacteristic(SliderValue).updateValue(this.timeLeft);
  }

  /**
   * Get the switch state
   * @param callback
   */
  private getSwitchOn(callback: CharacteristicGetCallback): void {
    callback(null, this.armed);

    // logging
    this.log.info(this.device.getRoom() || 'unknown',
      'Get timed door opener state: ' + this.armed,
    );
  }

  /**
   * Get the garage door state
   * @param callback
   */
  private getCurrentDoorState(callback: CharacteristicGetCallback): void {
    const state = this.decideCurrentDoorState();
    callback(null, state);

    // logging
    this.log.info(this.device.getRoom() || 'unknown',
      'Get timed door opener state: ' + this.armed,
    );
  }

  private decideCurrentDoorState(): CharacteristicValue {
    const Characteristic = this.api.hap.Characteristic;

    if (this.device instanceof DoorOpener) {
      const doorOpener: DoorOpener = this.device as DoorOpener;
      if (doorOpener.isOpen()) {
        return Characteristic.CurrentDoorState.OPEN;
      } else if (this.armed) {
        return Characteristic.CurrentDoorState.OPEN;
      }
      // return Characteristic.CurrentDoorState.OPENING;
    }

    return Characteristic.CurrentDoorState.CLOSED;
  }

  /**
   * Get the garage door state
   * @param callback
   */
  private getTargetDoorState(callback: CharacteristicGetCallback): void {
    const Characteristic = this.api.hap.Characteristic;
    const state: CharacteristicValue = this.armed ? Characteristic.TargetDoorState.OPEN : Characteristic.TargetDoorState.CLOSED;
    callback(null, state);

    // logging
    this.log.info(this.device.getRoom() || 'unknown',
      'Get timed door opener state: ' + this.armed,
    );
  }

  /**
   * Set the switch state
   * @param value
   * @param callback
   */
  private setSwitchOn(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    if (value === true) {
      this.arm();
    } else {
      this.disarm();
    }

    callback();

    // logging
    this.log.info(this.device.getRoom() || 'unknown',
      'Set timed door opener state: ' + value,
    );
  }

  /**
   * Set the switch state
   * @param value
   * @param callback
   */
  private setTargetDoorState(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    const Characteristic = this.api.hap.Characteristic;
    if (value === Characteristic.TargetDoorState.OPEN) {
      this.arm();
    } else {
      this.disarm();
    }

    callback();

    const currentDoorState = this.decideCurrentDoorState();
    this.garageDoorService?.getCharacteristic(Characteristic.CurrentDoorState).updateValue(currentDoorState);

    // logging
    this.log.info(this.device.getRoom() || 'unknown',
      'Set timed door opener state: ' + value,
    );
  }

  private getSwitchProgramPeriodInSeconds(callback: CharacteristicGetCallback): void {
    this.log.info('set period in seconds', this.delay);
    callback(null, this.delay);
  }

  private setSwitchProgramPeriodInSeconds(value: CharacteristicValue, callback: CharacteristicSetCallback): void {
    this.delay = value as number;
    this.log.info('set period in seconds', value);
    callback(null);
  }

  private getSliderValue(callback: CharacteristicGetCallback): void {
    this.log.info('Get slider value');
    callback(null, this.timeLeft);
  }

  private tick(): void {
    const value = this.timeLeft--;

    if (this.sliderService) {
      this.sliderService.getCharacteristic(SliderValue)
        .updateValue(value);
    }
  }

  private async timerEnded(): Promise<void> {
    // invoke action
    if (this.device instanceof AutomaticDoorOpener) {
      await this.device.enable();
    } else if (this.device instanceof DoorCall) {
      await this.device.trigger();
    } else if (this.device instanceof DoorOpener) {
      await this.device.open();
    }

    this.disarm();

    const Characteristic = this.api.hap.Characteristic;

    if (this.switchService) {
      this.switchService?.getCharacteristic(Characteristic.On).updateValue(this.armed);
    }

    if (this.garageDoorService) {
      const currentDoorState = this.decideCurrentDoorState();
      this.garageDoorService?.getCharacteristic(Characteristic.CurrentDoorState).updateValue(currentDoorState);
      this.garageDoorService?.getCharacteristic(Characteristic.TargetDoorState).updateValue(Characteristic.TargetDoorState.CLOSED);
    }
  }
}
