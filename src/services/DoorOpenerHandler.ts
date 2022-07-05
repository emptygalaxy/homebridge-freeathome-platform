import { DeviceEvent, DoorOpener, DoorOpenerEvent} from 'freeathome-devices';
import { LockMechanism, ContactSensor } from 'hap-nodejs/dist/lib/gen/HomeKit';
import { CharacteristicGetCallback, CharacteristicEventTypes, CharacteristicValue, CharacteristicSetCallback } from 'hap-nodejs';
import {Logging} from 'homebridge/lib/logger';
import { PlatformAccessory } from 'homebridge';
import { DeviceHandler } from './DeviceHandler';
import { API } from 'homebridge/lib/api';

export class DoorOpenerHandler extends DeviceHandler {
    // homebridge
    private readonly doorLockService: LockMechanism;
    private readonly contactSensorService: ContactSensor;
    private locking = false;

    constructor(
      log: Logging,
      api: API,
      accessory: PlatformAccessory,
        private doorOpener: DoorOpener,
        config?: Record<string, any>,
    ) {
      super(log, api, accessory, doorOpener, config);

      this.log.info(this.doorOpener.getRoom()||'unknown', 'Setting up door opener', this.doorOpener.isOpen());

      // hap
      const Service = this.api.hap.Service;
      const Characteristic = this.api.hap.Characteristic;

      // set up characteristics
      this.doorLockService = accessory.getService(Service.LockMechanism) || accessory.addService(Service.LockMechanism);

      // LockCurrentState
      this.doorLockService.getCharacteristic(Characteristic.LockCurrentState)
        .on(CharacteristicEventTypes.GET, this.getLockCurrentState.bind(this));

      // LockTargetState
      this.doorLockService.getCharacteristic(Characteristic.LockTargetState)
        .on(CharacteristicEventTypes.GET, this.getLockTargetState.bind(this))
        .on(CharacteristicEventTypes.SET, this.setLockTargetState.bind(this))
      ;

      this.contactSensorService = accessory.getService(Service.ContactSensor) || accessory.addService(Service.ContactSensor);
      this.contactSensorService.getCharacteristic(Characteristic.ContactSensorState)
        .on(CharacteristicEventTypes.GET, this.getContactSensorState.bind(this))
      ;

      this.setupLoggingService('door');
      this.addLogEntry(false);
    }

    public setDevice(doorOpener: DoorOpener): void {

      if(this.doorOpener) {
        this.doorOpener.removeAllListeners(DoorOpenerEvent.OPENED);
        this.doorOpener.removeAllListeners(DoorOpenerEvent.CLOSED);
        this.doorOpener.removeAllListeners(DeviceEvent.CHANGE);
      }

      super.setDevice(doorOpener);
      this.doorOpener = doorOpener;


      // listen for events
      // this.doorOpener.on(DoorOpenerEvent.OPEN, this.update.bind(this));
      // this.doorOpener.on(DoorOpenerEvent.CLOSE, this.update.bind(this));
      this.doorOpener.on(DoorOpenerEvent.OPENED, this.opened.bind(this));
      this.doorOpener.on(DoorOpenerEvent.CLOSED, this.closed.bind(this));
      this.doorOpener.on(DeviceEvent.CHANGE, this.update.bind(this));

      this.update();
    }

    /**
     * Get the current door opener state
     * @param callback
     */
    getLockCurrentState(callback: CharacteristicGetCallback) {
      const Characteristic = this.api.hap.Characteristic;

      const lockCurrentState: CharacteristicValue = this.doorOpener.isOpen() ?
        Characteristic.LockCurrentState.UNSECURED :
        Characteristic.LockCurrentState.SECURED
        ;
      callback(null, lockCurrentState);

      // logging
      this.log.info(this.doorOpener.getRoom()||'unknown',
        'getLockCurrentState', this.getLockCurrentStateString(lockCurrentState),
        'lastUpdate', this.device.connection.lastUpdate,
      );
    }

    /**
     * Get the target door opener state
     * @param callback
     */
    getLockTargetState(callback: CharacteristicGetCallback) {
      const Characteristic = this.api.hap.Characteristic;

      const lockTargetState: number = (this.doorOpener.isOpening() || this.doorOpener.isOpen()) ?
        Characteristic.LockTargetState.UNSECURED :
        Characteristic.LockTargetState.SECURED
        ;
      callback(null, lockTargetState);

      // logging
      this.log.info(this.doorOpener.getRoom()||'unknown',
        'getLockTargetState', this.getLockTargetStateString(lockTargetState),
        'locking', this.locking,
        'isOpening()', this.doorOpener.isOpening(),
        'isOpen()', this.doorOpener.isOpen(),
      );
    }

    /**
     * Set the target door opener state
     * @param value
     * @param callback
     */
    async setLockTargetState(value: CharacteristicValue, callback: CharacteristicSetCallback) {
      const Characteristic = this.api.hap.Characteristic;

      this.locking = (value === Characteristic.LockTargetState.SECURED);

      if (this.locking) {
        await this.doorOpener.close();
      } else {
        this.log.info(this.doorOpener.getRoom() || 'unknown',
          'OPEN THE DOOR <=======================================================================');
        await this.doorOpener.open();
      }

      callback();

      // logging
      this.log.info(this.doorOpener.getRoom()||'unknown',
        'setLockTargetState', this.getLockTargetStateString(value),
      );
    }

    getContactSensorState(callback: CharacteristicGetCallback) {
      const contactSensorState: CharacteristicValue = this.api.hap.Characteristic.ContactSensorState.CONTACT_DETECTED;
      callback(null, contactSensorState);

      // logging
      this.log.info(this.doorOpener.getRoom()||'unknown',
        'getContactSensorState', this.getContactSensorStateString(contactSensorState),
      );
    }

    private opened() {
      this.addLogEntry(true);

      // logging
      this.log.info(this.doorOpener.getRoom()||'unknown', 'door was opened');
    }

    private closed() {
      this.addLogEntry(false);

      // logging
      this.log.info(this.doorOpener.getRoom()||'unknown', 'door was closed');
    }

    /**
     * Update characteristics for updates
     */
    private update() {
      const Characteristic = this.api.hap.Characteristic;

      // doorlock current state
      const lockCurrentState: CharacteristicValue = this.doorOpener.isOpen() ?
        Characteristic.LockCurrentState.UNSECURED :
        Characteristic.LockCurrentState.SECURED
        ;
      this.doorLockService.updateCharacteristic(Characteristic.LockCurrentState, lockCurrentState);

      // doorlock target state
      const lockTargetState: CharacteristicValue = (this.doorOpener.isOpening() || this.doorOpener.isOpen()) ?
        Characteristic.LockTargetState.UNSECURED :
        Characteristic.LockTargetState.SECURED
        ;
      this.doorLockService.updateCharacteristic(Characteristic.LockTargetState, lockTargetState);

      // contact sensor
      const contactSensorState: CharacteristicValue = (this.doorOpener.isOpening() || this.doorOpener.isOpen()) ?
        Characteristic.ContactSensorState.CONTACT_NOT_DETECTED :
        Characteristic.ContactSensorState.CONTACT_DETECTED
        ;
      this.contactSensorService.updateCharacteristic(Characteristic.ContactSensorState, contactSensorState);

      // logging
      const lockCurrentStateString: string = this.getLockCurrentStateString(lockCurrentState);
      const lockTargetStateString: string = this.getLockTargetStateString(lockTargetState);
      const contactSensorStateString: string = this.getContactSensorStateString(contactSensorState);
      this.log.info(this.doorOpener.getRoom()||'unknown', 'door updated',
        'isOpen:', this.doorOpener.isOpen(),
        'isOpening:', this.doorOpener.isOpening(),
        'LockCurrentState', lockCurrentStateString,
        'LockTargetState', lockTargetStateString,
        'ContactSensorState', contactSensorStateString,
      );
    }

    private getLockCurrentStateString(state: CharacteristicValue): string {
      switch(state) {
        case this.api.hap.Characteristic.LockCurrentState.SECURED:
          return 'SECURED';
        case this.api.hap.Characteristic.LockCurrentState.UNSECURED:
          return 'UNSECURED';
        default:
          return 'unknown';
      }
    }

    private getLockTargetStateString(state: CharacteristicValue): string {
      switch(state) {
        case this.api.hap.Characteristic.LockTargetState.SECURED:
          return 'SECURED';
        case this.api.hap.Characteristic.LockTargetState.UNSECURED:
          return 'UNSECURED';
        default:
          return 'unknown';
      }
    }

    private getContactSensorStateString(state: CharacteristicValue): string {
      switch(state) {
        case this.api.hap.Characteristic.ContactSensorState.CONTACT_NOT_DETECTED:
          return 'CONTACT_NOT_DETECTED';
        case this.api.hap.Characteristic.ContactSensorState.CONTACT_DETECTED:
          return 'CONTACT_DETECTED';
        default:
          return 'unknown';
      }
    }
}