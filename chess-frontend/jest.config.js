// Fallback Jest config for `react-scripts test`.
//
// `pnpm test -- <args>` forwards a literal `--` to react-scripts, and Jest then
// treats every later argument - including CRA's own `--config {...}` and
// `--env jsdom` - as a test pattern. Jest falls back to this file, so it rebuilds
// the CRA config (same transforms, setup files, jsdom env) and keeps the
// Playwright specs in tests/e2e out of the unit run. Without the stray `--`,
// CRA's explicit --config wins and this file is not read.
const path = require('path');

const reactScriptsDir = path.dirname(require.resolve('react-scripts/package.json'));
const createJestConfig = require('react-scripts/scripts/utils/createJestConfig');

const config = createJestConfig(
  (relativePath) => path.resolve(reactScriptsDir, relativePath),
  __dirname,
  false
);

module.exports = {
  ...config,
  testEnvironment: require.resolve('jest-environment-jsdom', { paths: [reactScriptsDir] }),
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/e2e/'],
};
