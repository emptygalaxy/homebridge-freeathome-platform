/*eslint-disable */

import {uuid, Service, StreamController} from 'hap-nodejs';

import 'fs';
import { ChildProcess, spawn } from 'child_process';
import {
  Logger, CameraStreamingOptions, Resolution, LegacyCameraSource, StreamRequest,
  SnapshotRequest, PrepareStreamRequest, PreparedStreamRequestCallback, NodeCallback,
  PreparedStreamResponse, SourceResponse, Address, HAP
} from 'homebridge';
import {PlatformAccessory} from 'homebridge/lib/platformAccessory';
const ip = require('ip');
const crypto = require('crypto');

export interface CameraConfig {
    name: string;
    port: number;
    uploader?: boolean;
    videoConfig: VideoConfig;
}
export interface VideoConfig {
    source: string;
    stillImageSource: string;
    maxStreams: number;
    maxWidth: number;
    maxHeight: number;
    maxFPS?: number;
    maxBitrate?: number;
    vcodec: string;
    packetSize: number;
    vflip?: boolean;
    hflip?: boolean;
    audio: boolean;
    acodec: string;
    debug: boolean;
    additionalCommandline?: string;
    videoFilter?: string;
    mapvideo?: string;
    mapaudio?: string;
    lensCorrection?: LensCorrection;
}

export interface SessionInfo {
    address?: string;
    video_port?: number;
    video_srtp: Buffer;
    video_ssrc?: string;
    audio_port?: number;
    audio_srtp: Buffer;
    audio_ssrc?: string;
}

export interface LensCorrection {
    k1: number;
    k2: number;
}

export class FFMPEG implements LegacyCameraSource{
    accessory: PlatformAccessory;
    hap: HAP;
    log: Logger;
    name: string;
    vcodec: string;
    videoProcessor: string;
    audio: boolean;
    acodec: string;
    packetsize: number;
    fps: number;
    maxBitrate: number;
    debug: boolean;
    additionalCommandline: string;
    vflip: boolean;
    hflip: boolean;
    videoFilter: string|null;
    mapvideo: string;
    mapaudio: string;
    lensCorrection?: LensCorrection;

    ffmpegSource: string;
    ffmpegImageSource: string;

    services: Service[];
    streamControllers: StreamController[];

    pendingSessions: {[k: string]: SessionInfo};
    ongoingSessions: {[k: string]: ChildProcess};

    uploader: boolean;

    maxWidth: number;
    maxHeight: number;

    constructor(accessory: PlatformAccessory, hap:HAP, cameraConfig: CameraConfig, log: Logger, videoProcessor?: string) {
      this.accessory = accessory;
      this.hap = hap;
      const uuid = hap.uuid;
      const Service = hap.Service;
      const Characteristic = hap.Characteristic;
      const StreamController = hap.StreamController;
      this.log = log;

      const ffmpegOpt = cameraConfig.videoConfig;
      this.name = cameraConfig.name;
      this.vcodec = ffmpegOpt.vcodec;
      this.videoProcessor = videoProcessor || 'ffmpeg';
      this.audio = ffmpegOpt.audio;
      this.acodec = ffmpegOpt.acodec;
      this.packetsize = ffmpegOpt.packetSize;
      this.fps = ffmpegOpt.maxFPS || 10;
      this.maxBitrate = ffmpegOpt.maxBitrate || 300;
      this.debug = ffmpegOpt.debug;
      this.additionalCommandline = ffmpegOpt.additionalCommandline || '-tune zerolatency';
      this.vflip = ffmpegOpt.vflip || false;
      this.hflip = ffmpegOpt.hflip || false;
      this.videoFilter = ffmpegOpt.videoFilter || null; // null is a valid discrete value
      this.mapvideo = ffmpegOpt.mapvideo || '0:0';
      this.mapaudio = ffmpegOpt.mapaudio || '0:1';
      this.lensCorrection = ffmpegOpt.lensCorrection;

      if (!ffmpegOpt.source) {
        throw new Error('Missing source for camera.');
      }

      this.ffmpegSource = ffmpegOpt.source;
      this.ffmpegImageSource = ffmpegOpt.stillImageSource;

      this.services = [];
      this.streamControllers = [];

      this.pendingSessions = {};
      this.ongoingSessions = {};

      this.uploader = cameraConfig.uploader || false;
      // if ( this.uploader )
      // { this.drive = new drive(); }

      const numberOfStreams = ffmpegOpt.maxStreams || 2;
      const videoResolutions: Resolution[] = [];

      this.maxWidth = ffmpegOpt.maxWidth || 1280;
      this.maxHeight = ffmpegOpt.maxHeight || 720;
      const maxFPS = (this.fps > 30) ? 30 : this.fps;

      // let resolutions = [
      //     [320, 180, 15],
      //     [320, 240, 15],
      //     [480, 270, maxFPS],
      //     [480, 360, maxFPS],
      //     [640, 360, maxFPS],
      //     [640, 480, maxFPS],
      //     [1280, 960, maxFPS],
      //     [1280, 720, maxFPS],
      //     [1920, 1080, maxFPS],
      // ];

      if (this.maxWidth >= 320) {
        if (this.maxHeight >= 240) {
          videoResolutions.push([320, 240, maxFPS]);
          if (maxFPS > 15) {
            videoResolutions.push([320, 240, 15]);
          }
        }

        if (this.maxHeight >= 180) {
          videoResolutions.push([320, 180, maxFPS]);
          if (maxFPS > 15) {
            videoResolutions.push([320, 180, 15]);
          }
        }
      }

      if (this.maxWidth >= 480) {
        if (this.maxHeight >= 360) {
          videoResolutions.push([480, 360, maxFPS]);
        }

        if (this.maxHeight >= 270) {
          videoResolutions.push([480, 270, maxFPS]);
        }
      }

      if (this.maxWidth >= 640) {
        if (this.maxHeight >= 480) {
          videoResolutions.push([640, 480, maxFPS]);
        }

        if (this.maxHeight >= 360) {
          videoResolutions.push([640, 360, maxFPS]);
        }
      }

      if (this.maxWidth >= 1280) {
        if (this.maxHeight >= 960) {
          videoResolutions.push([1280, 960, maxFPS]);
        }

        if (this.maxHeight >= 720) {
          videoResolutions.push([1280, 720, maxFPS]);
        }
      }

      if (this.maxWidth >= 1920) {
        if (this.maxHeight >= 1080) {
          videoResolutions.push([1920, 1080, maxFPS]);
        }
      }

      const options: CameraStreamingOptions = {
        proxy: false, // Requires RTP/RTCP MUX Proxy
        srtp: true, // Supports SRTP AES_CM_128_HMAC_SHA1_80 encryption
        video: {
          resolutions: videoResolutions,
          codec: {
            profiles: [0, 1, 2], // Enum, please refer StreamController.VideoCodecParamProfileIDTypes
            levels: [0, 1, 2], // Enum, please refer StreamController.VideoCodecParamLevelTypes
          },
        },
        audio: {
          codecs: [
            {
              type: 'OPUS', // Audio Codec
              samplerate: 24, // 8, 16, 24 KHz
            },
            {
              type: 'AAC-eld',
              samplerate: 16,
            },
          ],
        },
      };

      // this.createCameraControlService();
      this._createStreamControllers(numberOfStreams, options);
    }

    public handleCloseConnection(connectionID: string) {
      this.streamControllers.forEach((controller) => {
        controller.handleCloseConnection(connectionID);
      });
    }

    public handleSnapshotRequest(request: SnapshotRequest, callback: NodeCallback<Buffer>) {
      const resolution = request.width + 'x' + request.height;
      const imageSource = this.ffmpegImageSource !== undefined ? this.ffmpegImageSource : this.ffmpegSource;
      const ffmpeg = spawn(this.videoProcessor, (imageSource + ' -t 1 -s ' + resolution + ' -f image2 -').split(' '), {env: process.env});
      let imageBuffer = new Buffer(0);
      if (this.debug) {
        this.log.info('Snapshot from ' + this.name + ' at ' + resolution);
        console.log('ffmpeg ' + imageSource + ' -t 1 -s ' + resolution + ' -f image2 -');
      }
      ffmpeg.stdout.on('data', (data) => {
        imageBuffer = Buffer.concat([imageBuffer, data]);
      });
      const self = this;
      ffmpeg.on('error', (error) => {
        self.log.error('An error occurs while making snapshot request');
        self.debug ? self.log.error(error.toString()) : null;
      });
      ffmpeg.on('close', (code: string) => {
        // if ( this.uploader )
        // { this.drive.storePicture(this.name,imageBuffer); }
        callback(undefined, imageBuffer);
      });
    }

    public prepareStream(request: PrepareStreamRequest, callback: PreparedStreamRequestCallback) {
      const sessionInfo: SessionInfo = {video_srtp:new Buffer(0), audio_srtp: new Buffer(0)};

      const sessionID = request.sessionID;
      const targetAddress = request.targetAddress;

      sessionInfo.address = targetAddress;

      let videoResp: SourceResponse;
      let audioResp: SourceResponse;

      const videoInfo = request.video;
      if (videoInfo || true) {
        const targetPort = videoInfo.port;
        const srtp_key = videoInfo.srtp_key;
        const srtp_salt = videoInfo.srtp_salt;

        // SSRC is a 32 bit integer that is unique per stream
        const ssrcSource = crypto.randomBytes(4);
        ssrcSource[0] = 0;
        const ssrc = ssrcSource.readInt32BE(0, true);

        videoResp = {
          port: targetPort,
          ssrc: ssrc,
          srtp_key: srtp_key,
          srtp_salt: srtp_salt,
        };

        // response.video = videoResp;

        sessionInfo.video_port = targetPort;
        sessionInfo.video_srtp = Buffer.concat([srtp_key, srtp_salt]);
        sessionInfo.video_ssrc = ssrc;
      }

      const audioInfo = request.audio;
      if (audioInfo || true) {
        const targetPort = audioInfo.port;
        const srtp_key = audioInfo.srtp_key;
        const srtp_salt = audioInfo.srtp_salt;

        // SSRC is a 32 bit integer that is unique per stream
        const ssrcSource = crypto.randomBytes(4);
        ssrcSource[0] = 0;
        const ssrc = ssrcSource.readInt32BE(0, true);

        audioResp = {
          port: targetPort,
          ssrc: ssrc,
          srtp_key: srtp_key,
          srtp_salt: srtp_salt,
        };

        // response["audio"] = audioResp;

        sessionInfo.audio_port = targetPort;
        sessionInfo.audio_srtp = Buffer.concat([srtp_key, srtp_salt]);
        sessionInfo.audio_ssrc = ssrc;
      }

      const currentAddress = ip.address();
      const addressResp: Address = {
        address: currentAddress,
      };

      if (ip.isV4Format(currentAddress)) {
        addressResp.type = 'v4';
      } else {
        addressResp.type = 'v6';
      }

      const response: PreparedStreamResponse = {
        address: addressResp,
        video: videoResp,
        audio: audioResp,
      };

      const uuid = this.hap.uuid;
      this.pendingSessions[uuid.unparse(sessionID)] = sessionInfo;

      callback(response);
    }

    public handleStreamRequest(request: StreamRequest) {
      const uuid = this.hap.uuid;
      const sessionID = request.sessionID;
      const requestType = request.type;
      if (sessionID) {
        const sessionIdentifier = uuid.unparse(sessionID);

        if (requestType === 'start') {
          const sessionInfo = this.pendingSessions[sessionIdentifier];
          if (sessionInfo) {
            let width = 1280;
            let height = 720;
            let fps = this.fps || 30;
            let vbitrate = this.maxBitrate;
            let abitrate = 32;
            let asamplerate = 16;
            const vcodec = this.vcodec || 'libx264';
            const acodec = this.acodec || 'libfdk_aac';
            const packetsize = this.packetsize || 1316; // 188 376
            const additionalCommandline = this.additionalCommandline;
            const mapvideo = this.mapvideo;
            const mapaudio = this.mapaudio;

            const videoInfo = request.video;
            if (videoInfo) {
              width = videoInfo.width;
              height = videoInfo.height;

              const expectedFPS = videoInfo.fps;
              if (expectedFPS < fps) {
                fps = expectedFPS;
              }
              if (videoInfo.max_bit_rate < vbitrate) {
                vbitrate = videoInfo.max_bit_rate;
              }
            }

            const audioInfo = request.audio;
            if (audioInfo) {
              abitrate = audioInfo.max_bit_rate;
              asamplerate = audioInfo.sample_rate;
            }

            const targetAddress = sessionInfo.address;
            const targetVideoPort = sessionInfo.video_port;
            const videoKey = sessionInfo.video_srtp;
            const videoSsrc = sessionInfo.video_ssrc;
            const targetAudioPort = sessionInfo.audio_port;
            const audioKey = sessionInfo.audio_srtp;
            const audioSsrc = sessionInfo.audio_ssrc;
            const vf: string[] = [];

            const videoFilter: string|null = ((this.videoFilter === '') ? ('scale=' + width + ':' + height + '') : (this.videoFilter)); // empty string indicates default
            // In the case of null, skip entirely
            if (videoFilter !== null && videoFilter !== 'none') {
              vf.push(videoFilter);

              if (this.hflip) {
                vf.push('hflip');
              }

              if (this.vflip) {
                vf.push('vflip');
              }
            }

            if(this.lensCorrection !== undefined) {
              vf.push('lenscorrection=k1=-'+this.lensCorrection.k1+':k2='+this.lensCorrection.k2);
            }

            let ffmpegCommand = this.ffmpegSource + ' -map ' + mapvideo +
                        ' -vcodec ' + vcodec +
                        ' -pix_fmt yuv420p' +
                        ' -r ' + fps +
                        ' -f rawvideo' +
                        ' ' + additionalCommandline +
                        ((vcodec !== 'copy' && vf.length > 0) ? (' -vf ' + vf.join(',')) : ('')) +
                        ' -b:v ' + vbitrate + 'k' +
                        ' -bufsize ' + vbitrate + 'k' +
                        ' -maxrate ' + vbitrate + 'k' +
                        ' -payload_type 99' +
                        ' -ssrc ' + videoSsrc +
                        ' -f rtp' +
                        ' -srtp_out_suite AES_CM_128_HMAC_SHA1_80' +
                        ' -srtp_out_params ' + videoKey.toString('base64') +
                        ' srtp://' + targetAddress + ':' + targetVideoPort +
                        '?rtcpport=' + targetVideoPort +
                        '&localrtcpport=' + targetVideoPort +
                        '&pkt_size=' + packetsize;

            if (this.audio) {
              ffmpegCommand += ' -map ' + mapaudio +
                            ' -acodec ' + acodec +
                            ' -profile:a aac_eld' +
                            ' -flags +global_header' +
                            ' -f null' +
                            ' -ar ' + asamplerate + 'k' +
                            ' -b:a ' + abitrate + 'k' +
                            ' -bufsize ' + abitrate + 'k' +
                            ' -ac 1' +
                            ' -payload_type 110' +
                            ' -ssrc ' + audioSsrc +
                            ' -f rtp' +
                            ' -srtp_out_suite AES_CM_128_HMAC_SHA1_80' +
                            ' -srtp_out_params ' + audioKey.toString('base64') +
                            ' srtp://' + targetAddress + ':' + targetAudioPort +
                            '?rtcpport=' + targetAudioPort +
                            '&localrtcpport=' + targetAudioPort +
                            '&pkt_size=' + packetsize;
            }

            const ffmpeg = spawn(this.videoProcessor, ffmpegCommand.split(' '), {env: process.env});
            this.log.info('Start streaming video from ' + this.name + ' with ' + width + 'x' + height + '@' + vbitrate + 'kBit');
            if (this.debug) {
              console.log('ffmpeg ' + ffmpegCommand);
            }

            // Always setup hook on stderr.
            // Without this streaming stops within one to two minutes.
            ffmpeg.stderr.on('data', (data) => {
              // Do not log to the console if debugging is turned off
              if (self.debug) {
                console.log(data.toString());
              }
            });
            const self = this;
            ffmpeg.on('error', (error) => {
              self.log.error('An error occurs while making stream request');
              self.debug ? self.log.error(error.toString()) : null;
            });
            ffmpeg.on('close', (code) => {
              if (code === null || code === 0 || code === 255) {
                self.log.info('Stopped streaming');
              } else {
                self.log.error('ERROR: FFmpeg exited with code ' + code);
                for (let i = 0; i < self.streamControllers.length; i++) {
                  const controller = self.streamControllers[i];
                  if (controller.sessionIdentifier === sessionID) {
                    controller.forceStop();
                  }
                }
              }
            });
            this.ongoingSessions[sessionIdentifier] = ffmpeg;
          }

          delete this.pendingSessions[sessionIdentifier];
        } else if (requestType === 'stop') {
          const ffmpegProcess = this.ongoingSessions[sessionIdentifier];
          if (ffmpegProcess) {
            ffmpegProcess.kill('SIGTERM');
          }
          delete this.ongoingSessions[sessionIdentifier];
        }
      }
    }

    public createCameraControlService() {
      const Service = this.hap.Service;
      this.log.info('createCameraControlService()');
      let controlService: Service|undefined;

      if(this.accessory.getService(Service.CameraControl)) {
        this.log.info('Reuse existing CameraControl service');
        controlService = this.accessory.getService(Service.CameraControl);
      } else {
        this.log.info('Setup new CameraControl service');
        controlService = this.accessory.addService(Service.CameraControl, 'FFMPEG', 'stream');
      }

      // var controlService = this.accessory.getService(Service.CameraControl) || this.accessory.addService(Service.CameraControl, 'FFMPEG', 'stream');
      // if(controlService)
      this.log.info('Has cameraService now:', controlService !== undefined);

      if(controlService) {
        this.services.push(controlService);
      }

      if (this.audio) {
        const microphoneService = this.accessory.getService(Service.Microphone) || this.accessory.addService(Service.Microphone);
        this.services.push(microphoneService);
      }
    }

    // Private

    private _createStreamControllers(maxStreams: number, options: CameraStreamingOptions) {
      const StreamController = this.hap.StreamController;
      this.log.info('_createStreamControllers');
      const self = this;

      for (let i = 0; i < maxStreams; i++) {
        const streamController = new StreamController(i, options, self);

        self.services.push(streamController.service);
        self.streamControllers.push(streamController);
      }
    }
}

/*eslint-enable */