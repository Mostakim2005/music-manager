/**
 * Loopback HTTP server for local media files.
 *
 * Chromium's media pipeline rejects non-standard schemes ("Media load rejected
 * by URL safety check") and cannot seek them, so local audio/video must be
 * served over http://127.0.0.1 with proper `Range` support. Files are exposed
 * only to processes on this machine and only by exact path.
 */

import { createReadStream, promises as fs } from 'fs';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse
} from 'http';
import { extname } from 'path';
import { Readable } from 'stream';

import { ipcMain } from 'electron';

const MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.opus': 'audio/ogg',
  '.wav': 'audio/wav',
  '.wma': 'audio/x-ms-wma',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.ts': 'video/mp2t'
};

/**
 * Proxies a remote media URL (with its required headers) through this origin so
 * Chromium's media layer accepts it and `Range` seeks reach the upstream.
 */
async function proxyRemoteMedia(
  req: IncomingMessage,
  res: ServerResponse,
  corsHeaders: Record<string, string>
): Promise<void> {
  try {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    const target = Buffer.from(url.searchParams.get('u') || '', 'base64url').toString('utf8');
    if (!target) {
      res.writeHead(400, corsHeaders);
      res.end('Missing media url');
      return;
    }

    let upstreamHeaders: Record<string, string> = {};
    const encodedHeaders = url.searchParams.get('h');
    if (encodedHeaders) {
      try {
        upstreamHeaders = JSON.parse(
          Buffer.from(encodedHeaders, 'base64url').toString('utf8')
        );
      } catch {
        upstreamHeaders = {};
      }
    }
    if (typeof req.headers.range === 'string') {
      upstreamHeaders.Range = req.headers.range;
    }

    const upstream = await fetch(target, { headers: upstreamHeaders, redirect: 'follow' });
    const responseHeaders: Record<string, string> = {
      ...corsHeaders,
      'Content-Type': upstream.headers.get('content-type') || 'application/octet-stream',
      'Accept-Ranges': upstream.headers.get('accept-ranges') || 'bytes',
      'Cache-Control': 'no-store'
    };
    const contentLength = upstream.headers.get('content-length');
    if (contentLength) responseHeaders['Content-Length'] = contentLength;
    const contentRange = upstream.headers.get('content-range');
    if (contentRange) responseHeaders['Content-Range'] = contentRange;

    res.writeHead(upstream.status, responseHeaders);
    if (!upstream.body || req.method === 'HEAD') {
      res.end();
      return;
    }

    const stream = Readable.fromWeb(upstream.body as any);
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  } catch (error) {
    console.error('[local-media] remote proxy failed:', error);
    res.writeHead(502, corsHeaders);
    res.end('Upstream media unavailable');
  }
}

let server: Server | null = null;
let serverPort = 0;
let starting: Promise<number> | null = null;

export function getLocalMediaBaseUrl(): string {
  return serverPort ? `http://127.0.0.1:${serverPort}` : '';
}

export function startLocalMediaServer(): Promise<number> {
  if (serverPort) return Promise.resolve(serverPort);
  if (starting) return starting;

  starting = new Promise<number>((resolve, reject) => {
    server = createServer(async (req, res) => {
      const corsHeaders: Record<string, string> = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
        'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges'
      };

      if (req.method === 'OPTIONS') {
        res.writeHead(204, corsHeaders);
        res.end();
        return;
      }

      let pathname = '/';
      let filePath = '';
      try {
        const url = new URL(req.url || '/', 'http://127.0.0.1');
        pathname = url.pathname;
        const encoded = url.searchParams.get('p');
        if (encoded) {
          filePath = Buffer.from(encoded, 'base64url').toString('utf8');
        }
      } catch {
        res.writeHead(400, corsHeaders);
        res.end('Bad request');
        return;
      }

      if (pathname === '/remote') {
        await proxyRemoteMedia(req, res, corsHeaders);
        return;
      }

      if (pathname !== '/media' || !filePath) {
        res.writeHead(404, corsHeaders);
        res.end('Not found');
        return;
      }

      try {
        const stat = await fs.stat(filePath);
        if (!stat.isFile()) throw new Error('not a file');

        const contentType = MIME_TYPES[extname(filePath).toLowerCase()] || 'application/octet-stream';
        const rangeHeader = req.headers.range;

        if (rangeHeader) {
          const match = /^bytes=(\d*)-(\d*)$/i.exec(rangeHeader.trim());
          if (match) {
            const size = stat.size;
            let start = match[1] ? Number.parseInt(match[1], 10) : NaN;
            let end = match[2] ? Number.parseInt(match[2], 10) : NaN;

            if (Number.isNaN(start)) {
              // Suffix range: bytes=-500 => last 500 bytes
              const suffix = Number.isNaN(end) ? 0 : end;
              start = Math.max(0, size - suffix);
              end = size - 1;
            } else if (Number.isNaN(end)) {
              end = size - 1;
            }

            if (start < 0) start = 0;
            if (end >= size) end = size - 1;

            if (start > end || start >= size) {
              res.writeHead(416, {
                ...corsHeaders,
                'Content-Range': `bytes */${size}`
              });
              res.end();
              return;
            }

            res.writeHead(206, {
              ...corsHeaders,
              'Content-Type': contentType,
              'Accept-Ranges': 'bytes',
              'Content-Range': `bytes ${start}-${end}/${size}`,
              'Content-Length': String(end - start + 1),
              'Cache-Control': 'no-store'
            });

            const stream = createReadStream(filePath, { start, end });
            stream.on('error', () => res.destroy());
            res.on('close', () => stream.destroy());
            stream.pipe(res);
            return;
          }
        }

        res.writeHead(200, {
          ...corsHeaders,
          'Content-Type': contentType,
          'Accept-Ranges': 'bytes',
          'Content-Length': String(stat.size),
          'Cache-Control': 'no-store'
        });

        if (req.method === 'HEAD') {
          res.end();
          return;
        }

        const stream = createReadStream(filePath);
        stream.on('error', () => res.destroy());
        res.on('close', () => stream.destroy());
        stream.pipe(res);
      } catch {
        res.writeHead(404, corsHeaders);
        res.end('File not found');
      }
    });

    server.on('error', (err) => {
      starting = null;
      reject(err);
    });

    server.listen(0, '127.0.0.1', () => {
      const address = server?.address();
      if (address && typeof address === 'object') {
        serverPort = address.port;
        console.log('[local-media] serving on', getLocalMediaBaseUrl());
        resolve(serverPort);
      } else {
        starting = null;
        reject(new Error('Failed to bind local media server'));
      }
    });
  });

  return starting;
}

/** Registers the synchronous bridge used by the preload script. */
export function registerLocalMediaIpc(): void {
  ipcMain.on('local-media:base-url', (event) => {
    event.returnValue = getLocalMediaBaseUrl();
  });
}
