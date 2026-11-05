import axios, { InternalAxiosRequestConfig } from 'axios';

import { useUserStore } from '@/store/modules/user';

import { getSetData, isElectron, isMobile } from '.';

let setData: any = null;

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
  retryCount?: number;
  noRetry?: boolean;
}

const baseURL = window.electron
  ? `http://127.0.0.1:${setData?.musicApiPort}`
  : import.meta.env.VITE_API;

const request = axios.create({
  baseURL,
  timeout: 15000,
  withCredentials: true
});

const MAX_RETRIES = 1;
const RETRY_DELAY = 500;

request.interceptors.request.use(
  (config: CustomAxiosRequestConfig) => {
    setData = getSetData();
    config.baseURL = window.electron
      ? `http://127.0.0.1:${setData?.musicApiPort}`
      : import.meta.env.VITE_API;
    if (config.retryCount === undefined) {
      config.retryCount = 0;
    }

    config.params = {
      ...config.params,
      timestamp: Date.now(),
      device: isElectron ? 'pc' : isMobile ? 'mobile' : 'web'
    };
    const token = localStorage.getItem('token');
    if (token && config.method !== 'post') {
      config.params.cookie = config.params.cookie !== undefined ? config.params.cookie : token;
    } else if (token && config.method === 'post') {
      config.data = {
        ...config.data,
        cookie: token
      };
    }
    if (isElectron) {
      const proxyConfig = setData?.proxyConfig;
      if (proxyConfig?.enable && ['http', 'https'].includes(proxyConfig?.protocol)) {
        config.params.proxy = `${proxyConfig.protocol}://${proxyConfig.host}:${proxyConfig.port}`;
      }
      if (setData.enableRealIP && setData.realIP) {
        config.params.realIP = setData.realIP;
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

const NO_RETRY_URLS = ['Nothing here yet'];

request.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    console.error('error', error);
    const config = error.config as CustomAxiosRequestConfig;

    if (!config) {
      return Promise.reject(error);
    }

    if (error.response?.status === 301 && config.params?.noLogin !== true) {
      const userStore = useUserStore();
      userStore.handleLogout();
      console.log('301: session expired, cleared credentials, not retrying');
      return Promise.reject(error);
    }

    if (
      config.retryCount !== undefined &&
      config.retryCount < MAX_RETRIES &&
      !NO_RETRY_URLS.includes(config.url as string) &&
      !config.noRetry
    ) {
      config.retryCount++;
      console.error(`Retry attempt ${config.retryCount}`);

      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY));

      return request(config);
    }

    console.error(`Still failing after ${MAX_RETRIES} retries`);
    return Promise.reject(error);
  }
);

export default request;
