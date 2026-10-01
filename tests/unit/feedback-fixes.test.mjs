import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFile(resolve(root, relativePath), 'utf8');

test('Dashboard removes rarity badges and includes launch/banner ads', async () => {
  const dashSrc = await read('src/app/dashboard.tsx');

  assert.doesNotMatch(dashSrc, /cat\.rarity/, 'Rarity badges must not be displayed on dashboard category cards');
  assert.match(dashSrc, /<AppLaunchAd/, 'AppLaunchAd must be present on dashboard');
  assert.match(dashSrc, /<GoogleAdBanner/, 'GoogleAdBanner must be present on dashboard');
});

test('StreakCalendar removes interactive month calendar grid below', async () => {
  const calSrc = await read('src/components/StreakCalendar.tsx');

  assert.doesNotMatch(calSrc, /calHeader/, 'calHeader navigation must be removed from StreakCalendar');
  assert.doesNotMatch(calSrc, /calCells\.map/, 'calCells grid must be removed from StreakCalendar');
  assert.match(calSrc, /recordBox/, 'StreakCalendar must still retain recordBox stats');
});

test('QuestCard pending badge does not overflow container', async () => {
  const questSrc = await read('src/components/QuestCard.tsx');

  assert.match(questSrc, /numberOfLines=\{1\}/, 'pendingText must have numberOfLines={1}');
  assert.match(questSrc, /flexShrink:\s*1/, 'pendingBadge must have flexShrink: 1');
});

test('Admin mode provides +/- toggle buttons and avoids restrictive numeric keyboardType', async () => {
  const adminSrc = await read('src/app/admin.tsx');

  assert.doesNotMatch(adminSrc, /value=\{petalDelta\}[^>]*keyboardType="numeric"/, 'petalDelta input must not use numeric keyboardType');
  assert.doesNotMatch(adminSrc, /value=\{petalAmount\}[^>]*keyboardType="numeric"/, 'petalAmount input must not use numeric keyboardType');
  assert.match(adminSrc, /signBtn/, 'Admin screen must provide dedicated +/- buttons');
});

test('Root layout dismisses splash screen cleanly and avoids getting stuck', async () => {
  const layoutSrc = await read('src/app/_layout.tsx');

  assert.match(layoutSrc, /SplashScreen\.hideAsync/, '_layout.tsx must call SplashScreen.hideAsync');
});

test('Shop hides modifier mon avatar button until avatar customization is released', async () => {
  const shopSrc = await read('src/app/shop.tsx');

  assert.doesNotMatch(shopSrc, /Modifier mon Avatar/, 'Modifier mon avatar button must be hidden');
});

test('metro.config.js enforces canonical single resolution for @firebase/app and @firebase/auth', async () => {
  const metroSrc = await read('metro.config.js');

  assert.match(metroSrc, /resolveRequest/, 'metro.config.js must define resolveRequest');
  assert.match(metroSrc, /@firebase\/app/, 'metro.config.js must canonically resolve @firebase/app');
  assert.match(metroSrc, /@firebase\/auth/, 'metro.config.js must canonically resolve @firebase/auth');
});

test('app.json uses NousDeux icon and theme for splash screen without default starter assets', async () => {
  const appJson = JSON.parse(await read('app.json'));
  const splashPlugin = appJson.expo.plugins.find(
    (p) => Array.isArray(p) && p[0] === 'expo-splash-screen'
  );

  assert.ok(splashPlugin, 'expo-splash-screen plugin must be configured in app.json');
  assert.equal(splashPlugin[1].image, './assets/images/icon.png', 'Splash must use NousDeux icon.png');
  assert.equal(splashPlugin[1].backgroundColor, '#FFF5F2', 'Splash light background must match NousDeux warm theme');
  assert.equal(splashPlugin[1].dark?.backgroundColor, '#1A1514', 'Splash dark background must match NousDeux dark theme');

  const androidAdaptive = appJson.expo.android?.adaptiveIcon;
  assert.ok(androidAdaptive, 'android.adaptiveIcon must be configured');
  assert.equal(androidAdaptive.backgroundColor, '#FFF5F2', 'Adaptive icon background must be #FFF5F2');
  assert.equal(androidAdaptive.foregroundImage, './assets/images/android-icon-foreground.png');
  assert.equal(androidAdaptive.backgroundImage, undefined, 'Adaptive icon must not define a backgroundImage');
});

test('build-android workflow builds standalone release APK with JS bundling', async () => {
  const workflowSrc = await read('.github/workflows/build-android.yml');

  assert.match(workflowSrc, /assembleRelease/, 'Workflow must build assembleRelease so JS bundle is included offline');
  assert.match(workflowSrc, /signingConfig signingConfigs\.debug/, 'Workflow must configure debug signing for sideloading');
  assert.match(workflowSrc, /apk\/release/, 'Workflow must collect APK from release output directory');
});

test('app.json configures expo-image-picker with camera and photos permissions', async () => {
  const appJson = JSON.parse(await read('app.json'));
  const plugins = appJson.expo.plugins;
  const imagePickerPlugin = plugins.find((p) => Array.isArray(p) && p[0] === 'expo-image-picker');

  assert.ok(imagePickerPlugin, 'app.json must declare expo-image-picker plugin');
  assert.ok(imagePickerPlugin[1].cameraPermission, 'Must declare cameraPermission');
  assert.ok(imagePickerPlugin[1].photosPermission, 'Must declare photosPermission');
});

test('avatarPicker utility strips metadata and disables EXIF', async () => {
  const pickerSrc = await read('src/lib/avatarPicker.ts');

  assert.match(pickerSrc, /stripMetadataAndCompress/, 'Must export stripMetadataAndCompress');
  assert.match(pickerSrc, /takePhotoWithCamera/, 'Must export takePhotoWithCamera');
  assert.match(pickerSrc, /pickImageFromGallery/, 'Must export pickImageFromGallery');
  assert.match(pickerSrc, /exif:\s*false/, 'Must disable EXIF metadata extraction');
});

test('notifications.ts adapts reminders for couple vs solo users', async () => {
  const notifSrc = await read('src/lib/notifications.ts');

  assert.match(notifSrc, /isCouple/, 'Must determine couple status');
  assert.match(notifSrc, /solo-invite/, 'Must schedule solo invitation reminders');
  assert.match(notifSrc, /daily-question/, 'Must schedule couple daily question reminders');
});

test('settings.tsx and avatar.tsx use AvatarPickerModal for camera and gallery choice', async () => {
  const avatarSrc = await read('src/app/onboarding/avatar.tsx');
  const settingsSrc = await read('src/app/settings.tsx');

  assert.match(avatarSrc, /AvatarPickerModal/, 'avatar.tsx must render AvatarPickerModal');
  assert.match(avatarSrc, /handleTakePhoto/, 'avatar.tsx must support camera capture');
  assert.match(settingsSrc, /AvatarPickerModal/, 'settings.tsx must render AvatarPickerModal');
  assert.match(settingsSrc, /handleTakePhoto/, 'settings.tsx must support camera capture');
});

test('AppLaunchAd prevents showing interstitial ads during onboarding or incomplete sync', async () => {
  const adSrc = await read('src/components/AppLaunchAd.tsx');

  assert.match(adSrc, /isOnboarding/, 'AppLaunchAd must check isOnboarding');
  assert.match(adSrc, /isSyncComplete/, 'AppLaunchAd must check isSyncComplete');
  assert.match(adSrc, /if\s*\(\s*isOnboarding\s*\|\|\s*!isSyncComplete\s*\)/, 'AppLaunchAd must abort when not synced or onboarding');
});

test('FloatingChat close button has enlarged hitbox and does not get hijacked by pan responder', async () => {
  const chatSrc = await read('src/components/FloatingChat.tsx');

  assert.match(chatSrc, /hitSlop=\{\{\s*top:\s*16/, 'Close button must have generous hitSlop');
  assert.match(chatSrc, /onStartShouldSetPanResponder:\s*\(\)\s*=>\s*false/, 'Pan responder must not capture initial touch on start');
  assert.match(chatSrc, /width:\s*36,\s*height:\s*36/, 'Close button must have minimum width and height');
});

test('date.tsx handles iOS keyboard dismiss, auto-advance, and KeyboardAvoidingView', async () => {
  const dateSrc = await read('src/app/onboarding/date.tsx');

  assert.match(dateSrc, /KeyboardAvoidingView/, 'date.tsx must wrap with KeyboardAvoidingView');
  assert.match(dateSrc, /TouchableWithoutFeedback[\s\S]*Keyboard\.dismiss/, 'date.tsx must dismiss keyboard on background tap');
  assert.match(dateSrc, /InputAccessoryView/, 'date.tsx must define InputAccessoryView on iOS');
  assert.match(dateSrc, /handleDayChange[\s\S]*monthRef\.current\?\.focus\(\)/, 'date.tsx must auto-advance from day to month');
  assert.match(dateSrc, /handleMonthChange[\s\S]*yearRef\.current\?\.focus\(\)/, 'date.tsx must auto-advance from month to year');
});

test('useTopInset provides safe Android and iOS clearance across headers', async () => {
  const hookSrc = await read('src/hooks/useTopInset.ts');
  assert.match(hookSrc, /StatusBar\.currentHeight/, 'useTopInset must check StatusBar.currentHeight on Android');
  assert.match(hookSrc, /Math\.max\([^)]*38\)/, 'useTopInset must enforce at least 38dp minimum on Android');

  const shopSrc = await read('src/app/shop.tsx');
  assert.match(shopSrc, /useTopInset/, 'shop.tsx must import and use useTopInset');

  const settingsSrc = await read('src/app/settings.tsx');
  assert.match(settingsSrc, /useTopInset/, 'settings.tsx must import and use useTopInset');
  assert.match(settingsSrc, /headerFixedContainer/, 'settings.tsx must fix header above scroll view');

  const chatSrc = await read('src/app/chat.tsx');
  assert.match(chatSrc, /useTopInset/, 'chat.tsx must import and use useTopInset');

  const contactSrc = await read('src/app/contact.tsx');
  assert.match(contactSrc, /useTopInset/, 'contact.tsx must import and use useTopInset');

  const adminSrc = await read('src/app/admin.tsx');
  assert.match(adminSrc, /useTopInset/, 'admin.tsx must import and use useTopInset');
});

test('cosmetics and cards use solid borders without dashed traits glitches', async () => {
  const shopSrc = await read('src/app/shop.tsx');
  assert.doesNotMatch(shopSrc, /borderStyle:\s*'dashed'/, 'shop.tsx must not use dashed borders');
  assert.match(shopSrc, /avatarMiniBase/, 'shop.tsx must render mini avatar base inside border cards');

  const settingsSrc = await read('src/app/settings.tsx');
  assert.doesNotMatch(settingsSrc, /borderStyle:\s*'dashed'/, 'settings.tsx must not use dashed border for pairing code');

  const pairingSrc = await read('src/app/pairing.tsx');
  assert.doesNotMatch(pairingSrc, /borderStyle:\s*'dashed'/, 'pairing.tsx must not use dashed border');

  const syncSrc = await read('src/app/onboarding/sync.tsx');
  assert.doesNotMatch(syncSrc, /borderStyle:\s*'dashed'/, 'sync.tsx must not use dashed border');

  const unlimSrc = await read('src/components/UnlimitedQuestions.tsx');
  assert.doesNotMatch(unlimSrc, /borderStyle:\s*'dashed'/, 'UnlimitedQuestions.tsx must not use dashed border');
});

test('all JSX and TSX files in src/ have valid syntax and balanced tags without parse errors', async () => {
  const { readdirSync, statSync, readFileSync } = await import('node:fs');
  const path = await import('node:path');
  const parser = await import('@babel/parser');

  const filesWithErrors = [];
  function scan(dir) {
    for (const item of readdirSync(dir)) {
      const full = path.join(dir, item);
      if (statSync(full).isDirectory()) {
        if (item !== 'node_modules' && item !== '.git') scan(full);
      } else if (full.endsWith('.tsx') || full.endsWith('.jsx')) {
        const code = readFileSync(full, 'utf8');
        try {
          parser.parse(code, {
            sourceType: 'module',
            plugins: ['jsx', 'typescript'],
          });
        } catch (err) {
          filesWithErrors.push(`${full}: ${err.message}`);
        }
      }
    }
  }

  scan(resolve(root, 'src'));
  assert.equal(filesWithErrors.length, 0, `JSX syntax parse errors found: \n${filesWithErrors.join('\n')}`);
});

test('metro.config.js redirects react-native-google-mobile-ads to web mock when platform is web', async () => {
  const metroContent = await read('metro.config.js');
  assert.ok(metroContent.includes("platform === 'web'"), 'metro.config.js checks platform === web');
  assert.ok(metroContent.includes('react-native-google-mobile-ads'), 'metro.config.js handles react-native-google-mobile-ads');

  const mock = await import(pathToFileURL(resolve(root, 'src/mocks/react-native-google-mobile-ads.web.js')).href);
  assert.ok(mock.default.BannerAd, 'mock has BannerAd');
  assert.ok(mock.default.InterstitialAd, 'mock has InterstitialAd');
  assert.ok(mock.default.RewardedAd, 'mock has RewardedAd');
});

test('root layout and html prevent bottom white band and handle activeUser routing', async () => {
  const layoutSrc = await read('src/app/_layout.tsx');
  const htmlSrc = await read('src/app/+html.tsx');

  assert.doesNotMatch(layoutSrc, /scale:\s*0\.75/, 'Scale 0.75 hack must be removed to avoid web gaps and blurry rendering');
  assert.match(layoutSrc, /activeUser\s*=\s*firebaseUser\s*\|\|\s*auth\?\.currentUser/, 'Active user must check auth.currentUser to prevent redirect bounce');
  assert.match(htmlSrc, /viewport-fit=cover/, '+html.tsx must set viewport-fit=cover');
  assert.match(htmlSrc, /background-color:\s*#FFF5F2/, '+html.tsx must set global background color to avoid white bar');
});

test('dashboard and app.json support tablet and iPad layout without empty void', async () => {
  const dashSrc = await read('src/app/dashboard.tsx');
  const appJson = JSON.parse(await read('app.json'));

  assert.equal(appJson.expo.ios.supportsTablet, true, 'app.json must support tablets for iOS');
  assert.match(dashSrc, /windowWidth\s*>=\s*640/, 'dashboard must adapt category grid and safeArea for tablet widths');
});
