import { AutomaticDoorOpener, DeviceEvent } from "freeathome-devices";
import { Switch } from "hap-nodejs/dist/lib/gen/HomeKit";
import { CharacteristicValue, CharacteristicGetCallback, CharacteristicEventTypes, CharacteristicSetCallback } from "hap-nodejs";
import { Logger} from "homebridge/lib/logger";
import { PlatformAccessory } from "homebridge";
import { DeviceHandler } from "./DeviceHandler";
import { API } from "homebridge/lib/api";

export class AutomaticDoorOpenerHandler extends DeviceHandler
{
    // freeathome
    private readonly automaticDoorOpener:AutomaticDoorOpener;

    // homebridge
    private readonly switchService:Switch;

    constructor(log: Logger, api: API, accessory: PlatformAccessory, automaticDoorOpener: AutomaticDoorOpener, config?: Object)
    {
        super(log, api, accessory, automaticDoorOpener, config);

        this.automaticDoorOpener = automaticDoorOpener;
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
        this.addLogEntry(this.automaticDoorOpener.isEnabled());

        // listen for events
        this.automaticDoorOpener.on(DeviceEvent.CHANGE, this.update.bind(this));
    }

    private update()
    {
        this.switchService.updateCharacteristic(this.api.hap.Characteristic.On, this.automaticDoorOpener.isEnabled());
        this.addLogEntry(this.automaticDoorOpener.isEnabled());

        // logging
        this.log.info(this.automaticDoorOpener.getRoom()||'unknown', 'Update automatic door opener state: ' + this.automaticDoorOpener.isEnabled());
    }

    /**
     * Get the switch state
     * @param callback
     */
    private getSwitchOn(callback:CharacteristicGetCallback)
    {
        callback(null, this.automaticDoorOpener.isEnabled());

        // logging
        this.log.info(this.automaticDoorOpener.getRoom()||'unknown', 'Get automatic door opener state: ' + this.automaticDoorOpener.isEnabled());
    }

    /**
     * Set the switch state
     * @param value
     * @param callback
     */
    private async setSwitchOn(value:CharacteristicValue, callback:CharacteristicSetCallback)
    {
        if(value == true)
            this.automaticDoorOpener.enable();
        else
            this.automaticDoorOpener.disable();

        callback();

        // logging
        this.log.info(this.automaticDoorOpener.getRoom()||'unknown', 'Set automatic door opener state: ' + value);
    }
}