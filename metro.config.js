// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure .cjs extension is resolved
if (!config.resolver.sourceExts.includes('cjs')) {
  config.resolver.sourceExts.push('cjs');
}

// Disable unstable_enablePackageExports so Metro correctly resolves
// Firebase JS SDK internal React Native persistence & auth components
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
