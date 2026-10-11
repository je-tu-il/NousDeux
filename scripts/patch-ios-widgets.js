/**
 * scripts/patch-ios-widgets.js
 *
 * Comprehensive patch for iOS 17+ WidgetKit and native widget data sync in expo-widgets.
 * Aligned with TelDump instantaneous refresh & resilient App Group architecture:
 * 1. Dynamic App Group resolver with mobileprovision check, Info.plist check, and containerURL verification.
 * 2. Synchronous dual-layer persistence (UserDefaults.synchronize() + Atomic JSON snapshots on shared disk container).
 * 3. WidgetsTimelineProvider returns fresh storedProps with policy: .atEnd for immediate WidgetKit invalidation.
 * 4. WidgetsModule exposes updateWidgetData(jsonPayload), updateWidgetProps(name, props), and reloads specific timelines immediately.
 * 5. EntryView.swift renders real dynamic data (Streak, Question of the day, Partner answer status) and deep links.
 * 6. DynamicView.swift never collapses RedBox to EmptyView in release builds.
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

  if (content.includes('WidgetsStorage.getProps(forWidget: name)') && content.includes('policy: .atEnd')) {
    log(`TimelineProvider already up to date: ${filePath}`);
    return;
  }

  const newTimelineProvider = `import WidgetKit

public struct WidgetsTimelineProvider: TimelineProvider {
  public func placeholder(in context: Context) -> WidgetsTimelineEntry {
    let storedProps = WidgetsStorage.getProps(forWidget: name)
    return WidgetsTimelineEntry(date: Date(), name: name, props: storedProps, entryIndex: nil)
  }

  public func getSnapshot(
    in context: Context, completion: @escaping @Sendable (WidgetsTimelineEntry) -> Void
  ) {
    let storedProps = WidgetsStorage.getProps(forWidget: name)
    completion(WidgetsTimelineEntry(date: Date(), name: name, props: storedProps, entryIndex: nil))
  }

  public func getTimeline(
    in context: Context,
    completion: @escaping @Sendable (Timeline<WidgetsTimelineEntry>) -> Void
  ) {
    let storedProps = WidgetsStorage.getProps(forWidget: name)
    let entry = WidgetsTimelineEntry(date: Date(), name: name, props: storedProps, entryIndex: nil)
    let timeline = Timeline<WidgetsTimelineEntry>(entries: [entry], policy: .atEnd)
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
  log(`Patched TimelineProvider with getProps & instant .atEnd policy in: ${filePath}`);
}

// 2. Patch EntryView.swift
function patchEntryView(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('WidgetsStorage.getProps(forWidget: entry.name)') && content.includes('compactMap')) {
    log(`EntryView already up to date: ${filePath}`);
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
    return WidgetsStorage.getProps(forWidget: entry.name)
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
    let hexList: [String] = {
      if let list = props?["gradientColors"] as? [String] { return list }
      if let list = props?["gradientColors"] as? [Any] { return list.compactMap { $0 as? String } }
      return []
    }()
    if hexList.count >= 2 {
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
  log(`Patched EntryView.swift with getProps & safe theme color casting in: ${filePath}`);
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

  if (content.includes('WidgetsStorage.save(props: first.props, forWidget: name)')) {
    log(`WidgetObject already up to date: ${filePath}`);
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
      WidgetsStorage.save(props: first.props, forWidget: name)
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

// 5. Patch WidgetsStorage.swift (TelDump App Group architecture)
function patchWidgetsStorage(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('AppGroupHelper') && content.includes('getProps(forWidget')) {
    log(`WidgetsStorage already up to date: ${filePath}`);
    return;
  }

  const newWidgetsStorage = `import Foundation

// MARK: - Résolveur dynamique d'App Group (Identique à TelDump)
public enum AppGroupHelper {
  public static let fallbackIdentifier = "group.com.pixelthings.nousdeuxapp"
  public static let alternativeIdentifier = "group.com.pixelthings.nousdeux"

  public static var activeIdentifier: String {
    if FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: fallbackIdentifier) != nil {
      return fallbackIdentifier
    }
    if FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: alternativeIdentifier) != nil {
      return alternativeIdentifier
    }
    if let provisionURL = Bundle.main.url(forResource: "embedded", withExtension: "mobileprovision"),
       let content = try? String(contentsOf: provisionURL, encoding: .isoLatin1) {
      let pattern = #"<string>(group\\.[^<]+)</string>"#
      if let regex = try? NSRegularExpression(pattern: pattern) {
        let matches = regex.matches(in: content, range: NSRange(content.startIndex..., in: content))
        for match in matches {
          if let range = Range(match.range(at: 1), in: content) {
            let candidate = String(content[range])
            if FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: candidate) != nil {
              return candidate
            }
          }
        }
      }
    }
    if let infoPlistId = Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String,
       !infoPlistId.isEmpty,
       FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: infoPlistId) != nil {
      return infoPlistId
    }
    return fallbackIdentifier
  }

  public static var containerURL: URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: activeIdentifier)
  }

  public static var sharedDefaults: UserDefaults? {
    UserDefaults(suiteName: activeIdentifier)
  }
}

public enum WidgetsStorage {
  public static var appGroupIdentifier: String? {
    AppGroupHelper.activeIdentifier
  }

  public static var sharedDefaults: UserDefaults? {
    AppGroupHelper.sharedDefaults
  }

  public static var sharedContainerURL: URL? {
    AppGroupHelper.containerURL
  }

  public static func save(props: [String: Any], forWidget widgetName: String?) {
    let name = widgetName ?? "QuestionWidget"

    // 1. Sauvegarde UserDefaults App Group
    if let defaults = sharedDefaults {
      defaults.set(props, forKey: "__expo_widgets_\\(name)_props")
      defaults.set(props, forKey: "__expo_widgets_latest_props")
      let timelineEntry: [String: Any] = [
        "timestamp": Int(Date().timeIntervalSince1970 * 1000),
        "props": props
      ]
      defaults.set([timelineEntry], forKey: "__expo_widgets_\\(name)_timeline")
      defaults.synchronize()
    }

    // 2. Sauvegarde atomique dans le fichier JSON partagé sur disque (comme TelDump)
    if let containerURL = sharedContainerURL {
      let fileURL = containerURL.appendingPathComponent("nousdeux_widget_\\(name).json")
      let latestURL = containerURL.appendingPathComponent("nousdeux_widget_latest.json")
      let genericURL = containerURL.appendingPathComponent("__expo_widgets_\\(name)_props.json")
      if let data = try? JSONSerialization.data(withJSONObject: props, options: []) {
        try? data.write(to: fileURL, options: .atomic)
        try? data.write(to: latestURL, options: .atomic)
        try? data.write(to: genericURL, options: .atomic)
      }
    }

    // 3. Sauvegarde secours standard
    UserDefaults.standard.set(props, forKey: "__expo_widgets_\\(name)_props")
    UserDefaults.standard.set(props, forKey: "__expo_widgets_latest_props")
    UserDefaults.standard.synchronize()
  }

  public static func getProps(forWidget name: String) -> [String: Any]? {
    // 1. Essai depuis App Group UserDefaults
    if let defaults = sharedDefaults {
      if let dict = defaults.dictionary(forKey: "__expo_widgets_\\(name)_props"), !dict.isEmpty {
        return dict
      }
      if let dict = defaults.dictionary(forKey: "__expo_widgets_latest_props"), !dict.isEmpty {
        return dict
      }
    }

    // 2. Essai de secours: Fichier JSON partagé sur disque
    if let containerURL = sharedContainerURL {
      let fileURL = containerURL.appendingPathComponent("nousdeux_widget_\\(name).json")
      let latestURL = containerURL.appendingPathComponent("nousdeux_widget_latest.json")
      let genericURL = containerURL.appendingPathComponent("__expo_widgets_\\(name)_props.json")
      for url in [fileURL, latestURL, genericURL] {
        if let data = try? Data(contentsOf: url),
           let dict = (try? JSONSerialization.jsonObject(with: data, options: [])) as? [String: Any],
           !dict.isEmpty {
          return dict
        }
      }
    }

    // 3. Essai de secours: UserDefaults standard
    if let dict = UserDefaults.standard.dictionary(forKey: "__expo_widgets_\\(name)_props"), !dict.isEmpty {
      return dict
    }
    if let dict = UserDefaults.standard.dictionary(forKey: "__expo_widgets_latest_props"), !dict.isEmpty {
      return dict
    }

    return nil
  }

  public static func set(_ value: [String: Any], forKey key: String) {
    sharedDefaults?.set(value, forKey: key)
    sharedDefaults?.synchronize()
    UserDefaults.standard.set(value, forKey: key)
    UserDefaults.standard.synchronize()
    if let containerURL = sharedContainerURL {
      let file = containerURL.appendingPathComponent("\\(key).json")
      if let data = try? JSONSerialization.data(withJSONObject: value, options: []) {
        try? data.write(to: file, options: .atomic)
      }
    }
  }

  public static func set(_ value: [[String: Any]], forKey key: String) {
    sharedDefaults?.set(value, forKey: key)
    sharedDefaults?.synchronize()
    UserDefaults.standard.set(value, forKey: key)
    UserDefaults.standard.synchronize()
    if let containerURL = sharedContainerURL {
      let file = containerURL.appendingPathComponent("\\(key).json")
      if let data = try? JSONSerialization.data(withJSONObject: value, options: []) {
        try? data.write(to: file, options: .atomic)
      }
    }
  }

  public static func set(_ value: String, forKey key: String) {
    sharedDefaults?.set(value, forKey: key)
    sharedDefaults?.synchronize()
    UserDefaults.standard.set(value, forKey: key)
    UserDefaults.standard.synchronize()
    if let containerURL = sharedContainerURL {
      let file = containerURL.appendingPathComponent("\\(key).txt")
      try? value.write(to: file, atomically: true, encoding: .utf8)
    }
  }

  public static func set(_ value: Data, forKey key: String) {
    sharedDefaults?.set(value, forKey: key)
    sharedDefaults?.synchronize()
    UserDefaults.standard.set(value, forKey: key)
    UserDefaults.standard.synchronize()
    if let containerURL = sharedContainerURL {
      let file = containerURL.appendingPathComponent("\\(key).bin")
      try? value.write(to: file, options: .atomic)
    }
  }

  public static func getDictionary(forKey key: String) -> [String: Any]? {
    if let dict = sharedDefaults?.dictionary(forKey: key), !dict.isEmpty {
      return dict
    }
    if let containerURL = sharedContainerURL {
      let file = containerURL.appendingPathComponent("\\(key).json")
      if let data = try? Data(contentsOf: file),
         let dict = (try? JSONSerialization.jsonObject(with: data, options: [])) as? [String: Any],
         !dict.isEmpty {
        return dict
      }
    }
    if let dict = UserDefaults.standard.dictionary(forKey: key), !dict.isEmpty {
      return dict
    }
    return nil
  }

  public static func getArray(forKey key: String) -> [Any]? {
    if let arr = sharedDefaults?.array(forKey: key), !arr.isEmpty {
      return arr
    }
    if let containerURL = sharedContainerURL {
      let file = containerURL.appendingPathComponent("\\(key).json")
      if let data = try? Data(contentsOf: file),
         let arr = (try? JSONSerialization.jsonObject(with: data, options: [])) as? [Any],
         !arr.isEmpty {
        return arr
      }
    }
    if let arr = UserDefaults.standard.array(forKey: key), !arr.isEmpty {
      return arr
    }
    return nil
  }

  public static func getData(forKey key: String) -> Data? {
    if let data = sharedDefaults?.data(forKey: key) {
      return data
    }
    if let containerURL = sharedContainerURL {
      let file = containerURL.appendingPathComponent("\\(key).bin")
      if let data = try? Data(contentsOf: file) {
        return data
      }
    }
    if let data = UserDefaults.standard.data(forKey: key) {
      return data
    }
    return nil
  }

  public static func getString(forKey key: String) -> String? {
    if let str = sharedDefaults?.string(forKey: key) {
      return str
    }
    if let containerURL = sharedContainerURL {
      let file = containerURL.appendingPathComponent("\\(key).txt")
      if let str = try? String(contentsOf: file, encoding: .utf8) {
        return str
      }
    }
    if let str = UserDefaults.standard.string(forKey: key) {
      return str
    }
    return nil
  }

  public static func removeObject(forKey key: String) {
    sharedDefaults?.removeObject(forKey: key)
    sharedDefaults?.synchronize()
    UserDefaults.standard.removeObject(forKey: key)
    UserDefaults.standard.synchronize()
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
  log(`Patched WidgetsStorage.swift with TelDump App Group & atomic JSON storage in: ${filePath}`);
}

// 6. Patch withWidgetSourceFiles.js generator
function patchWithWidgetSourceFiles(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  const bgCount = (content.match(/const bgGradient =/g) || []).length;
  if (bgCount === 1 && content.includes('.containerBackground(for: .widget)') && content.includes('.widgetURL')) {
    log(`withWidgetSourceFiles.js already patched with widgetURL: ${filePath}`);
    return;
  }

  if (bgCount > 1) {
    while ((content.match(/const bgGradient =/g) || []).length > 1) {
      content = content.replace(/const bgGradient = widget\.name === "StreakWidget"[\s\S]*?;\s*(?=const bgGradient =)/, '');
    }
    fs.writeFileSync(filePath, content, 'utf8');
    log(`Cleaned up duplicate bgGradient declarations in: ${filePath}`);
    if (content.includes('.widgetURL')) return;
  }

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

  if (content.includes('Function("updateWidgetData")') && content.includes('WidgetsStorage.save')) {
    log(`WidgetsModule.swift already up to date: ${filePath}`);
    return;
  }

  // Rewrite reloadAllWidgets and inject updateWidgetProps & updateWidgetData
  const reloadPattern = /Function\("reloadAllWidgets"\)\s*\{[\s\S]*?WidgetCenter\.shared\.reloadAllTimelines\(\)[\s\S]*?\}/;
  const newFunctions = `Function("reloadAllWidgets") {
      WidgetCenter.shared.reloadAllTimelines()
      WidgetCenter.shared.reloadTimelines(ofKind: "QuestionWidget")
      WidgetCenter.shared.reloadTimelines(ofKind: "StreakWidget")
    }

    Function("updateWidgetProps") { (name: String, props: [String: Any]) in
      WidgetsStorage.save(props: props, forWidget: name)
      WidgetCenter.shared.reloadTimelines(ofKind: name)
      WidgetCenter.shared.reloadAllTimelines()
    }

    Function("updateWidgetData") { (jsonPayload: String) -> Bool in
      if let data = jsonPayload.data(using: .utf8),
         let dict = (try? JSONSerialization.jsonObject(with: data, options: [])) as? [String: Any] {
        WidgetsStorage.save(props: dict, forWidget: "QuestionWidget")
        WidgetsStorage.save(props: dict, forWidget: "StreakWidget")
        WidgetCenter.shared.reloadTimelines(ofKind: "QuestionWidget")
        WidgetCenter.shared.reloadTimelines(ofKind: "StreakWidget")
        WidgetCenter.shared.reloadAllTimelines()
        return true
      }
      return false
    }`;

  if (reloadPattern.test(content)) {
    content = content.replace(reloadPattern, newFunctions);
    // Clean up any previously appended updateWidgetProps if present outside reloadAllWidgets
    content = content.replace(/\n\s*Function\("updateWidgetProps"\)\s*\{\s*\(name:\s*String,\s*props:\s*\[String:\s*Any\]\)[\s\S]*?WidgetCenter\.shared\.reloadAllTimelines\(\)\s*\}/g, '');
    fs.writeFileSync(filePath, content, 'utf8');
    log(`Patched WidgetsModule.swift with updateWidgetProps & updateWidgetData: ${filePath}`);
  } else {
    log(`Could not find Function("reloadAllWidgets") in WidgetsModule.swift`);
  }
}

function patchAndroidWidgetsModule(filePath) {
  if (!fs.existsSync(filePath)) return;
  let content = fs.readFileSync(filePath, 'utf8');

  if (content.includes('updateWidgetProps') && content.includes('updateWidgetData')) {
    log(`Android WidgetsModule already patched: ${filePath}`);
    return;
  }

  const newAndroidWidgetsModule = `package expo.modules.widgets

import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONObject

class WidgetsModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ExpoWidgets")

    AsyncFunction("updateWidgetProps") { widgetName: String, props: Map<String, Any?> ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val prefs = context.getSharedPreferences("nousdeux_widgets", Context.MODE_PRIVATE)
      val json = JSONObject(props)
      val jsonStr = json.toString()
      prefs.edit()
        .putString("widget_payload", jsonStr)
        .putString("widget_payload_$widgetName", jsonStr)
        .apply()

      updateAllNativeWidgets(context)
      true
    }

    AsyncFunction("updateWidgetData") { jsonPayload: String ->
      val context = appContext.reactContext ?: return@AsyncFunction false
      val prefs = context.getSharedPreferences("nousdeux_widgets", Context.MODE_PRIVATE)
      prefs.edit().putString("widget_payload", jsonPayload).apply()

      updateAllNativeWidgets(context)
      true
    }

    AsyncFunction("reloadAllWidgets") {
      val context = appContext.reactContext ?: return@AsyncFunction false
      updateAllNativeWidgets(context)
      true
    }

    AsyncFunction("isPinSupported") {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val context = appContext.reactContext ?: return@AsyncFunction false
        val appWidgetManager = AppWidgetManager.getInstance(context)
        appWidgetManager.isRequestPinAppWidgetSupported
      } else {
        false
      }
    }

    AsyncFunction("requestPinWidget") { widgetType: String ->
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        val context = appContext.reactContext ?: return@AsyncFunction false
        val appWidgetManager = AppWidgetManager.getInstance(context)
        if (!appWidgetManager.isRequestPinAppWidgetSupported) {
          return@AsyncFunction false
        }
        val targetClass = if (widgetType == "streak" || widgetType == "StreakWidget") {
          "com.pixelthings.nousdeux.StreakWidgetProvider"
        } else {
          "com.pixelthings.nousdeux.QuestionWidgetProvider"
        }
        val myProvider = ComponentName(context, targetClass)
        appWidgetManager.requestPinAppWidget(myProvider, null, null)
      } else {
        false
      }
    }
  }

  private fun updateAllNativeWidgets(context: Context) {
    try {
      val appWidgetManager = AppWidgetManager.getInstance(context)

      try {
        val qClass = Class.forName("com.pixelthings.nousdeux.QuestionWidgetProvider")
        val qIds = appWidgetManager.getAppWidgetIds(ComponentName(context, qClass))
        if (qIds != null && qIds.isNotEmpty()) {
          val provider = qClass.getDeclaredConstructor().newInstance()
          val onUpdate = qClass.getMethod("onUpdate", Context::class.java, AppWidgetManager::class.java, IntArray::class.java)
          onUpdate.invoke(provider, context, appWidgetManager, qIds)

          val intent = Intent(context, qClass).apply {
            action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, qIds)
          }
          context.sendBroadcast(intent)
        }
      } catch (e: Throwable) {
        android.util.Log.w("ExpoWidgets", "Failed to update QuestionWidgetProvider: " + e.message)
      }

      try {
        val sClass = Class.forName("com.pixelthings.nousdeux.StreakWidgetProvider")
        val sIds = appWidgetManager.getAppWidgetIds(ComponentName(context, sClass))
        if (sIds != null && sIds.isNotEmpty()) {
          val provider = sClass.getDeclaredConstructor().newInstance()
          val onUpdate = sClass.getMethod("onUpdate", Context::class.java, AppWidgetManager::class.java, IntArray::class.java)
          onUpdate.invoke(provider, context, appWidgetManager, sIds)

          val intent = Intent(context, sClass).apply {
            action = AppWidgetManager.ACTION_APPWIDGET_UPDATE
            putExtra(AppWidgetManager.EXTRA_APPWIDGET_IDS, sIds)
          }
          context.sendBroadcast(intent)
        }
      } catch (e: Throwable) {
        android.util.Log.w("ExpoWidgets", "Failed to update StreakWidgetProvider: " + e.message)
      }
    } catch (e: Throwable) {
      android.util.Log.w("ExpoWidgets", "updateAllNativeWidgets error: " + e.message)
    }
  }
}
`;

  fs.writeFileSync(filePath, newAndroidWidgetsModule, 'utf8');
  log(`Patched Android WidgetsModule.kt: ${filePath}`);
}

// Execute all patches
function run() {
  log('Starting iOS & Android widgets patch...');

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

  // 4. Android node_modules/expo-widgets/android/
  const expoWidgetsAndroid = path.join(rootDir, 'node_modules/expo-widgets/android/src/main/java/expo/modules/widgets');
  patchAndroidWidgetsModule(path.join(expoWidgetsAndroid, 'WidgetsModule.kt'));

  log('Native widgets patch (iOS & Android) completed successfully.');
}

run();
