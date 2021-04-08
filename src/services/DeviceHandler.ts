import {Logging} from "homebridge/lib/logger";
import { Device, SubDevice } from "freeathome-devices";
import {PlatformAccessory} from "homebridge";
import { API } from "homebridge/lib/api";
import { Service } from "hap-nodejs";

export class DeviceHandler
{
    protected informationService?: Service;
    protected loggingService?:any;

    constructor(
        protected readonly log:Logging,
        protected readonly api: API,
        protected readonly accessory: PlatformAccessory,
        protected device: Device,
        protected readonly config?: Object,
    ) {
        // hap
        const Service = this.api.hap.Service;
        const Characteristic = this.api.hap.Characteristic;

        // set up information characteristics
        let model:string = device.constructor.name;
        let serialNumber:string = device.serialNumber;
        if(this.device.getRoom())
            model += ' (' + device.getRoom() + ')';
        if(this.device instanceof SubDevice)
            serialNumber += '.' + SubDevice.formatChannelString((this.device as SubDevice).channel);

        this.informationService = this.accessory.getService(Service.AccessoryInformation);
        this.informationService!
            .setCharacteristic(Characteristic.Manufacturer, 'Busch-Jaeger')
            .setCharacteristic(Characteristic.Model, model)
            .setCharacteristic(Characteristic.SerialNumber, serialNumber)
            ;
    }

    public setDevice(device: Device): void
    {
        this.device = device;
    }

    protected setupLoggingService(type:'weather'|'energy'|'room'|'door'|'motion'|'switch'|'thermo'|'aqua')
    {
        const FakeGatoHistoryService = require('fakegato-history')(this.api);
        this.loggingService = new FakeGatoHistoryService(type, this.accessory);
    }

    protected addLogEntry(value:number|boolean)
    {
        if(value === true || value === false)
            value = value ? 1 : 0;

        if(this.loggingService)
            this.loggingService.addEntry({time: Math.round(new Date().getTime()/1000), status: value});
    }
}