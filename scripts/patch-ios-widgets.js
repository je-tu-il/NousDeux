/**
 * scripts/patch-ios-widgets.js
 *
 * Comprehensive patch for iOS 17+ WidgetKit containerBackground support in expo-widgets.
 * Ensures:
 * 1. TimelineProvider never returns an empty timeline (which causes iOS to fail/drop widget state).
 * 2. EntryView.swift provides containerBackground(for: .widget) and a native fallback card.
 * 3. DynamicView.swift never collapses RedBox to EmptyView in release builds.
 * 4. withWidgetSourceFiles.js generates QuestionWidget and StreakWidget with .containerBackground(for: .widget).
 * 5. Generated targets in ios/ExpoWidgetsTarget are patched with containerBackground and correct gradients.
 * 6. Pods/ExpoWidgets source files are patched if present.
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');

function log(msg) {
  console.log(`[patch-ios-widgets] ${msg}`);
}

// 1. Patch TimelineProvider.swift
function patchTimelineProvider(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Fix empty timeline causing WidgetKit failure
  if (!content.includes('safeEntries')) {
    content = content.replace(
      /let timeline = Timeline<WidgetsTimelineEntry>\(entries: entries, policy: \.atEnd\)/g,
      `let safeEntries = entries.isEmpty ? [WidgetsTimelineEntry(date: Date(), name: name, props: nil, entryIndex: nil)] : entries\n    let timeline = Timeline<WidgetsTimelineEntry>(entries: safeEntries, policy: .atEnd)`
    );
    fs.writeFileSync(filePath, content, 'utf8');
    log(`Patched TimelineProvider with safeEntries in: ${filePath}`);
  }
}

// 2. Patch EntryView.swift
function patchEntryView(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('WidgetContainerBackgroundModifier')) {
    log(`EntryView already has WidgetContainerBackgroundModifier: ${filePath}`);
    return;
  }

  const newEntryViewCode = `import SwiftUI
import ExpoModulesCore
import WidgetKit

public struct WidgetsEntryView: View {
  @Environment(\\.self) var environment
  var entry: WidgetsTimelineProvider.Entry

  public init(entry: WidgetsTimelineProvider.Entry) {
    self.entry = entry
  }

  private var widgetEnvironment: [String: Any] {
    var env: [String: Any] = getWidgetEnvironment(environment: environment)
    env["timestamp"] = Int(entry.date.timeIntervalSince1970 * 1000)
    return env
  }

  private var widgetEnvironmentString: String? {
    guard let data = try? JSONSerialization.data(withJSONObject: widgetEnvironment),
          let jsonString = String(data: data, encoding: .utf8) else {
        return nil
    }
    return jsonString
  }

  public var body: some View {
    Group {
      if let layout = WidgetsStorage.getString(forKey: "__expo_widgets_\\(entry.name)_layout"),
         !layout.isEmpty {
        let node = evaluateLayout(layout: layout, props: entry.props ?? [:], environment: widgetEnvironment)
        WidgetsDynamicView(name: entry.name, kind: .widget, node: node, entryIndex: entry.entryIndex, environmentString: widgetEnvironmentString)
      } else {
        VStack(alignment: .leading, spacing: 6) {
          HStack {
            Text("NousDeux")
              .font(.system(size: 13, weight: .bold))
              .foregroundColor(.white)
            Spacer()
            Text(entry.name == "StreakWidget" ? "🔥 SÉRIE" : "💬 QUESTION")
              .font(.system(size: 10, weight: .bold))
              .foregroundColor(Color.white.opacity(0.85))
          }
          Spacer()
          Text(entry.name == "StreakWidget" ? "Votre série de couple" : "Question du Jour")
            .font(.system(size: 15, weight: .heavy))
            .foregroundColor(.white)
          Text("Ouvrez NousDeux pour synchroniser ✨")
            .font(.system(size: 11, weight: .medium))
            .foregroundColor(Color.white.opacity(0.9))
          Spacer()
        }
        .padding(12)
      }
    }
    .modifier(WidgetContainerBackgroundModifier(name: entry.name))
  }
}

private struct WidgetContainerBackgroundModifier: ViewModifier {
  let name: String

  func body(content: Content) -> some View {
    if #available(iOS 17.0, *) {
      content.containerBackground(for: .widget) {
        gradientBackground
      }
    } else {
      content.background(gradientBackground)
    }
  }

  private var gradientBackground: some View {
    LinearGradient(
      colors: name == "StreakWidget"
        ? [Color(red: 1.0, green: 0.29, blue: 0.17), Color(red: 0.95, green: 0.15, blue: 0.07)]
        : [Color(red: 1.0, green: 0.42, blue: 0.53), Color(red: 1.0, green: 0.29, blue: 0.17)],
      startPoint: .topLeading,
      endPoint: .bottomTrailing
    )
  }
}
`;

  fs.writeFileSync(filePath, newEntryViewCode, 'utf8');
  log(`Patched EntryView.swift with native fallback + containerBackground in: ${filePath}`);
}

// 3. Patch DynamicView.swift
function patchDynamicView(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('case "RedBoxView":') && content.includes('Synchronisation')) {
    return;
  }

  if (content.includes('#else') && content.includes('default:\n      EmptyView()')) {
    content = content.replace(
      /#else\s*\n\s*default:\s*\n\s*EmptyView\(\)/g,
      `#else\n    case "RedBoxView":\n      VStack(spacing: 4) {\n        Text("NousDeux").font(.system(size: 13, weight: .bold)).foregroundColor(.white)\n        Text("Synchronisation...").font(.system(size: 11)).foregroundColor(.white.opacity(0.85))\n      }\n    default:\n      EmptyView()`
    );
    fs.writeFileSync(filePath, content, 'utf8');
    log(`Patched DynamicView.swift RedBox release fallback in: ${filePath}`);
  }
}

// 4. Patch withWidgetSourceFiles.js generator
function patchWithWidgetSourceFiles(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Match the if (!configuration) block inside widgetSwift
  const configBlockPattern = /if \(!configuration\)\s*return `import WidgetKit[\s\S]*?supportedFamilies[\s\S]*?`\s*;/;

  const newSnippet = `const bgGradient = widget.name === "StreakWidget"
      ? "LinearGradient(colors: [Color(red: 1.0, green: 0.29, blue: 0.17), Color(red: 0.95, green: 0.15, blue: 0.07)], startPoint: .topLeading, endPoint: .bottomTrailing)"
      : "LinearGradient(colors: [Color(red: 1.0, green: 0.42, blue: 0.53), Color(red: 1.0, green: 0.29, blue: 0.17)], startPoint: .topLeading, endPoint: .bottomTrailing)";

    if (!configuration)
        return \`import WidgetKit
import SwiftUI
internal import ExpoWidgets

struct \${widget.name}: Widget {
  let name: String = "\${widget.name}"

  var body: some WidgetConfiguration {
    StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      if #available(iOS 17.0, *) {
        WidgetsEntryView(entry: entry)
          .containerBackground(for: .widget) {
            \${bgGradient}
          }
      } else {
        WidgetsEntryView(entry: entry)
      }
    }
    .configurationDisplayName(\${JSON.stringify(widget.displayName)})
    .description(\${JSON.stringify(widget.description)})
    .supportedFamilies([.\${supportedFamilies.join(', .')}])\${contentMarginsDisabled ? '\\n    .contentMarginsDisabled()' : ''}
  }
}\`;`;

  if (configBlockPattern.test(content)) {
    content = content.replace(configBlockPattern, newSnippet);
    fs.writeFileSync(filePath, content, 'utf8');
    log(`Patched withWidgetSourceFiles.js generator: ${filePath}`);
  } else {
    log(`configBlockPattern did not match in withWidgetSourceFiles.js`);
  }
}

// 5. Patch generated Swift widgets in target directory
function patchSwiftTargetFile(filePath, bgSwiftGradient) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Replace any existing WidgetsEntryView(entry: entry) or partial containerBackground
  const blockPattern = /StaticConfiguration\(kind: name, provider: WidgetsTimelineProvider\(name: name\)\)\s*\{[\s\S]*?WidgetsEntryView\(entry: entry\)[\s\S]*?\}/g;
  const replacement = `StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      if #available(iOS 17.0, *) {
        WidgetsEntryView(entry: entry)
          .containerBackground(for: .widget) {
            ${bgSwiftGradient}
          }
      } else {
        WidgetsEntryView(entry: entry)
      }
    }`;

  if (blockPattern.test(content)) {
    content = content.replace(blockPattern, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    log(`Patched Swift widget source: ${filePath}`);
  } else {
    log(`Could not find StaticConfiguration block in: ${filePath}`);
  }
}

// Execute all patches
function run() {
  log('Starting iOS widgets patch...');

  // 1. node_modules/expo-widgets/ios/
  const expoWidgetsIos = path.join(rootDir, 'node_modules/expo-widgets/ios');
  patchTimelineProvider(path.join(expoWidgetsIos, 'Widgets/TimelineProvider.swift'));
  patchEntryView(path.join(expoWidgetsIos, 'Widgets/EntryView.swift'));
  patchDynamicView(path.join(expoWidgetsIos, 'Widgets/DynamicView.swift'));

  // 2. node_modules/expo-widgets/plugin/build/ios/withWidgetSourceFiles.js
  const withWidgetSourceFilesPath = path.join(
    rootDir,
    'node_modules/expo-widgets/plugin/build/ios/withWidgetSourceFiles.js'
  );
  patchWithWidgetSourceFiles(withWidgetSourceFilesPath);

  // 3. ios/ExpoWidgetsTarget (if prebuild has run)
  const targetDir = path.join(rootDir, 'ios/ExpoWidgetsTarget');
  patchSwiftTargetFile(
    path.join(targetDir, 'QuestionWidget.swift'),
    'LinearGradient(colors: [Color(red: 1.0, green: 0.42, blue: 0.53), Color(red: 1.0, green: 0.29, blue: 0.17)], startPoint: .topLeading, endPoint: .bottomTrailing)'
  );
  patchSwiftTargetFile(
    path.join(targetDir, 'StreakWidget.swift'),
    'LinearGradient(colors: [Color(red: 1.0, green: 0.29, blue: 0.17), Color(red: 0.95, green: 0.15, blue: 0.07)], startPoint: .topLeading, endPoint: .bottomTrailing)'
  );

  // 4. ios/Pods/ExpoWidgets/ (if pod install has run)
  const podsExpoWidgets = path.join(rootDir, 'ios/Pods/ExpoWidgets');
  patchTimelineProvider(path.join(podsExpoWidgets, 'Widgets/TimelineProvider.swift'));
  patchEntryView(path.join(podsExpoWidgets, 'Widgets/EntryView.swift'));
  patchDynamicView(path.join(podsExpoWidgets, 'Widgets/DynamicView.swift'));

  log('iOS widgets patch completed successfully.');
}

run();
