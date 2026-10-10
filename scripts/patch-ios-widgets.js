/**
 * scripts/patch-ios-widgets.js
 *
 * Comprehensive patch for iOS 17+ WidgetKit containerBackground and native widget data sync in expo-widgets.
 * Ensures:
 * 1. TimelineProvider periodically reloads every 15 min and falls back to stored props instead of empty timeline.
 * 2. EntryView.swift renders real dynamic data (Streak, Question of the day, Partner answer status) natively in SwiftUI.
 * 3. DynamicView.swift never collapses RedBox to EmptyView in release builds.
 * 4. WidgetObject.swift never throws UpdatedTimelineWithoutLayout and reliably stores props and triggers reload.
 * 5. WidgetsStorage.swift provides resilient dual-layer persistence (UserDefaults + App Group shared container file).
 * 6. withWidgetSourceFiles.js generates QuestionWidget and StreakWidget with .containerBackground(for: .widget).
 * 7. Generated targets in ios/ExpoWidgetsTarget and CocoaPods sources are updated.
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

  if (content.includes('storedProps') && content.includes('nextUpdate')) {
    log(`TimelineProvider already patched: ${filePath}`);
    return;
  }

  const newTimelineProvider = `import WidgetKit

public struct WidgetsTimelineProvider: TimelineProvider {
  public func placeholder(in context: Context) -> WidgetsTimelineEntry {
    let storedProps = WidgetsStorage.getDictionary(forKey: "__expo_widgets_\\(name)_props")
      ?? WidgetsStorage.getDictionary(forKey: "__expo_widgets_latest_props")
    return WidgetsTimelineEntry(date: Date(), name: name, props: storedProps, entryIndex: nil)
  }

  public func getSnapshot(
    in context: Context, completion: @escaping @Sendable (WidgetsTimelineEntry) -> Void
  ) {
    let groupIdentifier =
      Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String
    let storedProps = WidgetsStorage.getDictionary(forKey: "__expo_widgets_\\(name)_props")
      ?? WidgetsStorage.getDictionary(forKey: "__expo_widgets_latest_props")
    guard let groupIdentifier else {
      completion(WidgetsTimelineEntry(date: Date(), name: name, props: storedProps, entryIndex: nil))
      return
    }

    let entries = parseTimeline(identifier: groupIdentifier, name: name, family: context.family)
    completion(entries.first ?? WidgetsTimelineEntry(date: Date(), name: name, props: storedProps, entryIndex: nil))
  }

  public func getTimeline(
    in context: Context,
    completion: @escaping @Sendable (Timeline<WidgetsTimelineEntry>) -> Void
  ) {
    let groupIdentifier =
      Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String
    guard let groupIdentifier else {
      fatalError("Could not get the app group identifier from Info.plist")
    }

    let entries = parseTimeline(identifier: groupIdentifier, name: name, family: context.family)
    let storedProps = WidgetsStorage.getDictionary(forKey: "__expo_widgets_\\(name)_props")
      ?? WidgetsStorage.getDictionary(forKey: "__expo_widgets_latest_props")

    let finalEntries = entries.isEmpty ? [WidgetsTimelineEntry(date: Date(), name: name, props: storedProps, entryIndex: nil)] : entries
    let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date()) ?? Date().addingTimeInterval(900)
    let timeline = Timeline<WidgetsTimelineEntry>(entries: finalEntries, policy: .after(nextUpdate))
    completion(timeline)
  }

  public typealias Entry = WidgetsTimelineEntry

  let name: String

  public init(name: String) {
    self.name = name
  }
}
`;

  fs.writeFileSync(filePath, newTimelineProvider, 'utf8');
  log(`Patched TimelineProvider with 15-min background policy & storedProps fallback in: ${filePath}`);
}

// 2. Patch EntryView.swift
function patchEntryView(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('hex: String') && content.includes('effectiveProps') && content.includes('gradientColors')) {
    log(`EntryView already has dynamic native widgets with theme colors: ${filePath}`);
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

  private var effectiveProps: [String: Any]? {
    if let p = entry.props, !p.isEmpty {
      return p
    }
    if let stored = WidgetsStorage.getDictionary(forKey: "__expo_widgets_\\(entry.name)_props"), !stored.isEmpty {
      return stored
    }
    if let latest = WidgetsStorage.getDictionary(forKey: "__expo_widgets_latest_props"), !latest.isEmpty {
      return latest
    }
    return nil
  }

  public var body: some View {
    Group {
      if entry.name == "StreakWidget" {
        streakView(props: effectiveProps)
          .widgetURL(URL(string: "nousdeuxapp://dashboard"))
      } else {
        questionView(props: effectiveProps)
          .widgetURL(URL(string: "nousdeuxapp://daylink"))
      }
    }
    .modifier(WidgetContainerBackgroundModifier(name: entry.name, props: effectiveProps))
  }

  private func streakView(props: [String: Any]?) -> some View {
    let streakInt: Int = {
      if let p = props, let i = p["streak"] as? Int { return i }
      if let p = props, let d = p["streak"] as? Double { return Int(d) }
      if let p = props, let s = p["streak"] as? String, let parsed = Int(s) { return parsed }
      return 1
    }()
    let partnerPseudo = (props?["partnerPseudo"] as? String) ?? "Partenaire"
    let userAnswered = props?["userAnswered"] as? Bool ?? false
    let partnerAnswered = props?["partnerAnswered"] as? Bool ?? false
    let bothAnswered = props?["bothAnswered"] as? Bool ?? (userAnswered && partnerAnswered)

    let streakLabel = streakInt > 1 ? "\\(streakInt) JOURS ENSEMBLE" : "\\(streakInt) JOUR ENSEMBLE"
    let statusText: String
    if bothAnswered {
      statusText = "🎉 Défi du jour relevé !"
    } else if partnerAnswered {
      statusText = "💌 \\(partnerPseudo) a répondu !"
    } else if userAnswered {
      statusText = "⏳ En attente de \\(partnerPseudo)"
    } else {
      statusText = "Touche pour voir ➔"
    }

    return VStack(alignment: .leading, spacing: 3) {
      HStack {
        Text("NousDeux")
          .font(.system(size: 13, weight: .bold))
          .foregroundColor(.white)
        Spacer()
        Text("🔥 DUO")
          .font(.system(size: 10, weight: .bold))
          .padding(.horizontal, 6)
          .padding(.vertical, 2)
          .background(Color.white.opacity(0.2))
          .cornerRadius(5)
          .foregroundColor(.white)
      }
      Spacer()
      Text("🔥 \\(streakInt)")
        .font(.system(size: 30, weight: .heavy))
        .foregroundColor(.white)
      Text(streakLabel)
        .font(.system(size: 11, weight: .bold))
        .foregroundColor(Color.white.opacity(0.9))
      Text(statusText)
        .font(.system(size: 10, weight: .medium))
        .foregroundColor(Color.white.opacity(0.95))
        .lineLimit(1)
      Spacer()
    }
    .padding(12)
  }

  private func questionView(props: [String: Any]?) -> some View {
    let question = (props?["todayQuestion"] as? String) ?? "Quelle est la plus belle chose que ton partenaire ait faite pour toi ?"
    let partnerPseudo = (props?["partnerPseudo"] as? String) ?? "Partenaire"
    let userAnswered = props?["userAnswered"] as? Bool ?? false
    let partnerAnswered = props?["partnerAnswered"] as? Bool ?? false
    let bothAnswered = props?["bothAnswered"] as? Bool ?? (userAnswered && partnerAnswered)

    let badgeText: String
    let ctaText: String

    if bothAnswered {
      badgeText = "✨ DÉCOUVERT"
      ctaText = "Vous avez tous les deux répondu 🎉"
    } else if partnerAnswered {
      badgeText = "💌 À TOI DE JOUER"
      ctaText = "\\(partnerPseudo) a répondu ! Touche pour voir ✨"
    } else if userAnswered {
      badgeText = "⏳ EN ATTENTE"
      ctaText = "En attente de \\(partnerPseudo)... 💕"
    } else {
      badgeText = "💬 QUESTION DU JOUR"
      ctaText = "Touche pour répondre ✨"
    }

    return VStack(alignment: .leading, spacing: 4) {
      HStack {
        Text("NousDeux")
          .font(.system(size: 12, weight: .bold))
          .foregroundColor(.white)
        Spacer()
        Text(badgeText)
          .font(.system(size: 9, weight: .bold))
          .padding(.horizontal, 6)
          .padding(.vertical, 2)
          .background(Color.white.opacity(0.2))
          .cornerRadius(5)
          .foregroundColor(.white)
      }
      Spacer()
      Text(question)
        .font(.system(size: 12, weight: .bold))
        .foregroundColor(.white)
        .lineLimit(3)
        .fixedSize(horizontal: false, vertical: true)
      Spacer()
      Text(ctaText)
        .font(.system(size: 10, weight: .medium))
        .foregroundColor(Color.white.opacity(0.9))
        .lineLimit(1)
    }
    .padding(12)
  }
}

extension Color {
  init(hex: String) {
    let cleanHex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
    var int: UInt64 = 0
    Scanner(string: cleanHex).scanHexInt64(&int)
    let a, r, g, b: UInt64
    switch cleanHex.count {
    case 3:
      (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
    case 6:
      (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
    case 8:
      (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
    default:
      (a, r, g, b) = (255, 255, 154, 139)
    }
    self.init(
      .sRGB,
      red: Double(r) / 255,
      green: Double(g) / 255,
      blue: Double(b) / 255,
      opacity: Double(a) / 255
    )
  }
}

private struct WidgetContainerBackgroundModifier: ViewModifier {
  let name: String
  let props: [String: Any]?

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
    if let hexList = props?["gradientColors"] as? [String], hexList.count >= 2 {
      return LinearGradient(
        colors: [Color(hex: hexList[0]), Color(hex: hexList[1])],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
    }
    return LinearGradient(
      colors: name == "StreakWidget"
        ? [Color(hex: "#FF416C"), Color(hex: "#FF4B2B")]
        : [Color(hex: "#FF9A8B"), Color(hex: "#FF6A88")],
      startPoint: .topLeading,
      endPoint: .bottomTrailing
    )
  }
}
`;

  fs.writeFileSync(filePath, newEntryViewCode, 'utf8');
  log(`Patched EntryView.swift with native dynamic widgets + theme colors in: ${filePath}`);
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

// 4. Patch WidgetObject.swift
function patchWidgetObject(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('__expo_widgets_latest_props')) {
    log(`WidgetObject already patched: ${filePath}`);
    return;
  }

  const newWidgetObject = `import ExpoModulesCore
import WidgetKit

final class WidgetObject: SharedObject {
  let name: String
  init(name: String, layout: String) {
    self.name = name
    WidgetsStorage.set(layout, forKey: "__expo_widgets_\\(name)_layout")
  }

  func reload() {
    WidgetCenter.shared.reloadTimelines(ofKind: name)
    WidgetCenter.shared.reloadAllTimelines()
  }

  func updateTimeline(entries: [WidgetsJSTimelineEntry]) throws {
    if WidgetsStorage.getString(forKey: "__expo_widgets_\\(name)_layout") == nil {
      WidgetsStorage.set("() => null", forKey: "__expo_widgets_\\(name)_layout")
    }
    WidgetsStorage.set(entries.map { $0.toDictionary() }, forKey: "__expo_widgets_\\(name)_timeline")
    if let first = entries.first {
      WidgetsStorage.set(first.props, forKey: "__expo_widgets_\\(name)_props")
      WidgetsStorage.set(first.props, forKey: "__expo_widgets_latest_props")
    }
    self.reload()
  }

  func getTimeline() throws -> [WidgetsJSTimelineEntry] {
    guard let entries = WidgetsStorage.getArray(forKey: "__expo_widgets_\\(name)_timeline") as? [[String: Any]],
          let appContext else {
      return []
    }
    return try entries.map { try WidgetsJSTimelineEntry(from: $0, appContext: appContext) }
  }
}
`;
  fs.writeFileSync(filePath, newWidgetObject, 'utf8');
  log(`Patched WidgetObject.swift in: ${filePath}`);
}

// 5. Patch WidgetsStorage.swift
function patchWidgetsStorage(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('UserDefaults.standard') && content.includes('group.com.pixelthings.nousdeuxapp')) {
    log(`WidgetsStorage already patched: ${filePath}`);
    return;
  }

  const newWidgetsStorage = `import Foundation

public enum WidgetsStorage {
  public static var appGroupIdentifier: String? = (Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String) ?? "group.com.pixelthings.nousdeuxapp"
  static let defaults = UserDefaults(suiteName: appGroupIdentifier)

  static var sharedContainerURL: URL? {
    guard let appGroupIdentifier else { return nil }
    return FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: appGroupIdentifier)
  }

  static func set(_ value: [String: Any], forKey key: String) {
    defaults?.set(value, forKey: key)
    UserDefaults.standard.set(value, forKey: key)
    if let containerURL = sharedContainerURL {
      let file = containerURL.appendingPathComponent("\\(key).json")
      if let data = try? JSONSerialization.data(withJSONObject: value, options: []) {
        try? data.write(to: file)
      }
    }
  }

  static func set(_ value: [[String: Any]], forKey key: String) {
    defaults?.set(value, forKey: key)
    UserDefaults.standard.set(value, forKey: key)
    if let containerURL = sharedContainerURL {
      let file = containerURL.appendingPathComponent("\\(key).json")
      if let data = try? JSONSerialization.data(withJSONObject: value, options: []) {
        try? data.write(to: file)
      }
    }
  }

  static func set(_ value: String, forKey key: String) {
    defaults?.set(value, forKey: key)
    UserDefaults.standard.set(value, forKey: key)
    if let containerURL = sharedContainerURL {
      let file = containerURL.appendingPathComponent("\\(key).txt")
      try? value.write(to: file, atomically: true, encoding: .utf8)
    }
  }

  static func set(_ value: Data, forKey key: String) {
    defaults?.set(value, forKey: key)
    UserDefaults.standard.set(value, forKey: key)
    if let containerURL = sharedContainerURL {
      let file = containerURL.appendingPathComponent("\\(key).bin")
      try? value.write(to: file)
    }
  }

  public static func getDictionary(forKey key: String) -> [String: Any]? {
    if let dict = defaults?.dictionary(forKey: key) {
      return dict
    }
    if let dict = UserDefaults.standard.dictionary(forKey: key) {
      return dict
    }
    if let containerURL = sharedContainerURL {
      let file = containerURL.appendingPathComponent("\\(key).json")
      if let data = try? Data(contentsOf: file),
         let dict = try? JSONSerialization.jsonObject(with: data, options: []) as? [String: Any] {
        return dict
      }
    }
    return nil
  }

  public static func getArray(forKey key: String) -> [Any]? {
    if let arr = defaults?.array(forKey: key) {
      return arr
    }
    if let arr = UserDefaults.standard.array(forKey: key) {
      return arr
    }
    if let containerURL = sharedContainerURL {
      let file = containerURL.appendingPathComponent("\\(key).json")
      if let data = try? Data(contentsOf: file),
         let arr = try? JSONSerialization.jsonObject(with: data, options: []) as? [Any] {
        return arr
      }
    }
    return nil
  }

  public static func getData(forKey key: String) -> Data? {
    if let data = defaults?.data(forKey: key) {
      return data
    }
    if let data = UserDefaults.standard.data(forKey: key) {
      return data
    }
    if let containerURL = sharedContainerURL {
      let file = containerURL.appendingPathComponent("\\(key).bin")
      if let data = try? Data(contentsOf: file) {
        return data
      }
    }
    return nil
  }

  public static func getString(forKey key: String) -> String? {
    if let str = defaults?.string(forKey: key) {
      return str
    }
    if let str = UserDefaults.standard.string(forKey: key) {
      return str
    }
    if let containerURL = sharedContainerURL {
      let file = containerURL.appendingPathComponent("\\(key).txt")
      if let str = try? String(contentsOf: file, encoding: .utf8) {
        return str
      }
    }
    return nil
  }

  static func removeObject(forKey key: String) {
    defaults?.removeObject(forKey: key)
    UserDefaults.standard.removeObject(forKey: key)
    if let containerURL = sharedContainerURL {
      let f1 = containerURL.appendingPathComponent("\\(key).json")
      let f2 = containerURL.appendingPathComponent("\\(key).txt")
      let f3 = containerURL.appendingPathComponent("\\(key).bin")
      try? FileManager.default.removeItem(at: f1)
      try? FileManager.default.removeItem(at: f2)
      try? FileManager.default.removeItem(at: f3)
    }
  }
}
`;
  fs.writeFileSync(filePath, newWidgetsStorage, 'utf8');
  log(`Patched WidgetsStorage.swift in: ${filePath}`);
}

// 6. Patch withWidgetSourceFiles.js generator
function patchWithWidgetSourceFiles(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  // Idempotency check: if already patched with widgetURL and no duplicates, do not patch again
  const bgCount = (content.match(/const bgGradient =/g) || []).length;
  if (bgCount === 1 && content.includes('.containerBackground(for: .widget)') && content.includes('.widgetURL')) {
    log(`withWidgetSourceFiles.js already patched with widgetURL: ${filePath}`);
    return;
  }

  // Clean up any duplicated bgGradient declarations if previously corrupted
  if (bgCount > 1) {
    while ((content.match(/const bgGradient =/g) || []).length > 1) {
      content = content.replace(/const bgGradient = widget\.name === "StreakWidget"[\s\S]*?;\s*(?=const bgGradient =)/, '');
    }
    fs.writeFileSync(filePath, content, 'utf8');
    log(`Cleaned up duplicate bgGradient declarations in: ${filePath}`);
    if (content.includes('.widgetURL')) return;
  }

  // Match the if (!configuration) block inside widgetSwift
  const configBlockPattern = /if \(!configuration\)\s*return `import WidgetKit[\s\S]*?supportedFamilies[\s\S]*?`\s*;/;

  const newSnippet = `const bgGradient = widget.name === "StreakWidget"
      ? "LinearGradient(colors: [Color(red: 1.0, green: 0.29, blue: 0.17), Color(red: 0.95, green: 0.15, blue: 0.07)], startPoint: .topLeading, endPoint: .bottomTrailing)"
      : "LinearGradient(colors: [Color(red: 1.0, green: 0.42, blue: 0.53), Color(red: 1.0, green: 0.29, blue: 0.17)], startPoint: .topLeading, endPoint: .bottomTrailing)";
    const widgetDeepLink = widget.name === "StreakWidget" ? "nousdeuxapp://dashboard" : "nousdeuxapp://daylink";

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
          .widgetURL(URL(string: "\${widgetDeepLink}"))
          .containerBackground(for: .widget) {
            \${bgGradient}
          }
      } else {
        WidgetsEntryView(entry: entry)
          .widgetURL(URL(string: "\${widgetDeepLink}"))
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

// 7. Patch generated Swift widgets in target directory
function patchSwiftTargetFile(filePath, bgSwiftGradient, widgetDeepLink) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('containerBackground(for: .widget)') && content.includes('.widgetURL')) {
    log(`Swift widget source already has containerBackground and widgetURL: ${filePath}`);
    return;
  }

  // Replace any existing WidgetsEntryView(entry: entry) or partial containerBackground
  const blockPattern = /StaticConfiguration\(kind: name, provider: WidgetsTimelineProvider\(name: name\)\)\s*\{[\s\S]*?WidgetsEntryView\(entry: entry\)[\s\S]*?\}/g;
  const replacement = `StaticConfiguration(kind: name, provider: WidgetsTimelineProvider(name: name)) { entry in
      if #available(iOS 17.0, *) {
        WidgetsEntryView(entry: entry)
          .widgetURL(URL(string: "${widgetDeepLink}"))
          .containerBackground(for: .widget) {
            ${bgSwiftGradient}
          }
      } else {
        WidgetsEntryView(entry: entry)
          .widgetURL(URL(string: "${widgetDeepLink}"))
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

// 8. Patch withAppGroupEntitlements.js
function patchWithAppGroupEntitlements(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('config.modResults = _addApplicationGroupsEntitlement')) {
    log(`withAppGroupEntitlements.js already patched: ${filePath}`);
    return;
  }
  content = content.replace(
    /config\.ios = \{/g,
    `config.modResults = _addApplicationGroupsEntitlement(config.modResults ?? {}, props.groupIdentifier);\n    config.ios = {`
  );
  fs.writeFileSync(filePath, content, 'utf8');
  log(`Patched withAppGroupEntitlements.js in: ${filePath}`);
}

// 9. Patch WidgetsModule.swift
function patchWidgetsModule(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes('Function("updateWidgetProps")')) {
    log(`WidgetsModule.swift already has updateWidgetProps: ${filePath}`);
    return;
  }
  const target = 'Function("reloadAllWidgets") {\n      WidgetCenter.shared.reloadAllTimelines()\n    }';
  const replacement = `${target}\n\n    Function("updateWidgetProps") { (name: String, props: [String: Any]) in\n      WidgetsStorage.set(props, forKey: "__expo_widgets_\\(name)_props")\n      WidgetsStorage.set(props, forKey: "__expo_widgets_latest_props")\n      WidgetCenter.shared.reloadTimelines(ofKind: name)\n      WidgetCenter.shared.reloadAllTimelines()\n    }`;
  if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync(filePath, content, 'utf8');
    log(`Patched WidgetsModule.swift with updateWidgetProps in: ${filePath}`);
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
  patchWidgetObject(path.join(expoWidgetsIos, 'WidgetObject.swift'));
  patchWidgetsStorage(path.join(expoWidgetsIos, 'WidgetsStorage.swift'));
  patchWidgetsModule(path.join(expoWidgetsIos, 'WidgetsModule.swift'));

  // 2. node_modules/expo-widgets/plugin/build/ios/
  const withWidgetSourceFilesPath = path.join(
    rootDir,
    'node_modules/expo-widgets/plugin/build/ios/withWidgetSourceFiles.js'
  );
  patchWithWidgetSourceFiles(withWidgetSourceFilesPath);

  const withAppGroupEntitlementsPath = path.join(
    rootDir,
    'node_modules/expo-widgets/plugin/build/ios/withAppGroupEntitlements.js'
  );
  patchWithAppGroupEntitlements(withAppGroupEntitlementsPath);

  // 3. ios/ExpoWidgetsTarget (if prebuild has run)
  const targetDir = path.join(rootDir, 'ios/ExpoWidgetsTarget');
  patchSwiftTargetFile(
    path.join(targetDir, 'QuestionWidget.swift'),
    'LinearGradient(colors: [Color(red: 1.0, green: 0.42, blue: 0.53), Color(red: 1.0, green: 0.29, blue: 0.17)], startPoint: .topLeading, endPoint: .bottomTrailing)',
    'nousdeuxapp://daylink'
  );
  patchSwiftTargetFile(
    path.join(targetDir, 'StreakWidget.swift'),
    'LinearGradient(colors: [Color(red: 1.0, green: 0.29, blue: 0.17), Color(red: 0.95, green: 0.15, blue: 0.07)], startPoint: .topLeading, endPoint: .bottomTrailing)',
    'nousdeuxapp://dashboard'
  );

  // 4. ios/Pods/ExpoWidgets/ (if pod install has run)
  const podsExpoWidgets = path.join(rootDir, 'ios/Pods/ExpoWidgets');
  patchTimelineProvider(path.join(podsExpoWidgets, 'Widgets/TimelineProvider.swift'));
  patchEntryView(path.join(podsExpoWidgets, 'Widgets/EntryView.swift'));
  patchDynamicView(path.join(podsExpoWidgets, 'Widgets/DynamicView.swift'));
  patchWidgetObject(path.join(podsExpoWidgets, 'WidgetObject.swift'));
  patchWidgetsStorage(path.join(podsExpoWidgets, 'WidgetsStorage.swift'));
  patchWidgetsModule(path.join(podsExpoWidgets, 'WidgetsModule.swift'));

  log('iOS widgets patch completed successfully.');
}

run();
