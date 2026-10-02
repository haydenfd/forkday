import assert from 'node:assert/strict';
import http from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const require = createRequire(`${root}/apps/desktop/package.json`);
const { _electron } = require('playwright');
const server = http.createServer((_req, res) =>
  res.end(
    '<html><body style="padding:40px;background:#eef5ff;font-family:system-ui"><h1>Embedded job page</h1><p>Job details display inside Forkday.</p><a href="/next" target="_blank">Apply</a></body></html>',
  ),
);
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/job`;
const profile = await mkdtemp('/tmp/forkday-embed-');
const TOP_BAR_HEIGHT = 56;
let app;
try {
  app = await _electron.launch({
    executablePath: require('electron'),
    args: [
      `${root}/apps/desktop/out/main/index.js`,
      `--user-data-dir=${profile}`,
    ],
    env: { ...process.env, ELECTRON_RENDERER_URL: '' },
  });
  // State of the embedded job browser (the window's non-shell child view).
  const browserView = () =>
    app.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      const view = win.contentView.children.find(
        (v) => v.webContents && v.webContents !== win.webContents,
      );
      return {
        windows: BrowserWindow.getAllWindows().length,
        contentSize: win.getContentSize(),
        url: view?.webContents.getURL(),
        bounds: view?.getBounds(),
        visible: view?.getVisible(),
      };
    });
  const waitForBrowserUrl = async (expected) => {
    for (let i = 0; i < 50; i++) {
      if ((await browserView()).url === expected) return;
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.equal((await browserView()).url, expected);
  };
  const assertRightHalf = (state) => {
    const [width, height] = state.contentSize;
    assert.deepEqual(state.bounds, {
      x: Math.floor(width / 2),
      y: TOP_BAR_HEIGHT,
      width: width - Math.floor(width / 2),
      height: height - TOP_BAR_HEIGHT,
    });
  };

  const page = await app.firstWindow();
  await page.getByRole('heading', { name: 'Tasks', exact: true }).waitFor();
  await page.getByRole('link', { name: 'Browser', exact: true }).click();
  const heading = page.getByRole('heading', { name: 'Open a job' });
  await heading.waitFor();
  const shellUrl = page.url();
  await Promise.all([
    page.waitForEvent('domcontentloaded'),
    page.evaluate(() => window.location.reload()),
  ]);
  await heading.waitFor();
  assert.equal(page.url(), shellUrl);
  assert.equal((await browserView()).url, undefined);

  await page.getByLabel('Job URL').fill(url);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await waitForBrowserUrl(url);
  let state = await browserView();
  assert.equal(state.windows, 1);
  assert.equal(state.url, url);
  assert.equal(state.visible, true);
  assertRightHalf(state);
  assert.equal(
    await page
      .locator('main')
      .evaluate((element) => element.getBoundingClientRect().width),
    state.contentSize[0] / 2,
  );

  await app.evaluate(async ({ BrowserWindow }) => {
    const win = BrowserWindow.getAllWindows()[0];
    const view = win.contentView.children.find(
      (v) => v.webContents && v.webContents !== win.webContents,
    );
    if (
      (await view.webContents.executeJavaScript('typeof window.forkday')) !==
      'undefined'
    )
      throw new Error('Remote preload leak');
    await view.webContents.executeJavaScript(
      'document.querySelector("a").click()',
    );
  });
  await new Promise((r) => setTimeout(r, 500));
  state = await browserView();
  assert.equal(state.windows, 1);
  assert.equal(state.url, url.replace('/job', '/next'));

  await app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].setContentSize(1000, 700),
  );
  await new Promise((r) => setTimeout(r, 200));
  assertRightHalf(await browserView());

  for (const name of ['Settings', 'Profile', 'Saved Credentials']) {
    await page.getByRole('link', { name, exact: true }).click();
    await page.getByRole('heading', { name, exact: true }).waitFor();
    await new Promise((r) => setTimeout(r, 200));
    assert.equal((await browserView()).visible, false);
    await page.getByRole('link', { name: 'Browser', exact: true }).click();
    await heading.waitFor();
    await new Promise((r) => setTimeout(r, 200));
    assert.equal((await browserView()).visible, true);
  }

  const second = url.replace('/job', '/second');
  await page.getByLabel('Job URL').fill(second);
  await page.getByRole('button', { name: 'Open', exact: true }).click();
  await waitForBrowserUrl(second);

  await page.getByLabel('Job URL').fill('javascript:alert(1)');
  await page
    .getByLabel('Job URL')
    .evaluate((input) => input.form.requestSubmit());
  await page.getByRole('alert').waitFor();
  assert.equal((await browserView()).url, second);

  await page.evaluate((destination) => {
    window.location.href = destination;
  }, url);
  await new Promise((resolve) => setTimeout(resolve, 200));
  assert.equal(page.url().split('#')[0], shellUrl.split('#')[0]);

  console.log(
    'PASS: app reload, navigation guard, split view, embedded browser, isolation, resize, Settings/Profile/Saved Credentials hide/show, URL validation',
  );
} finally {
  await app?.close();
  server.close();
  await rm(profile, { recursive: true, force: true });
}
