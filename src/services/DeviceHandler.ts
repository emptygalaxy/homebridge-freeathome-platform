import type {API, Logging, PlatformAccessory, Service} from 'homebridge';
import {Device, SubDevice} from 'freeathome-devices';
import {DeviceConfig} from '../FreeAtHomePlatformConfig';

export class DeviceHandler {
  protected informationService?: Service;
  protected loggingService?: { addEntry: (entry: { time: number; status: number | boolean }) => void };

  constructor(
    protected readonly log: Logging,
    protected readonly api: API,
    protected readonly accessory: PlatformAccessory,
    protected device: Device,
    protected readonly config?: DeviceConfig,
  ) {
    // hap
    const Service = this.api.hap.Service;
    const Characteristic = this.api.hap.Characteristic;

    // set up information characteristics
    let model: string = device.constructor.name;
    let serialNumber: string = device.serialNumber;
    if (this.device.getRoom()) {
      model += ' (' + device.getRoom() + ')';
    }
    if (this.device instanceof SubDevice) {
      serialNumber += '.' + SubDevice.formatChannelString((this.device as SubDevice).channel);
    }

    this.informationService = this.accessory.getService(Service.AccessoryInformation);
    this.informationService!
      .setCharacteristic(Characteristic.Manufacturer, 'Busch-Jaeger')
      .setCharacteristic(Characteristic.Model, model)
      .setCharacteristic(Characteristic.SerialNumber, serialNumber)
    ;
  }

  public setDevice(device: Device): void {
    this.device = device;
  }

  protected setupLoggingService(type: 'weather' | 'energy' | 'room' | 'door' | 'motion' | 'switch' | 'thermo' | 'aqua') {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const FakeGatoHistoryService = require('fakegato-history')(this.api);
    this.loggingService = new FakeGatoHistoryService(type, this.accessory);
  }

  protected addLogEntry(value: number | boolean) {
    if (value === true || value === false) {
      value = value ? 1 : 0;
    }

    if (this.loggingService) {
      this.loggingService.addEntry({time: Math.round(new Date().getTime() / 1000), status: value});
    }
  }
}
