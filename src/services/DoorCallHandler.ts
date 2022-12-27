import {DoorCall, DoorCallEvent} from 'freeathome-devices';
import type {API, Logging, PlatformAccessory, Service} from 'homebridge';
import {CharacteristicEventTypes, CharacteristicGetCallback} from 'hap-nodejs';
import {DeviceHandler} from './DeviceHandler';

import {StreamingDelegate} from 'homebridge-camera-ffmpeg/dist/streamingDelegate';
import {Logger as HCFLogger} from 'homebridge-camera-ffmpeg/dist/logger';
import {CameraConfig} from 'homebridge-camera-ffmpeg/dist/configTypes';
import {DoorCallConfig} from '../FreeAtHomePlatformConfig';

export class DoorCallHandler extends DeviceHandler {
  protected readonly restoreTime: number = 5000;
  protected restoreTimeoutId: NodeJS.Timeout | null = null;
  // homebridge
  private readonly doorbellService?: Service;
  private readonly motionService: Service;

  constructor(
    log: Logging,
    api: API,
    accessory: PlatformAccessory,
    protected doorCall: DoorCall,
    config?: DoorCallConfig,
  ) {
    super(log, api, accessory, doorCall, config);

    // hap
    const Service = this.api.hap.Service;
    const Characteristic = this.api.hap.Characteristic;

    // find camera
    const cameraConfig = DoorCallHandler.getCameraConfig(config);

    // set up characteristics
    if (cameraConfig) {
      this.doorbellService = accessory.getService(Service.Doorbell) || accessory.addService(Service.Doorbell);
      this.doorbellService.getCharacteristic(Characteristic.ProgrammableSwitchEvent)
        .on(CharacteristicEventTypes.GET, this.getProgrammableSwitchEvent.bind(this));
    }

    this.motionService = accessory.getService(Service.MotionSensor) || accessory.addService(Service.MotionSensor);
    this.motionService.getCharacteristic(this.api.hap.Characteristic.MotionDetected)
      .on(CharacteristicEventTypes.GET, this.getMotionDetected.bind(this));

    // logging service
    this.setupLoggingService('motion');
    this.addLogEntry(false);

    if (cameraConfig) {
      const logger = new HCFLogger(this.log);

      const videoProcessor = 'ffmpeg';
      const delegate = new StreamingDelegate(logger, cameraConfig, this.api, this.api.hap, videoProcessor);
      accessory.configureController(delegate.controller);
    }
  }

  private static getCameraConfig(config?: DoorCallConfig): CameraConfig | undefined {
    if (config) {
      if (config.image) {
        // setup camera
        const image: string | null = config.image;

        // Setup and configure the camera services
        return {
          name: 'Test',
          port: 5000,
          uploader: false,
          videoConfig: {
            source: '-loop 1 -f image2 -i ' + image,
            stillImageSource: '-i ' + image,
            maxStreams: 2,
            maxWidth: 1280,
            maxHeight: 720,
            // maxFPS: 10,
            // maxBitrate: 300,
            vcodec: 'libx264',
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
          },
        } as CameraConfig;
      } else if (config.camera) {
        return config.camera as CameraConfig;
      }
    }
  }

  public setDevice(doorCall: DoorCall): void {
    if (this.doorCall) {
      // unsubscribe
      this.doorCall.removeAllListeners(DoorCallEvent.TRIGGER);
      this.doorCall.removeAllListeners(DoorCallEvent.TRIGGERED);
    }

    super.setDevice(doorCall);
    this.doorCall = doorCall;

    // listen for events
    this.doorCall.on(DoorCallEvent.TRIGGER, this.handleTrigger.bind(this));
    this.doorCall.on(DoorCallEvent.TRIGGERED, this.triggered.bind(this));
  }

  protected restoreState() {
    this.addLogEntry(false);

    if (this.motionService) {
      this.motionService.updateCharacteristic(this.api.hap.Characteristic.MotionDetected, false);
    }

    this.log.info(this.doorCall.getRoom() || 'unknown', 'Restored motion state');
  }

  private handleTrigger() {
    this.log.info(this.doorCall.getRoom() || 'unknown', 'DoorCall trigger');
  }

  private triggered() {
    const Characteristic = this.api.hap.Characteristic;

    this.log.info(this.doorCall.getRoom() || 'unknown', 'DoorCall was triggered');
    this.addLogEntry(true);

    if (this.doorbellService) {
      this.doorbellService.updateCharacteristic(Characteristic.ProgrammableSwitchEvent, 0);
    }

    if (this.motionService) {
      this.motionService.updateCharacteristic(Characteristic.MotionDetected, true);
    }

    this.log.info(this.doorCall.getRoom() || 'unknown', 'Wait 5 seconds to restore button state');

    if (this.restoreTimeoutId !== null) {
      clearTimeout(this.restoreTimeoutId);
    }
    this.restoreTimeoutId = setTimeout(this.restoreState.bind(this), this.restoreTime);
  }

  /**
   * Get the current door opener state
   * @param callback
   */
  private getProgrammableSwitchEvent(callback: CharacteristicGetCallback) {
    this.log.info(this.doorCall.getRoom() || 'unknown', 'Get ProgrammableSwitchEvent');

    callback(null, 0);
  }

  /**
   * Get the current door opener state
   * @param callback
   */
  private getMotionDetected(callback: CharacteristicGetCallback) {
    this.log.info(this.doorCall.getRoom() || 'unknown', 'Get MotionDetected');

    callback(null, false);
  }
}
