import assert from 'node:assert/strict';
import http from 'node:http';
import test from 'node:test';
import { startBridge } from '../src/main/extensionBridge.ts';

test('bridge serves extension origins and refuses web pages', async () => {
  const applied: string[] = [];
  const { server, port } = await startBridge(
    {
      apply: async ({ url }) => {
        applied.push(url);
        return { state: 'queued', message: 'Queued' };
      },
      status: async () => ({ state: 'none', message: '' }),
      focus: () => {},
    },
    0,
  );
  const post = (path: string, headers: Record<string, string>, body = '{}') =>
    fetch(`http://127.0.0.1:${port}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body,
    });
  try {
    const job = JSON.stringify({
      url: 'https://acme.wd1.myworkdayjobs.com/job/1',
    });
    const ok = await post(
      '/v1/apply',
      { Origin: 'moz-extension://abc-123' },
      job,
    );
    assert.equal(ok.status, 200);
    assert.equal(
      ok.headers.get('access-control-allow-origin'),
      'moz-extension://abc-123',
    );
    assert.deepEqual(await ok.json(), { state: 'queued', message: 'Queued' });
    assert.equal(
      (await post('/v1/apply', { Origin: 'chrome-extension://abcdef' }, job))
        .status,
      200,
    );

    assert.equal(
      (await post('/v1/apply', { Origin: 'https://evil.example' }, job)).status,
      403,
    );
    assert.equal(
      (await post('/v1/apply', { Origin: 'null' }, job)).status,
      403,
    );
    // DNS rebinding: a page on evil.example resolving to 127.0.0.1 (fetch cannot set Host).
    const rebound = await new Promise<number>((resolve) =>
      http
        .request(
          {
            port,
            path: '/v1/apply',
            method: 'POST',
            headers: {
              Host: 'evil.example',
              'Content-Type': 'application/json',
            },
          },
          (response) => resolve(response.statusCode ?? 0),
        )
        .end(job),
    );
    assert.equal(rebound, 403);
    assert.equal(
      (await post('/v1/apply', {}, '{"url":"not a url"}')).status,
      400,
    );
    const form = await fetch(`http://127.0.0.1:${port}/v1/apply`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: job,
    });
    assert.equal(form.status, 405);
    assert.equal(applied.length, 2);
  } finally {
    server.close();
  }
});
