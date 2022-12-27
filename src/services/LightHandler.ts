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
import {Light, LightEvent} from 'freeathome-devices';
import {DeviceHandler} from './DeviceHandler';
import {DeviceConfig} from '../FreeAtHomePlatformConfig';

export class LightHandler extends DeviceHandler {
  // homebridge
  private lightService: Service;

  constructor(
    log: Logging,
    api: API,
    accessory: PlatformAccessory,
    private light: Light,
    config?: DeviceConfig,
  ) {
    super(log, api, accessory, light, config);

    this.log.info(this.light.getRoom() || 'unknown', 'Set up light');

    // hap
    const Service = this.api.hap.Service;
    const Characteristic = this.api.hap.Characteristic;

    // set up characteristics
    this.lightService = accessory.getService(Service.Lightbulb) || accessory.addService(Service.Lightbulb);
    this.lightService.getCharacteristic(Characteristic.On)
      .on(CharacteristicEventTypes.GET, this.getLightOn.bind(this))
      .on(CharacteristicEventTypes.SET, this.setLightOn.bind(this))
    ;

    // logging service
    this.setupLoggingService('switch');
    this.addLogEntry(this.light.isOn());
  }

  public setDevice(light: Light): void {

    if (this.light) {
      this.light.removeAllListeners(LightEvent.TURNED_ON);
      this.light.removeAllListeners(LightEvent.TURNED_OFF);
    }

    super.setDevice(light);
    this.light = light;

    // listen for events
    this.light.on(LightEvent.TURNED_ON, this.update.bind(this));
    this.light.on(LightEvent.TURNED_OFF, this.update.bind(this));

    this.update();
  }

  private update() {
    this.lightService.updateCharacteristic(this.api.hap.Characteristic.On, this.light.isOn());
    this.addLogEntry(this.light.isOn());
  }

  /**
   * Get the switch state
   * @param callback
   */
  private getLightOn(callback: CharacteristicGetCallback) {
    this.log.info(this.light.getRoom() || 'unknown', 'Get call button state: ' + this.light.isOn());
    callback(null, this.light.isOn());
  }

  /**
   * Set the switch state
   * @param value
   * @param callback
   */
  private async setLightOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
    this.log.info(this.light.getRoom() || 'unknown', 'Set light on: ' + value);

    if (value === true) {
      await this.light.turnOn();
    } else {
      await this.light.turnOff();
    }

    callback();
  }
}
