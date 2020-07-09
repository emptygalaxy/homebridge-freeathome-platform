import { Light, LightEvent } from "freeathome-devices";
import { Lightbulb } from "hap-nodejs/dist/lib/gen/HomeKit";
import { CharacteristicGetCallback, CharacteristicEventTypes, CharacteristicValue,  CharacteristicSetCallback } from "hap-nodejs";
import { Logger } from "homebridge/lib/logger";
import { PlatformAccessory } from "homebridge";
import { DeviceHandler } from "./DeviceHandler";
import { API } from "homebridge/lib/api";

export class LightHandler extends DeviceHandler
{
    // freeathome
    private readonly light:Light;

    // homebridge
    private lightService:Lightbulb;

    constructor(log: Logger, api: API, accessory: PlatformAccessory, light: Light, config?: Object)
    {
        super(log, api, accessory, light, config);

        this.light = light;
        this.log.info(this.light.getRoom()||'unknown', 'Set up light');

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

        // listen for events
        this.light.on(LightEvent.TURNED_ON, this.update.bind(this));
        this.light.on(LightEvent.TURNED_OFF, this.update.bind(this));
    }

    private update()
    {
        this.lightService.updateCharacteristic(this.api.hap.Characteristic.On, this.light.isOn());
        this.addLogEntry(this.light.isOn());
    }

    /**
     * Get the switch state
     * @param callback
     */
    private getLightOn(callback:CharacteristicGetCallback)
    {
        this.log.info(this.light.getRoom()||'unknown', 'Get call button state: ' + this.light.isOn());
        callback(null, this.light.isOn());
    }

    /**
     * Set the switch state
     * @param value
     * @param callback
     */
    private async setLightOn(value:CharacteristicValue, callback:CharacteristicSetCallback)
    {
        this.log.info(this.light.getRoom()||'unknown', 'Set light on: ' + value);

        if(value === true)
            this.light.turnOn();
        else
            this.light.turnOff();

        callback();
    }
}