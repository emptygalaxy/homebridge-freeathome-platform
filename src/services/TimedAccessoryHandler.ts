import {DeviceHandler} from "./DeviceHandler";
import {Logger} from "homebridge/lib/logger";
import {API} from "homebridge/lib/api";
import {PlatformAccessory} from "homebridge/lib/platformAccessory";
import {AutomaticDoorOpener, DoorCall, DoorOpener} from "freeathome-devices";
import { Switch } from "hap-nodejs/dist/lib/gen/HomeKit";
import { Service, CharacteristicValue, CharacteristicGetCallback, CharacteristicEventTypes, CharacteristicSetCallback, Perms } from "hap-nodejs";
import Timeout = NodeJS.Timeout;
import {CreateSlider} from "../types/Slider";
import {CreateSliderValue} from "../types/SliderValue";
import {CreateSwitchProgram} from "../types/SwitchProgram";
import {CreateAutomaticOff} from "../types/AutomaticOff";
import {CreatePeriodInSeconds} from "../types/PeriodInSeconds";

let SwitchProgram, AutomaticOff, PeriodInSeconds, Slider, SliderValue;

export class TimedAccessoryHandler extends DeviceHandler
{
    private readonly switchService: Switch;
    private readonly switchProgramService: Service;
    private readonly sliderService?: Service;

    private maxDelay: number = 15 * 60;
    private armed: boolean = false;
    private delay: number = 170;
    private timeLeft: number = 0;
    private timeout?: Timeout;

    private tickInterval?: Timeout;
    private readonly tickEnabled: boolean = true;
    private readonly tickFrequency = 1000;

    constructor(log: Logger, api: API, accessory: PlatformAccessory, device: AutomaticDoorOpener|DoorCall|DoorOpener, config?: Object)
    {
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

        // switch
        const displayName = roomName + ' timer';
        this.switchService = accessory.getService(Service.Switch) || accessory.addService(Service.Switch, displayName);
        this.switchService.getCharacteristic(Characteristic.On)
            .on(CharacteristicEventTypes.GET, this.getSwitchOn.bind(this))
            .on(CharacteristicEventTypes.SET, this.setSwitchOn.bind(this))
        ;

        // default times
        if(config != null && config['timer'] != null && config['timer']['delay'] != null)
            this.delay = config['timer']['delay'] as number;
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
        if(this.tickEnabled) {
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

    /**
     * Get the switch state
     * @param callback
     */
    private getSwitchOn(callback: CharacteristicGetCallback): void
    {
        callback(null, this.armed);

        // logging
        this.log.info(this.device.getRoom()||'unknown',
            'Get timed door opener state: ' + this.armed,
        );
    }

    /**
     * Set the switch state
     * @param value
     * @param callback
     */
    private setSwitchOn(value: CharacteristicValue, callback: CharacteristicSetCallback): void
    {
        if(value == true)
            this.arm();
        else
            this.disarm();

        callback();

        // logging
        this.log.info(this.device.getRoom()||'unknown',
            'Set timed door opener state: ' + value,
        );
    }

    private getSwitchProgramPeriodInSeconds(callback: CharacteristicGetCallback): void
    {
        this.log.info('set period in seconds', this.delay);
        callback(null, this.delay);
    }

    private setSwitchProgramPeriodInSeconds(value: CharacteristicValue, callback: CharacteristicSetCallback): void
    {
        this.delay = value as number;
        this.log.info('set period in seconds', value);
        callback(null);
    }

    private getSliderValue(callback: CharacteristicGetCallback): void
    {
        this.log.info('Get slider value');
        callback(null, this.timeLeft);
    }

    public arm(): void
    {
        this.log.info('Timer armed');
        this.armed = true;
        this.timeout = setTimeout(this.timerEnded.bind(this), this.delay * 1000);

        if(this.tickEnabled) {
            this.timeLeft = this.delay;
            this.tickInterval = setInterval(this.tick.bind(this), this.tickFrequency);
        }
    }

    public disarm(): void
    {
        this.armed = false;

        if(this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = undefined;
        }

        if(this.tickInterval) {
            clearInterval(this.tickInterval);
            this.tickInterval = undefined;
        }

        this.timeLeft = 0;
        this.sliderService?.getCharacteristic(SliderValue).updateValue(this.timeLeft);
    }

    private tick(): void
    {
        const value = this.timeLeft --;

        if(this.sliderService) {
            this.sliderService.getCharacteristic(SliderValue)
                .updateValue(value);
        }
    }

    private timerEnded(): void
    {
        // invoke action
        if(this.device instanceof AutomaticDoorOpener)
            this.device.enable();
        else if(this.device instanceof DoorCall)
            this.device.trigger();
        else if(this.device instanceof DoorOpener)
            this.device.open();

        this.disarm();
        this.switchService.getCharacteristic(this.api.hap.Characteristic.On).updateValue(this.armed);
    }
}