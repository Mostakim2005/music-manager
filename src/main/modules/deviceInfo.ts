import { app } from 'electron';
import { machineIdSync } from 'node-machine-id';
import os from 'os';

import { getSharedStore } from './config';

const store = getSharedStore();

/**
 */
export function getDeviceId(): string {
  let deviceId = store.get('deviceId') as string | undefined;

  if (!deviceId) {
    try {
      deviceId = machineIdSync(true);
    } catch (error) {
      console.error('Failed to read machine ID:', error);
      const networkInterfaces = os.networkInterfaces();
      let macAddress = '';

      Object.values(networkInterfaces).forEach((interfaces) => {
        if (interfaces) {
          interfaces.forEach((iface) => {
            if (!iface.internal && !macAddress && iface.mac !== '00:00:00:00:00:00') {
              macAddress = iface.mac;
            }
          });
        }
      });

      deviceId = `${os.hostname()}-${macAddress}`.replace(/:/g, '');
    }

    if (deviceId) {
      store.set('deviceId', deviceId);
    } else {
      deviceId = Math.random().toString(36).substring(2, 15);
      store.set('deviceId', deviceId);
    }
  }

  return deviceId;
}

/**
 */
export function getSystemInfo() {
  return {
    osType: os.type(),
    osVersion: os.release(),
    osArch: os.arch(),
    platform: process.platform,
    appVersion: app.getVersion()
  };
}
