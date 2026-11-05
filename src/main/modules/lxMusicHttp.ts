/**
 */

import { ipcMain } from 'electron';
import fetch, { type RequestInit } from 'node-fetch';

interface LxHttpRequest {
  url: string;
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
    data?: unknown;
    params?: Record<string, unknown>;
    form?: Record<string, string>;
    formData?: Record<string, string>;
    timeout?: number;
  };
  requestId: string;
}

interface LxHttpResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: any;
}

const abortControllers = new Map<string, AbortController>();

const appendQueryParams = (url: string, params?: Record<string, unknown>): string => {
  if (!params || typeof params !== 'object') return url;

  try {
    const target = new URL(url);
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null) continue;
      if (Array.isArray(value)) {
        value.forEach((item) => target.searchParams.append(key, String(item)));
      } else if (typeof value === 'object') {
        target.searchParams.set(key, JSON.stringify(value));
      } else {
        target.searchParams.set(key, String(value));
      }
    }
    return target.toString();
  } catch {
    return url;
  }
};

/**
 */
export const initLxMusicHttp = () => {
  ipcMain.handle(
    'lx-music-http-request',
    async (_, request: LxHttpRequest): Promise<LxHttpResponse> => {
      const { options, requestId } = request;
      const url = appendQueryParams(request.url, options.params);
      const controller = new AbortController();

      abortControllers.set(requestId, controller);

      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      try {
        console.log(`[LxMusicHttp] Request: ${options.method || 'GET'} ${url}`);

        const method = String(options.method || 'GET').toUpperCase();
        const fetchOptions: RequestInit = {
          method,
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            ...(options.headers || {})
          },
          signal: controller.signal
        };

        if (options.body !== undefined) {
          fetchOptions.body = options.body;
        } else if (options.data !== undefined && method !== 'GET' && method !== 'HEAD') {
          if (typeof options.data === 'string') {
            fetchOptions.body = options.data;
          } else {
            fetchOptions.body = JSON.stringify(options.data);
            fetchOptions.headers = {
              ...fetchOptions.headers,
              'Content-Type': 'application/json'
            };
          }
        } else if (options.form) {
          const formData = new URLSearchParams(options.form);
          fetchOptions.body = formData.toString();
          fetchOptions.headers = {
            ...fetchOptions.headers,
            'Content-Type': 'application/x-www-form-urlencoded'
          };
        } else if (options.formData) {
          const FormData = (await import('form-data')).default;
          const formData = new FormData();
          for (const [key, value] of Object.entries(options.formData)) {
            formData.append(key, value);
          }
          fetchOptions.body = formData as any;
        }

        const timeout = options.timeout || 30000;
        timeoutId = setTimeout(() => {
          console.warn(`[LxMusicHttp] Request timed out: ${url}`);
          controller.abort();
        }, timeout);

        const response = await fetch(url, fetchOptions);
        clearTimeout(timeoutId);
        timeoutId = null;

        console.log(`[LxMusicHttp] Response: ${response.status} ${url}`);

        const rawBody = await response.text();

        let parsedBody: any = rawBody;
        const contentType = response.headers.get('content-type') || '';
        if (
          contentType.includes('application/json') ||
          rawBody.startsWith('{') ||
          rawBody.startsWith('[')
        ) {
          try {
            parsedBody = JSON.parse(rawBody);
          } catch {
            // Ignore a response body that cannot be parsed
          }
        }

        const headers: Record<string, string | string[]> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        const result: LxHttpResponse = {
          statusCode: response.status,
          headers,
          body: parsedBody
        };

        return result;
      } catch (error: any) {
        console.error(`[LxMusicHttp] Request failed: ${url}`, error.message);
        throw error;
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        abortControllers.delete(requestId);
      }
    }
  );

  ipcMain.handle('lx-music-http-cancel', (_, requestId: string) => {
    const controller = abortControllers.get(requestId);
    if (controller) {
      console.log(`[LxMusicHttp] Request cancelled: ${requestId}`);
      controller.abort();
      abortControllers.delete(requestId);
    }
  });

  console.log('[LxMusicHttp] HTTP request handling initialized');
};

/**
 */
export const cleanupLxMusicHttp = () => {
  for (const [requestId, controller] of abortControllers.entries()) {
    console.log(`[LxMusicHttp] Request cleaned up: ${requestId}`);
    controller.abort();
  }
  abortControllers.clear();
};
