// macOS only delivers notifications from a sealed app bundle. The downloaded
// dev Electron.app is linker-signed without its Info.plist bound, so every
// notification fails with UNErrorDomain error 1. Re-sign it ad hoc once.
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import path from 'node:path';

if (process.platform === 'darwin') {
  const binary = createRequire(import.meta.url)('electron');
  const bundle = path.resolve(binary, '../../..');
  const { stderr } = spawnSync('codesign', ['-dv', bundle], {
    encoding: 'utf8',
  });
  if (/Info\.plist=not bound/.test(stderr)) {
    const result = spawnSync(
      'codesign',
      ['--force', '--deep', '--sign', '-', bundle],
      { stdio: 'inherit' },
    );
    if (result.status === 0)
      console.log('Signed the dev Electron app so notifications can appear.');
  }
}
