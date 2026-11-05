import { protocol } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { Readable } from 'stream';

const MIME_TYPES: Record<string, string> = {
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/mp4',
  '.flac': 'audio/flac',
  '.ogg': 'audio/ogg',
  '.opus': 'audio/ogg; codecs=opus',
  '.wav': 'audio/wav',
  '.webm': 'audio/webm',
  '.mp4': 'video/mp4',
  '.mkv': 'video/x-matroska',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml'
};

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

export function decodeLocalProtocolUrl(rawUrl: string): string {
  const withoutScheme = rawUrl.replace(/^local:\/\/\/?/, '');

  const withoutQuery = withoutScheme.split('?')[0].split('#')[0];

  let decoded = withoutQuery;
  try {
    decoded = decodeURIComponent(withoutQuery);
  } catch {
    decoded = withoutQuery;
  }

  if (/^\/[a-zA-Z]:\//.test(decoded)) {
    decoded = decoded.slice(1);
  } else if (process.platform !== 'win32' && !decoded.startsWith('/')) {
    decoded = '/' + decoded;
  }

  return path.normalize(decoded);
}

/**
 */
function buildFileResponse(
  filePath: string,
  totalSize: number,
  rangeHeader: string | null
): Response {
  const mimeType = getMimeType(filePath);
  const commonHeaders: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': '*',
    'Accept-Ranges': 'bytes',
    'Content-Type': mimeType
  };

  const range416 = () =>
    new Response(null, {
      status: 416,
      headers: {
        ...commonHeaders,
        'Content-Range': `bytes */${totalSize}`
      }
    });

  let start = 0;
  let end = totalSize - 1;
  let partial = false;

  if (rangeHeader) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
    if (!match || (!match[1] && !match[2])) {
      return range416();
    }
    if (match[1]) {
      start = parseInt(match[1], 10);
      if (match[2]) {
        end = Math.min(parseInt(match[2], 10), end);
      }
    } else if (match[2]) {
      start = Math.max(0, totalSize - parseInt(match[2], 10));
    }
    if (start > end || start >= totalSize) {
      return range416();
    }
    partial = true;
  }

  return new Response(
    Readable.toWeb(fs.createReadStream(filePath, { start, end })) as ReadableStream,
    {
      status: partial ? 206 : 200,
      headers: {
        ...commonHeaders,
        'Content-Length': String(end - start + 1),
        ...(partial && { 'Content-Range': `bytes ${start}-${end}/${totalSize}` })
      }
    }
  );
}

/**
 */
export function registerLocalProtocol(): void {
  try {
    if (protocol.isProtocolHandled('local')) {
      protocol.unhandle('local');
    }

    protocol.handle('local', async (request) => {
      if (request.method === 'OPTIONS') {
        return new Response(null, {
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
            'Access-Control-Allow-Headers': '*'
          }
        });
      }

      try {
        const filePath = decodeLocalProtocolUrl(request.url);

        const stat = await fs.promises.stat(filePath).catch(() => null);
        if (!stat?.isFile()) {
          console.warn(
            '[localProtocol] File not found or not a file:',
            filePath,
            'from URL:',
            request.url
          );
          return new Response(null, {
            status: 404,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS'
            }
          });
        }

        return buildFileResponse(filePath, stat.size, request.headers.get('range'));
      } catch (err) {
        console.error('[localProtocol] Error handling request:', request.url, err);
        return new Response(null, {
          status: 500,
          headers: {
            'Access-Control-Allow-Origin': '*'
          }
        });
      }
    });
  } catch (error) {
    console.error('[localProtocol] Failed to register local protocol handler:', error);
  }
}
