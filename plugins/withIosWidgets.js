const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

// Ensure node_modules/expo-widgets is patched immediately on plugin load
try {
  require('../scripts/patch-ios-widgets');
} catch (e) {
  console.warn('[withIosWidgets] Warning running initial patch:', e?.message || e);
}

/**
 * Patches a Swift widget source file to wrap WidgetsEntryView with .containerBackground(for: .widget)
 * to satisfy iOS 17+ WidgetKit containerBackground requirement without warnings.
 */
function patchSourceFileIfPresent(filePath, bgSwiftColor) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // If already contains containerBackground, don't patch again
  if (content.includes('.containerBackground')) return;

  const targetPattern = /WidgetsEntryView\(entry:\s*entry\)/g;
  if (targetPattern.test(content)) {
    content = content.replace(
      targetPattern,
      `if #available(iOS 17.0, *) {
        WidgetsEntryView(entry: entry)
          .containerBackground(for: .widget) {
            ${bgSwiftColor}
          }
      } else {
        WidgetsEntryView(entry: entry)
      }`
    );
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

/**
 * Expo Config Plugin for iOS WidgetKit customization:
 * Injects containerBackground(for: .widget), safe timeline entries,
 * and native fallback views for iOS 17+ widgets targeting ExpoWidgetsTarget.
 */
const withIosWidgets = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosRoot = config.modRequest.platformProjectRoot;
      const targetDir = path.join(iosRoot, 'ExpoWidgetsTarget');

      const questionWidgetSwift = path.join(targetDir, 'QuestionWidget.swift');
      const streakWidgetSwift = path.join(targetDir, 'StreakWidget.swift');

      // Coral/Rose gradient for QuestionWidget
      patchSourceFileIfPresent(
        questionWidgetSwift,
        'LinearGradient(colors: [Color(red: 1.0, green: 0.42, blue: 0.53), Color(red: 1.0, green: 0.29, blue: 0.17)], startPoint: .topLeading, endPoint: .bottomTrailing)'
      );

      // Fire orange/red gradient for StreakWidget
      patchSourceFileIfPresent(
        streakWidgetSwift,
        'LinearGradient(colors: [Color(red: 1.0, green: 0.29, blue: 0.17), Color(red: 0.95, green: 0.15, blue: 0.07)], startPoint: .topLeading, endPoint: .bottomTrailing)'
      );

      try {
        const patchScript = path.resolve(__dirname, '../scripts/patch-ios-widgets.js');
        delete require.cache[require.resolve(patchScript)];
        require(patchScript);
      } catch (err) {
        console.warn('[withIosWidgets] Error patching iOS widgets in mod:', err?.message || err);
      }
      return config;
    },
  ]);
};

module.exports = withIosWidgets;
