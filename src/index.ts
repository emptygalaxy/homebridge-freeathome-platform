import { API } from 'homebridge';

import { PLATFORM_NAME } from './settings';
import { FreeAtHomePlatform } from './platform';

let Service, Characteristic;

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  Service = api.hap.Service;
  Characteristic = api.hap.Characteristic;

  api.registerPlatform(PLATFORM_NAME, FreeAtHomePlatform);
}