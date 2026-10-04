// Relays content-script requests to the Forkday desktop app on loopback.
// Firefox loads this as an event page, Chrome as a service worker.
const api = globalThis.browser ?? globalThis.chrome;
const BRIDGE = 'http://127.0.0.1:47615';

api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!['apply', 'status', 'focus'].includes(message?.type)) return false;
  fetch(`${BRIDGE}/v1/${message.type}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(message.body ?? {}),
  })
    .then(async (response) => {
      const body = await response.json().catch(() => ({}));
      sendResponse(
        response.ok
          ? body
          : {
              state: 'error',
              message: body.error ?? 'Forkday refused the request.',
            },
      );
    })
    .catch(() =>
      sendResponse({
        state: 'offline',
        message: 'Open the Forkday app, then try again.',
      }),
    );
  return true; // keep sendResponse alive for the async reply
});
