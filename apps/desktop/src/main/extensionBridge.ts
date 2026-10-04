import http from 'node:http';
import { z } from 'zod';

/** Fixed loopback port the browser extension posts to. */
export const BRIDGE_PORT = 47615;

const ApplyRequest = z.object({
  url: z.url().max(8_192),
  title: z.string().trim().max(500).optional(),
  company: z.string().trim().max(500).optional(),
});

export type ApplyRequest = z.infer<typeof ApplyRequest>;
export interface BridgeReply {
  state: string;
  message: string;
}
export interface BridgeHandlers {
  apply(request: ApplyRequest): Promise<BridgeReply>;
  status(url: string): Promise<BridgeReply>;
  focus(): void;
}

const EXTENSION_ORIGIN = /^(moz|chrome|safari-web)-extension:\/\/[\w.-]+$/;

/**
 * Loopback JSON API for the Forkday browser extension.
 * Web pages cannot use it: they always send an http(s) Origin, which is
 * rejected, and cannot send JSON cross-origin without a preflight we refuse.
 */
export function startBridge(
  handlers: BridgeHandlers,
  port = BRIDGE_PORT,
): Promise<{ server: http.Server; port: number }> {
  const server = http.createServer((request, response) => {
    const origin = request.headers.origin;
    const send = (status: number, body: unknown): void => {
      response.writeHead(status, {
        'Content-Type': 'application/json',
        ...(origin && EXTENSION_ORIGIN.test(origin)
          ? {
              'Access-Control-Allow-Origin': origin,
              'Access-Control-Allow-Methods': 'POST',
              'Access-Control-Allow-Headers': 'Content-Type',
              Vary: 'Origin',
            }
          : {}),
      });
      response.end(JSON.stringify(body));
    };
    const host = request.headers.host ?? '';
    if (
      (origin && !EXTENSION_ORIGIN.test(origin)) ||
      !/^(127\.0\.0\.1|localhost):\d+$/.test(host)
    )
      return send(403, { error: 'Forbidden' });
    if (request.method === 'OPTIONS') return send(204, {});
    if (
      request.method !== 'POST' ||
      !request.headers['content-type']?.startsWith('application/json')
    )
      return send(405, { error: 'Use POST with JSON.' });

    let size = 0;
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => {
      size += chunk.length;
      if (size > 16_384) request.destroy();
      else chunks.push(chunk);
    });
    request.on('end', () => {
      void (async () => {
        try {
          const body: unknown = JSON.parse(
            Buffer.concat(chunks).toString('utf8') || '{}',
          );
          if (request.url === '/v1/apply')
            return send(200, await handlers.apply(ApplyRequest.parse(body)));
          if (request.url === '/v1/status')
            return send(
              200,
              await handlers.status(
                ApplyRequest.pick({ url: true }).parse(body).url,
              ),
            );
          if (request.url === '/v1/focus') {
            handlers.focus();
            return send(200, { ok: true });
          }
          send(404, { error: 'Not found' });
        } catch (error) {
          send(400, {
            error:
              error instanceof z.ZodError
                ? 'Invalid request.'
                : error instanceof Error
                  ? error.message
                  : 'Request failed.',
          });
        }
      })();
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject);
      const address = server.address();
      resolve({
        server,
        port: typeof address === 'object' && address ? address.port : port,
      });
    });
  });
}
