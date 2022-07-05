import { AutomaticDoorOpener, DeviceEvent } from 'freeathome-devices';
import { Switch } from 'hap-nodejs/dist/lib/gen/HomeKit';
import { CharacteristicValue, CharacteristicGetCallback, CharacteristicEventTypes, CharacteristicSetCallback } from 'hap-nodejs';
import {Logging} from 'homebridge/lib/logger';
import { PlatformAccessory } from 'homebridge';
import { DeviceHandler } from './DeviceHandler';
import { API } from 'homebridge/lib/api';

export class AutomaticDoorOpenerHandler extends DeviceHandler {
    // homebridge
    private readonly switchService: Switch;

    constructor(
      log: Logging,
      api: API,
      accessory: PlatformAccessory,
        private automaticDoorOpener: AutomaticDoorOpener,
        config?: Record<string, any>,
    ) {
      super(log, api, accessory, automaticDoorOpener, config);

      this.log.info(this.automaticDoorOpener.getRoom()||'unknown', 'Set up automatic door opener');

      // hap
      const Service = this.api.hap.Service;
      const Characteristic = this.api.hap.Characteristic;

      // set up characteristics
      this.switchService = accessory.getService(Service.Switch) || accessory.addService(Service.Switch);
      this.switchService.getCharacteristic(Characteristic.On)
        .on(CharacteristicEventTypes.GET, this.getSwitchOn.bind(this))
        .on(CharacteristicEventTypes.SET, this.setSwitchOn.bind(this))
      ;

      // logging service
      this.setupLoggingService('switch');
    }

    public setDevice(automaticDoorOpener: AutomaticDoorOpener): void {
      this.log.debug(`Handing ${this.constructor.name} over to new automaticDoorOpener instance`);

      if(this.automaticDoorOpener) {
        this.automaticDoorOpener.removeAllListeners(DeviceEvent.CHANGE);
      }

      super.setDevice(automaticDoorOpener);
      this.automaticDoorOpener = automaticDoorOpener;

      // listen for events
      this.automaticDoorOpener.on(DeviceEvent.CHANGE, this.update.bind(this));

      // update
      this.update();
    }

    private update() {
      this.switchService.updateCharacteristic(this.api.hap.Characteristic.On, this.automaticDoorOpener.isEnabled());
      this.addLogEntry(this.automaticDoorOpener.isEnabled());

      // logging
      this.log.info(this.automaticDoorOpener.getRoom() || 'unknown',
        'Update automatic door opener state: ' + this.automaticDoorOpener.isEnabled());
    }

    /**
     * Get the switch state
     * @param callback
     */
    private getSwitchOn(callback: CharacteristicGetCallback) {
      callback(null, this.automaticDoorOpener.isEnabled());

      // logging
      this.log.info(this.automaticDoorOpener.getRoom() || 'unknown',
        'Get automatic door opener state: ' + this.automaticDoorOpener.isEnabled());
    }

    /**
     * Set the switch state
     * @param value
     * @param callback
     */
    private async setSwitchOn(value: CharacteristicValue, callback: CharacteristicSetCallback) {
      if(value === true) {
        await this.automaticDoorOpener.enable();
      } else {
        await this.automaticDoorOpener.disable();
      }

      callback();

      // logging
      this.log.info(this.automaticDoorOpener.getRoom() || 'unknown',
        'Set automatic door opener state: ' + value);
    }
}