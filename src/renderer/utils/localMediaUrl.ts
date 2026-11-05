/**
 * Converts stored `local://` URLs into loopback HTTP URLs that Chromium's
 * media pipeline accepts (and can seek). Stored metadata keeps the `local://`
 * form so local-track detection elsewhere is unchanged.
 */

function getBaseUrl(): string {
  try {
    return (window as any)?.api?.localMediaBaseUrl || '';
  } catch {
    return '';
  }
}

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Builds a seekable loopback URL for an absolute file path. */
export function filePathToMediaUrl(filePath: string): string {
  const base = getBaseUrl();
  if (!base) {
    // Fallback keeps the previous behaviour when the server is unavailable.
    const normalized = filePath.replace(/\\/g, '/');
    return `local:///${normalized.split('/').map(encodeURIComponent).join('/')}`;
  }
  return `${base}/media?p=${toBase64Url(filePath)}`;
}

/** Returns a URL suitable for `<audio>` / `<video>`. */
export function toPlayableMediaUrl(url?: string | null): string | undefined {
  if (!url) return url ?? undefined;
  if (!url.startsWith('local://')) return url;
  // Without a running media server, leave the stored URL untouched rather than
  // round-tripping it through the encoder (which would rewrite the slash count).
  if (!getBaseUrl()) return url;

  try {
    const decoded = decodeURIComponent(url.slice('local://'.length));
    // /E:/Music/a.mp3 -> E:/Music/a.mp3 (Windows drive paths carry a leading slash)
    const filePath = /^\/[a-zA-Z]:\//.test(decoded) ? decoded.slice(1) : decoded;
    return filePathToMediaUrl(filePath);
  } catch {
    return url;
  }
}

/**
 * Proxies a remote media URL (and its required headers) through the loopback
 * server so Chromium accepts it and Range seeks work.
 */
export function remoteMediaProxyUrl(url: string, headers?: Record<string, string> | null): string {
  const base = getBaseUrl();
  if (!base) return url;
  const headerPart =
    headers && Object.keys(headers).length > 0 ? `&h=${toBase64Url(JSON.stringify(headers))}` : '';
  return `${base}/remote?u=${toBase64Url(url)}${headerPart}`;
}

/** Whether a media URL points at a local file. */
export function isLocalMediaUrl(url?: string | null): boolean {
  return Boolean(url && url.startsWith('local://'));
}
