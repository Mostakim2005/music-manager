import { net, protocol } from 'electron';

import { parsePluginMediaUrl, PLUGIN_MEDIA_SCHEME } from '../../shared/musicSourcePlugin';

/**
 *
 */
export const initPluginMediaProxy = (): void => {
  protocol.handle(PLUGIN_MEDIA_SCHEME, async (request) => {
    const target = parsePluginMediaUrl(request.url);
    if (!target) {
      return new Response(null, { status: 400 });
    }

    const headers: Record<string, string> = { ...target.headers };
    const range = request.headers.get('range');
    if (range) headers['Range'] = range;

    try {
      const upstream = await net.fetch(target.url, {
        method: 'GET',
        headers,
        redirect: 'follow'
      });

      const responseHeaders: Record<string, string> = {};
      for (const name of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
        const value = upstream.headers.get(name);
        if (value) responseHeaders[name] = value;
      }

      return new Response(upstream.body, {
        status: upstream.status,
        headers: responseHeaders
      });
    } catch (error) {
      console.error('[PluginMediaProxy] Proxy request failed:', target.url, error);
      return new Response(null, { status: 502 });
    }
  });
};
