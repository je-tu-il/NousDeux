const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Patches a Swift widget source file to wrap WidgetsEntryView with .containerBackground
 * to satisfy iOS 17+ WidgetKit containerBackground requirement without warnings.
 */
function patchSourceFileIfPresent(filePath, bgSwiftColor) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // If already contains containerBackground, don't patch again
  if (content.includes('.containerBackground')) return;

  const targetPattern = /StaticConfiguration\s*\(\s*kind:\s*name,\s*provider:\s*WidgetsTimelineProvider\(name:\s*name\)\s*\)\s*\{\s*entry\s*in\s*WidgetsEntryView\(entry:\s*entry\)\s*\}/g;

  const replacement = `StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      if #available(iOS 17.0, *) {
        WidgetsEntryView(entry: entry)
          .containerBackground(${bgSwiftColor}, for: .widget)
      } else {
        WidgetsEntryView(entry: entry)
      }
    }`;

  if (targetPattern.test(content)) {
    content = content.replace(targetPattern, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
  } else if (content.includes('WidgetsEntryView(entry: entry)')) {
    content = content.replace(
      /WidgetsEntryView\(entry:\s*entry\)/g,
      `if #available(iOS 17.0, *) {\n        WidgetsEntryView(entry: entry)\n          .containerBackground(${bgSwiftColor}, for: .widget)\n      } else {\n        WidgetsEntryView(entry: entry)\n      }`
    );
    fs.writeFileSync(filePath, content, 'utf8');
  }
}

// Opportunistically patch node_modules/expo-widgets Swift code generator if present
try {
  const expoWidgetsGeneratorPath = path.resolve(
    __dirname,
    '../node_modules/expo-widgets/plugin/build/ios/withWidgetSourceFiles.js'
  );
  if (fs.existsSync(expoWidgetsGeneratorPath)) {
    let genContent = fs.readFileSync(expoWidgetsGeneratorPath, 'utf8');
    if (!genContent.includes('.containerBackground')) {
      genContent = genContent.replace(
        /WidgetsEntryView\(entry:\s*entry\)/g,
        `if #available(iOS 17.0, *) {\\n        WidgetsEntryView(entry: entry)\\n          .containerBackground(Color(red: 1.0, green: 0.42, blue: 0.53), for: .widget)\\n      } else {\\n        WidgetsEntryView(entry: entry)\\n      }`
      );
      fs.writeFileSync(expoWidgetsGeneratorPath, genContent, 'utf8');
    }
  }
} catch {
  // Ignore in environments where node_modules is not yet present
}

/**
 * Expo Config Plugin for iOS WidgetKit customization:
 * Injects containerBackground(for: .widget) and content margins configuration
 * for iOS 17+ home screen widgets.
 */
const withIosWidgets = (config) => {
  return withDangerousMod(config, [
    'ios',
    async (config) => {
      const iosRoot = config.modRequest.platformProjectRoot;
      const targetDir = path.join(iosRoot, 'ExpoWidgetsTarget');

      const questionWidgetSwift = path.join(targetDir, 'QuestionWidget.swift');
      const streakWidgetSwift = path.join(targetDir, 'StreakWidget.swift');

      // Coral/Rose tint for QuestionWidget (#FF6A88)
      patchSourceFileIfPresent(questionWidgetSwift, 'Color(red: 1.0, green: 0.42, blue: 0.53)');

      // Fire orange/red tint for StreakWidget (#FF4B2B)
      patchSourceFileIfPresent(streakWidgetSwift, 'Color(red: 1.0, green: 0.29, blue: 0.17)');

      return config;
    },
  ]);
};

module.exports = withIosWidgets;
