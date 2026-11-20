const { spawnSync } = require('node:child_process');
const path = require('node:path');
const cli = path.join(path.dirname(require.resolve('expo/package.json')), 'bin', 'cli');
const result = spawnSync(process.execPath, [cli, 'export', '--platform', 'web', '--output-dir', '.expo/emulator-web'], {
  stdio: 'inherit',
  env: { ...process.env, EXPO_PUBLIC_FIREBASE_EMULATORS: 'true', EXPO_PUBLIC_APP_ENV: 'test' },
});
process.exitCode = result.status ?? 1;
