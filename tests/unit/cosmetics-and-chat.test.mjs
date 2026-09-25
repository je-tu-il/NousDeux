import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFile(resolve(root, relativePath), 'utf8');

test('FloatingChat initializes PanResponders cleanly and uses fixed positioning on web', async () => {
  const chatSrc = await read('src/components/FloatingChat.tsx');

  // Must not access ref.current during render
  assert.doesNotMatch(chatSrc, /useRef\(PanResponder\.create/, 'FloatingChat must not wrap PanResponder directly in useRef');
  assert.match(chatSrc, /PanResponder\.create/, 'FloatingChat must create PanResponder');
  assert.match(chatSrc, /position: \(Platform\.OS === 'web' \? 'fixed' : 'absolute'\)/, 'FloatingChat must use fixed positioning on web to avoid jumping on scroll');
  assert.match(chatSrc, /se-resize/, 'FloatingChat resize handle must specify se-resize cursor');
});

test('UnlimitedQuestions keeps partner answer visible when partner moved to next', async () => {
  const uqSrc = await read('src/components/UnlimitedQuestions.tsx');

  // partnerAnswer must be checked first before movedOnBox
  assert.match(
    uqSrc,
    /partnerAnswer !== null \?[\s\S]*styles\.revealBox[\s\S]*: partnerMovedToNext/,
    'UnlimitedQuestions must render partnerAnswer even when partnerMovedToNext is true'
  );
  // Must render celebratory modal on category completion
  assert.match(uqSrc, /celebration\?\.categoryName/, 'UnlimitedQuestions must render category completion celebration');
  // Must not have double chevron on next button
  assert.match(
    uqSrc,
    /bothAnswered && !partnerMovedToNext && <ChevronRight/,
    'UnlimitedQuestions must omit chevron on Rejoindre button'
  );
});

test('Dashboard and StreakCalendar align height and admin shortcut is in Settings', async () => {
  const dashSrc = await read('src/app/dashboard.tsx');
  const streakSrc = await read('src/components/StreakCalendar.tsx');
  const settingsSrc = await read('src/app/settings.tsx');

  assert.match(streakSrc, /compactContainer: \{[\s\S]*marginBottom: 0/, 'StreakCalendar compactContainer must have marginBottom: 0');
  assert.match(dashSrc, /alignItems: 'stretch'/, 'Dashboard widgets row must stretch children to align heights');
  assert.match(settingsSrc, /isUserAdmin\(store\.uid\)/, 'Settings must render admin button when user is admin');
  assert.doesNotMatch(dashSrc, /isUserAdmin/, 'Dashboard must not duplicate admin button (centralized in Settings)');
});

test('Calendar screen uses cover resizeMode and fallback background to avoid white borders', async () => {
  const calSrc = await read('src/app/calendar.tsx');

  assert.doesNotMatch(calSrc, /backgroundResizeMode = windowWidth < 600/, 'Calendar should not switch to contain on mobile');
  assert.match(calSrc, /resizeMode="cover"/, 'Calendar ImageBackground must use cover resizeMode');
  assert.match(calSrc, /backgroundColor: isDarkMode \? '#1A1514' : '#FFF5F2'/, 'Calendar must provide background color fallback');
});

test('QuestCard defines isFullyDone and crypto.ts supports cross-platform derivation', async () => {
  const cardSrc = await read('src/components/QuestCard.tsx');
  const cryptoSrc = await read('src/lib/crypto.ts');

  assert.match(cardSrc, /const isFullyDone = naturallyNextIdx === -1;/, 'QuestCard must declare isFullyDone');
  assert.match(cardSrc, /safeViewIdx/, 'QuestCard must safely bound viewIdx with safeViewIdx');
  assert.match(cryptoSrc, /getSubtleCrypto/, 'crypto.ts must provide cross-platform getSubtleCrypto helper');
  assert.match(cryptoSrc, /deriveBits/, 'crypto.ts must support deriveBits for React Native QuickCrypto compatibility');
  assert.match(cryptoSrc, /LEGACY_SALTS/, 'crypto.ts must support legacy salts');
});

