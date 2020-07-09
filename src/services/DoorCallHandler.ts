import { DoorCall, DoorCallEvent } from "freeathome-devices";
import { Doorbell, MotionSensor } from "hap-nodejs/dist/lib/gen/HomeKit";
import { CharacteristicGetCallback, CharacteristicEventTypes } from "hap-nodejs";
import { Logger } from "homebridge/lib/logger";
import { PlatformAccessory } from "homebridge";
import { DeviceHandler } from "./DeviceHandler";
import { CameraConfig, FFMPEG } from "../FFMPEG";
import { API } from "homebridge/lib/api";

export class DoorCallHandler extends DeviceHandler
{
    // freeathome
    protected readonly doorCall:DoorCall;

    // homebridge
    private readonly doorbellService?:Doorbell;
    private readonly motionService:MotionSensor;

    protected readonly restoreTime: number = 5000;
    protected restoreTimeoutId: NodeJS.Timeout | null = null;

    constructor(log: Logger, api: API, accessory: PlatformAccessory, doorCall: DoorCall, config?: Object) {
        super(log, api, accessory, doorCall, config);

        this.doorCall = doorCall;

        // hap
        const Service = this.api.hap.Service;
        const Characteristic = this.api.hap.Characteristic;

        // find camera
        const cameraConfig = DoorCallHandler.getCameraConfig(config);

        // set up characteristics
        if(cameraConfig) {
            this.doorbellService = accessory.getService(Service.Doorbell) || accessory.addService(Service.Doorbell);
            this.doorbellService.getCharacteristic(Characteristic.ProgrammableSwitchEvent)
                .on(CharacteristicEventTypes.GET, this.getProgrammableSwitchEvent.bind(this));
        }

        this.motionService = accessory.getService(Service.MotionSensor) || accessory.addService(Service.MotionSensor);
        this.motionService.getCharacteristic(this.api.hap.Characteristic.MotionDetected)
            .on(CharacteristicEventTypes.GET, this.getMotionDetected.bind(this));

        // listen for events
        this.doorCall.on(DoorCallEvent.TRIGGER, this.handleTrigger.bind(this));
        this.doorCall.on(DoorCallEvent.TRIGGERED, this.triggered.bind(this));

        // logging service
        this.setupLoggingService('motion');
        this.addLogEntry(false);

        if(cameraConfig) {
            let videoProcessor: string = 'ffmpeg';

            let cameraSource = new FFMPEG(accessory, this.api.hap, cameraConfig, this.log, videoProcessor);
            accessory.configureCameraSource(cameraSource);
        }
    }

    private static getCameraConfig(config?: Object): CameraConfig|undefined {
        if(config) {
            if (config['image']) {
                // setup camera
                let image: string | null = config['image'];

                // Setup and configure the camera services
                return <CameraConfig>{
                    name: "Test",
                    port: 5000,
                    uploader: false,
                    videoConfig: {
                        source: "-loop 1 -f image2 -i " + image,
                        stillImageSource: "-i " + image,
                        maxStreams: 2,
                        maxWidth: 1280,
                        maxHeight: 720,
                        // maxFPS: 10,
                        // maxBitrate: 300,
                        vcodec: "libx264",
                        packetSize: 1316,
                        // vflip: false,
                        // hflip: false,
                        debug: false,
                        audio: false,
                        acodec: '',
                        // additionalCommandline: '',
                        // mapvideo: '',
                        // mapaudio: '',
                        // lensCorrection: {
                        //     k1: 0.5,
                        //     k2: 0.5
                        // }
                    }
                };
            } else if (config['camera']) {
                return <CameraConfig>config['camera'];
            }
        }
    }

    private handleTrigger() {
        this.log.info(this.doorCall.getRoom()||'unknown', 'DoorCall trigger');
    }

    private triggered() {
        const Characteristic = this.api.hap.Characteristic;

        this.log.info(this.doorCall.getRoom()||'unknown', 'DoorCall was triggered');
        this.addLogEntry(true);

        if(this.doorbellService)
            this.doorbellService.updateCharacteristic(Characteristic.ProgrammableSwitchEvent, 0);

        if(this.motionService)
            this.motionService.updateCharacteristic(Characteristic.MotionDetected, true);

        this.log.info(this.doorCall.getRoom()||'unknown', 'Wait 5 seconds to restore button state');

        if(this.restoreTimeoutId !== null)
            clearTimeout(this.restoreTimeoutId);
        this.restoreTimeoutId = setTimeout(this.restoreState.bind(this), this.restoreTime);
    }

    protected restoreState() {
        this.addLogEntry(false);

        if(this.motionService)
            this.motionService.updateCharacteristic(this.api.hap.Characteristic.MotionDetected, false);

        this.log.info(this.doorCall.getRoom()||'unknown', 'Restored motion state');
    }

    /**
     * Get the current door opener state
     * @param callback
     */
    private getProgrammableSwitchEvent(callback:CharacteristicGetCallback) {
        this.log.info(this.doorCall.getRoom()||'unknown', 'Get ProgrammableSwitchEvent');

        callback(null, 0);
    }

    /**
     * Get the current door opener state
     * @param callback
     */
    private getMotionDetected(callback:CharacteristicGetCallback)
    {
        this.log.info(this.doorCall.getRoom()||'unknown', 'Get MotionDetected');

        callback(null, false);
    }
}