import {PlatformConfig} from 'homebridge';

export interface FreeAtHomePlatformConfig extends PlatformConfig {
  readonly hostname?: string;
  readonly username?: string;
  readonly password?: string;
  readonly autoReconnect?: boolean;
  readonly timeout?: number;
  readonly mqtt?: MQTTConfig;
  readonly devices?: { [serialNumber: string]: DeviceConfig | HomeTouchPanelConfig };
}

export class MQTTConfig {
  enabled = true;
  host = '127.0.0.1';
  port = 1883;
  username?: string;
  password?: string;
}

export class DeviceConfig {
  readonly enabled: boolean = true;
}

export interface HomeTouchPanelConfig extends DeviceConfig {

  readonly hallwayLight: DeviceConfig;
  readonly doorOpener1: DoorOpenerConfig;
  readonly doorOpener2: DoorOpenerConfig;
  readonly doorOpener3: DoorOpenerConfig;
  readonly doorOpener4: DoorOpenerConfig;
  readonly defaultDoorOpener: DoorOpenerConfig;
  readonly doorCall1: DoorCallConfig;
  readonly doorCall2: DoorCallConfig;
  readonly doorCall3: DoorCallConfig;
  readonly doorCall4: DoorCallConfig;
  readonly callLevelDoorCall: DeviceConfig;
  readonly automaticDoorOpener: DeviceConfig;
}

export interface TimerDeviceConfig extends DeviceConfig {
  timer?: Timer;
}

export type DoorOpenerConfig = TimerDeviceConfig

export interface DoorCallConfig extends TimerDeviceConfig {
  image?: string;
  camera?: CameraConfig;
}

export class Timer {
  readonly enabled = false;
  readonly delay = 30;
  readonly type: 'switch' | 'garagedoor' = 'switch';
}

export class CameraConfig {
  /** Name of the camera */
  name = 'Camera';
  /** Port */
  port = 5000;
  /** Uploader */
  uploader = false;
  videoConfig?: VideoConfig;
}

export class VideoConfig {
  /** Video source */
  source = '-rtsp_transport tcp -i rtsp://127.0.0.1:8554/stream';
  /** Image source */
  stillImageSource = '-rtsp_transport tcp -i rtsp://127.0.0.1:8554/stream -vframes 1';
  maxStreams = 2;
  maxWidth = 1920;
  maxHeight = 1080;
  vcodec = 'libx264';
  packetSize = 1316;
  videoFilter = '';
  debug = false;
  audio = false;
  acodec = 'libfdk_aac';
  lensCorrection? = {k1: 0.5, k2: 0.5};
}
