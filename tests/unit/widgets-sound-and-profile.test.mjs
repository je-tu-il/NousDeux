import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFile(resolve(root, relativePath), 'utf8');

test('settings.tsx fixes Mon Profil visibility, contrast, and adds sound & widgets controls', async () => {
  const settingsSrc = await read('src/app/settings.tsx');

  // Verify Mon Profil is not inside an opacity: 0 FadeInUp wrapper
  assert.doesNotMatch(
    settingsSrc,
    /<Animated\.View[^>]*FadeInUp[^>]*>\s*<Text[^>]*>Mon Profil<\/Text>/,
    'Mon Profil must not be wrapped in an Animated.View FadeInUp that can glitch at opacity 0'
  );

  // Check profile fields
  assert.match(settingsSrc, /Mon Profil/, 'Mon Profil title must exist');
  assert.match(settingsSrc, /Appuie pour changer/, 'Photo change prompt must exist');
  assert.match(settingsSrc, /Pseudo/, 'Pseudo label must exist');
  assert.match(settingsSrc, /Âge/, 'Age label must exist');

  // Check SoundToggle and Widgets link
  assert.match(settingsSrc, /SoundToggle/, 'SoundToggle preference must be rendered');
  assert.match(settingsSrc, /href="\/widgets"/, 'Navigation link to /widgets must exist');
});

test('cosmetics and economy support widgets and inventory synchronization', async () => {
  const cosmeticsSrc = await read('src/data/cosmetics.ts');
  const economySrc = await read('src/lib/economy.ts');

  assert.match(cosmeticsSrc, /export const WIDGETS = COSMETICS\.filter/, 'WIDGETS export must be declared in cosmetics.ts');
  assert.match(cosmeticsSrc, /widget_default/, 'Default widget skin must exist');
  assert.match(cosmeticsSrc, /widget_streak_7/, 'Streak unlock widget skins must exist');
  assert.match(cosmeticsSrc, /widget_shop_1/, 'Purchasable widget skins must exist');

  assert.match(economySrc, /widgets\?: string\[\]/, 'InventoryData must include widgets optional field');
  assert.match(economySrc, /'widget'/, 'ItemType must include widget');
  assert.match(economySrc, /selectedWidget\?: string/, 'UserProfile must include selectedWidget');
});

test('shop.tsx provides dedicated widgets tab and equipment handler', async () => {
  const shopSrc = await read('src/app/shop.tsx');

  assert.match(shopSrc, /widgets:\s*WIDGETS/, 'TAB_DATA must include widgets tab');
  assert.match(shopSrc, /item\.type === 'widget'/, 'renderItemCard must support item.type === widget');
  assert.match(shopSrc, /updates\.selectedWidget = item\.id/, 'Shop must allow equipping widget skins');
  assert.match(shopSrc, /syncWidgetData/, 'Equipping must sync widget data for native home screen');
});

test('sound utility provides synthesized audio paired with haptic feedback', async () => {
  const soundSrc = await read('src/lib/sound.ts');

  assert.match(soundSrc, /export const sound = {/, 'sound export must exist');
  assert.match(soundSrc, /tap:/, 'sound.tap must be defined');
  assert.match(soundSrc, /pop:/, 'sound.pop must be defined');
  assert.match(soundSrc, /tick:/, 'sound.tick must be defined');
  assert.match(soundSrc, /coin:/, 'sound.coin must be defined');
  assert.match(soundSrc, /success:/, 'sound.success must be defined');
  assert.match(soundSrc, /reward:/, 'sound.reward must be defined');
  assert.match(soundSrc, /triggerHaptic/, 'sound must trigger haptics automatically');
});

test('AdaptiveWidget and widgets screen support Streak & Question formats across iOS and Samsung', async () => {
  const widgetComponentSrc = await read('src/components/AdaptiveWidget.tsx');
  const widgetScreenSrc = await read('src/app/widgets.tsx');

  // Verify component support
  assert.match(widgetComponentSrc, /StreakWidgetContent/, 'AdaptiveWidget must render streak widgets');
  assert.match(widgetComponentSrc, /QuestionWidgetContent/, 'AdaptiveWidget must render question widgets');
  assert.match(widgetComponentSrc, /sizeSmall/, 'AdaptiveWidget must support 1 case (small)');
  assert.match(widgetComponentSrc, /sizeMedium/, 'AdaptiveWidget must support rectangle (medium)');
  assert.match(widgetComponentSrc, /sizeLarge/, 'AdaptiveWidget must support 4 cases (large)');
  assert.match(widgetComponentSrc, /iosContainer/, 'AdaptiveWidget must support iOS styling');
  assert.match(widgetComponentSrc, /androidContainer/, 'AdaptiveWidget must support Samsung/Android styling');

  // Verify interactive simulator and guide
  assert.match(widgetScreenSrc, /AdaptiveWidget/, 'WidgetsScreen must embed AdaptiveWidget simulator');
  assert.match(widgetScreenSrc, /Sur iPhone \(iOS\)/, 'WidgetsScreen must include iOS install guide');
  assert.match(widgetScreenSrc, /Sur Samsung & Android/, 'WidgetsScreen must include Samsung/Android install guide');
});

test('app.json configures withAndroidWidgets Expo config plugin for APK generation', async () => {
  const appJsonSrc = await read('app.json');
  const pluginSrc = await read('plugins/withAndroidWidgets.js');
  const widgetsLibSrc = await read('src/lib/widgets.ts');
  const widgetsScreenSrc = await read('src/app/widgets.tsx');

  assert.match(appJsonSrc, /\.\/plugins\/withAndroidWidgets/, 'app.json plugins must register withAndroidWidgets');
  assert.match(pluginSrc, /QuestionWidgetProvider/, 'withAndroidWidgets must declare QuestionWidgetProvider');
  assert.match(pluginSrc, /StreakWidgetProvider/, 'withAndroidWidgets must declare StreakWidgetProvider');
  assert.match(pluginSrc, /withAndroidManifest/, 'withAndroidWidgets must inject receivers into manifest');
  assert.match(pluginSrc, /withStringsXml/, 'withAndroidWidgets must inject strings via withStringsXml');
  assert.match(pluginSrc, /previewLayout/, 'withAndroidWidgets must configure previewLayout for launcher drawers');
  assert.match(pluginSrc, /WidgetBridgeModule/, 'withAndroidWidgets must compile WidgetBridgeModule');

  // Verify JS library and screen support for pinning
  assert.match(widgetsLibSrc, /export async function requestPinWidget/, 'widgets.ts must export requestPinWidget');
  assert.match(widgetsLibSrc, /export async function isWidgetPinSupported/, 'widgets.ts must export isWidgetPinSupported');
  assert.match(widgetsScreenSrc, /handlePinWidget/, 'WidgetsScreen must implement handlePinWidget');
  assert.match(widgetsScreenSrc, /Épingler à l’écran d’accueil/, 'WidgetsScreen must provide button to pin widget');
});

test('app.json and widgets/ configure iOS WidgetKit extension via expo-widgets', async () => {
  const appJsonSrc = await read('app.json');
  const questionWidgetSrc = await read('src/widgets/QuestionWidget.tsx');
  const streakWidgetSrc = await read('src/widgets/StreakWidget.tsx');
  const widgetsLibSrc = await read('src/lib/widgets.ts');
  const workflowSrc = await read('.github/workflows/build-ios.yml');

  assert.match(appJsonSrc, /expo-widgets/, 'app.json must include expo-widgets plugin');
  assert.match(appJsonSrc, /group\.com\.pixelthings\.nousdeuxapp/, 'app.json must configure groupIdentifier for App Group sharing');
  assert.match(appJsonSrc, /QuestionWidget/, 'app.json must declare QuestionWidget');
  assert.match(appJsonSrc, /StreakWidget/, 'app.json must declare StreakWidget');

  assert.match(appJsonSrc, /"name":\s*"NousDeux"/, 'app.json must set app name to NousDeux');
  assert.match(appJsonSrc, /contentMarginsDisabled/, 'app.json must enable contentMarginsDisabled for iOS widgets');
  assert.match(appJsonSrc, /\.\/plugins\/withIosWidgets/, 'app.json must register withIosWidgets plugin');

  assert.match(questionWidgetSrc, /createWidget\('QuestionWidget'/, 'QuestionWidget.tsx must create QuestionWidget');
  assert.match(streakWidgetSrc, /createWidget\('StreakWidget'/, 'StreakWidget.tsx must create StreakWidget');
  assert.match(questionWidgetSrc, /containerBackground\(/, 'QuestionWidget must adopt containerBackground API for iOS 17');
  assert.match(streakWidgetSrc, /containerBackground\(/, 'StreakWidget must adopt containerBackground API for iOS 17');

  assert.match(widgetsLibSrc, /QuestionWidget\.updateSnapshot/, 'widgets.ts must update QuestionWidget snapshot on iOS');
  assert.match(widgetsLibSrc, /StreakWidget\.updateSnapshot/, 'widgets.ts must update StreakWidget snapshot on iOS');

  assert.match(workflowSrc, /PlugIns/, 'build-ios workflow must verify embedded PlugIns in IPA');
  assert.match(workflowSrc, /WORKSPACE=/, 'build-ios workflow must resolve workspace dynamically');
});

test('iOS and Android widget plugins configure native containerBackground and deduplicate strings', async () => {
  const iosPluginSrc = await read('plugins/withIosWidgets.js');
  const androidPluginSrc = await read('plugins/withAndroidWidgets.js');
  const stringsXmlSrc = await read('android/app/src/main/res/values/strings.xml');

  // iOS plugin must inject containerBackground
  assert.match(iosPluginSrc, /containerBackground/, 'withIosWidgets must handle containerBackground');
  assert.match(iosPluginSrc, /ExpoWidgetsTarget/, 'withIosWidgets must target ExpoWidgetsTarget');

  // Android plugin must NOT inject duplicate app_name into stringsXml
  assert.doesNotMatch(
    androidPluginSrc,
    /name:\s*['"]app_name['"]/,
    'withAndroidWidgets must not inject duplicate app_name in setStringItem'
  );

  // strings.xml must have exactly ONE app_name definition
  const matches = stringsXmlSrc.match(/<string name="app_name">/g) || [];
  assert.equal(matches.length, 1, 'strings.xml must declare app_name exactly once');
});


