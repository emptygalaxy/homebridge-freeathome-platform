import type {API} from 'homebridge';

import {PLATFORM_NAME} from './settings';
import {FreeAtHomePlatform} from './platform';

/**
 * This method registers the platform with Homebridge
 */
export = (api: API) => {
  api.registerPlatform(PLATFORM_NAME, FreeAtHomePlatform);
}
