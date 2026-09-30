// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure .cjs extension is resolved
if (!config.resolver.sourceExts.includes('cjs')) {
  config.resolver.sourceExts.push('cjs');
}

// Disable unstable_enablePackageExports so Metro correctly resolves
// Firebase JS SDK internal React Native persistence & auth components
config.resolver.unstable_enablePackageExports = false;

// Canonical resolution for @firebase/app and @firebase/auth on native platforms
// This eliminates the dual module hazard where auth registers on one copy and initializeApp runs on another.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (platform !== 'web') {
    if (moduleName === '@firebase/app' || moduleName === 'firebase/app') {
      return {
        filePath: path.resolve(__dirname, 'node_modules/@firebase/app/dist/index.cjs.js'),
        type: 'sourceFile',
      };
    }
    if (moduleName === '@firebase/auth' || moduleName === 'firebase/auth') {
      return {
        filePath: path.resolve(__dirname, 'node_modules/@firebase/auth/dist/rn/index.js'),
        type: 'sourceFile',
      };
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
