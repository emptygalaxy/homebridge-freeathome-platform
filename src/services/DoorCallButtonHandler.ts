import {DoorCall} from 'freeathome-devices';
import type {
  API,
  CharacteristicGetCallback,
  CharacteristicSetCallback,
  CharacteristicValue,
  Logging,
  PlatformAccessory,
  Service,
} from 'homebridge';
import {CharacteristicEventTypes} from 'homebridge';
import {DoorCallHandler} from './DoorCallHandler';
import {DoorCallConfig} from '../FreeAtHomePlatformConfig';

export class DoorCallButtonHandler extends DoorCallHandler {
  private readonly switchService: Service;
  private switchActive = false;

  constructor(
    log: Logging,
    api: API,
    accessory: PlatformAccessory,
    doorCall: DoorCall,
    config?: DoorCallConfig,
  ) {
    super(log, api, accessory, doorCall, config);

    if (!this.doorCall.triggerEnabled()) {
      throw new Error(this.doorCall.getRoom() || 'unknown' + ' DoorCall has no trigger, please use DoorCallHandler instead');
    }

    // hap
    const Service = this.api.hap.Service;
    const Characteristic = this.api.hap.Characteristic;

    this.switchService = accessory.getService(Service.Switch) || accessory.addService(Service.Switch);
    this.switchService.getCharacteristic(Characteristic.On)
      .on(CharacteristicEventTypes.GET, this.getSwitchOn.bind(this))
      .on(CharacteristicEventTypes.SET, this.setSwitchOn.bind(this))
    ;
  }

  protected restoreState() {
    super.restoreState();

    this.switchActive = false;
    this.switchService.updateCharacteristic(this.api.hap.Characteristic.On, this.switchActive);
  }

  /**
   * Get the switch state
   * @param callback
   */
  private getSwitchOn(callback: CharacteristicGetCallback) {
    callback(null, this.switchActive);

    this.log.info(this.doorCall.getRoom() || 'unknown', 'Get call button state: ' + this.switchActive);
  }

  /**
   * Set the switch state
   * @param value
   * @param callback
   */
  private async setSwitchOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.switchActive = value as boolean;

    this.log.info(this.doorCall.getRoom() || 'unknown', 'Set call button state: ' + this.switchActive);

    callback();

    // call SysAp
    if (this.switchActive) {
      this.log.info(this.doorCall.getRoom() || 'unknown', 'Ring the bell!');
      await this.doorCall.trigger();
    }

    this.addLogEntry(this.switchActive);
  }
}
