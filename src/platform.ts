import { API, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig } from 'homebridge';
import { Characteristic, Service } from 'hap-nodejs';

import { PLATFORM_NAME, PLUGIN_NAME } from './settings';

import {
  DeviceManager,
  Device,
  HomeTouchPanel,
  SubDevice,
  DoorCall,
  AutomaticDoorOpener,
  DoorOpener,
  Light,
} from 'freeathome-devices';
import { ClientConfiguration } from 'freeathome-api';
import {DoorCallHandler} from './services/DoorCallHandler';
import {ConnectionEvent} from 'freeathome-devices/dist/Connection';
import {DeviceHandler} from './services/DeviceHandler';
import {AutomaticDoorOpenerHandler} from './services/AutomaticDoorOpenerHandler';
import {DoorOpenerHandler} from './services/DoorOpenerHandler';
import {LightHandler} from './services/LightHandler';
import {DoorCallButtonHandler} from './services/DoorCallButtonHandler';

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class FreeAtHomePlatform implements DynamicPlatformPlugin {
  public readonly Service: typeof Service = this.api.hap.Service;
  public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

  // this is used to track restored cached accessories
  public readonly accessories: PlatformAccessory[] = [];

  private readonly deviceManager: DeviceManager;

  constructor(
    public readonly log: Logger,
    public readonly config: PlatformConfig,
    public readonly api: API,
  ) {
    this.log.debug('Finished initializing platform:', this.config.name);

    const sysApConfig: ClientConfiguration = new ClientConfiguration(
      config.hostname,
      config.username,
      config.password,
    );
    this.deviceManager = new DeviceManager(sysApConfig);

    // When this event is fired it means Homebridge has restored all cached accessories from disk.
    // Dynamic Platform plugins should only register new accessories after this event was fired,
    // in order to ensure they weren't added to homebridge already. This event can also be used
    // to start discovery of new accessories.
    this.api.on('didFinishLaunching', () => {
      log.debug('Executed didFinishLaunching callback');
      // run the method to discover / register your devices as accessories
      this.discoverDevices();
    });
  }

  /**
   * This function is invoked when homebridge restores cached accessories from disk at startup.
   * It should be used to setup event handlers for characteristics and update respective values.
   */
  configureAccessory(accessory: PlatformAccessory) {
    this.log.info('Loading accessory from cache:', accessory.displayName);

    // add the restored accessory to the accessories cache so we can track if it has already been registered
    this.accessories.push(accessory);
  }

  /**
   * This is an example method showing how to register discovered accessories.
   * Accessories must only be registered once, previously created accessories
   * must not be registered again to prevent 'duplicate UUID' errors.
   */
  discoverDevices() {

    // EXAMPLE ONLY
    // A real plugin you would discover accessories from the local network, cloud services
    // or a user-defined array in the platform config.

    if(this.deviceManager.hasDeviceList()) {
      this.discoverWithDevices();
    } else {
      this.deviceManager.on(ConnectionEvent.DEVICES, this.discoverWithDevices.bind(this));
    }


  }

  discoverWithDevices() {
    const devices: Device[] = this.deviceManager.getDevices();

    const accessories: PlatformAccessory[] = [];
    const newAccessories: PlatformAccessory[] = [];
    const expiredAccessories: PlatformAccessory[] = [];

    this.log.info('Found '+devices.length + ' devices');
    for(const device of devices) {
      const deviceConfig = this.config.devices[device.serialNumber] || this.config.devices[device.constructor.name];
      if(deviceConfig && deviceConfig.enabled === false) {
        continue;
      }

      if(device instanceof HomeTouchPanel) {
        const panel: HomeTouchPanel = device as HomeTouchPanel;
        let subDevices: {[channel: string]: SubDevice} = {};

        if(deviceConfig) {
          for (const key in panel) {
            if(panel[key] instanceof SubDevice && deviceConfig[key] && deviceConfig[key].enabled) {
              subDevices[key] = panel[key];
            }
          }
        } else {
          subDevices = {
            hallwayLight: panel.hallwayLight,
            callLevelDoorCall: panel.callLevelDoorCall,
            automaticDoorOpener: panel.automaticDoorOpener,
            doorCall1: panel.doorCall1,
            doorCall2: panel.doorCall2,
            doorCall3: panel.doorCall3,
            doorCall4: panel.doorCall4,
            doorOpener1: panel.doorOpener1,
            doorOpener2: panel.doorOpener2,
            doorOpener3: panel.doorOpener3,
            doorOpener4: panel.doorOpener4,
            defaultDoorOpener: panel.defaultDoorOpener,
          };
        }


        for (const key in subDevices) {
          if(!subDevices.hasOwnProperty(key)) {
            continue;
          }

          const subDevice: SubDevice = subDevices[key];

          const identifier: string = PLATFORM_NAME + ':panel:' + subDevice.serialNumber + subDevice.channel;
          const uuid = this.api.hap.uuid.generate(identifier);

          // this.log.info('UUID: ', uuid, ' - ', subDevice.constructor);

          const existingAccessory = this.accessories.find(accessory => accessory.UUID === uuid);

          let displayName: string = subDevice.constructor.name;
          if(subDevice.getRoom()) {
            displayName = subDevice.getRoom() + ' ' + displayName;
          }

          let accessory = existingAccessory;
          if(accessory === undefined) {
            this.log.info('Adding new accessory:', displayName);
            accessory = new this.api.platformAccessory(displayName, uuid);
            newAccessories.push(accessory);
          } else {
            this.log.info('Restoring existing accessory from cache:', accessory.displayName);
            accessory.getService(Service.AccessoryInformation)!
              .updateCharacteristic(Characteristic.Name, displayName);
          }
          accessories.push(accessory);

          /*
          if(existingAccessory) {
            this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);
            accessoryHandler = new ExamplePlatformAccessory(this, existingAccessory);

          } else {
            // the accessory does not yet exist, so we need to create it
            this.log.info('Adding new accessory:', subDevice.constructor.name);

            // create a new accessory
            const accessory = new this.api.platformAccessory(subDevice.constructor.name, uuid);
*/
          // store a copy of the device object in the `accessory.context`
          // the `context` property can be used to store any data about the accessory you may need
          // accessory.context.device = subDevice;

          // create the accessory handler for the newly create accessory
          // this is imported from `platformAccessory.ts`
          // accessoryHandler = new ExamplePlatformAccessory(this, accessory);

          // link the accessory to your platform
          // accessories.push(accessory);
          // }


          let deviceHandler: DeviceHandler|null;
          const subDeviceConfig: Record<string, any>|undefined = deviceConfig[key];

          if(subDevice instanceof DoorCall) {
            const doorCall: DoorCall = subDevice as DoorCall;
            if(doorCall.triggerEnabled()) {
              deviceHandler = new DoorCallButtonHandler(this.log, this.api, accessory, doorCall, subDeviceConfig);
            } else {
              deviceHandler = new DoorCallHandler(this.log, this.api, accessory, doorCall, subDeviceConfig);
            }
          } else if(subDevice instanceof AutomaticDoorOpener) {
            deviceHandler = new AutomaticDoorOpenerHandler(this.log, this.api, accessory, subDevice as AutomaticDoorOpener, subDeviceConfig);
          } else if(subDevice instanceof DoorOpener) {
            deviceHandler = new DoorOpenerHandler(this.log, this.api, accessory, subDevice as DoorOpener, subDeviceConfig);
          } else if(subDevice instanceof Light) {
            deviceHandler = new LightHandler(this.log, this.api, accessory, subDevice as Light, subDeviceConfig);
          }
        }
      }
    }
    /*
    this.log.info('========');
    newAccessories.forEach((cachedAccessory: PlatformAccessory) => {
      this.log.info('New accessory', cachedAccessory.displayName, cachedAccessory.constructor.name, cachedAccessory.UUID);
    });
    this.log.info('========');
    accessories.forEach((cachedAccessory: PlatformAccessory) => {
      this.log.info('Current accessory', cachedAccessory.displayName, cachedAccessory.constructor.name, cachedAccessory.UUID);
    });
    this.log.info('========');

    this.accessories.forEach((cachedAccessory: PlatformAccessory, index: number) => {
      this.log.info('Cached accessory', cachedAccessory.displayName, cachedAccessory.constructor.name, cachedAccessory.UUID);

      if(accessories.find(accessory => accessory.UUID === cachedAccessory.UUID) === undefined) {
        expiredAccessories.push(cachedAccessory);
        this.accessories.splice(index, 1);
      }
    });
    this.log.info('========');
    */
    this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, newAccessories);
    this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, expiredAccessories);
  }
}
