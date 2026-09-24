import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (relativePath) => readFile(resolve(root, relativePath), 'utf8');

test('Google Ads configuration provides test IDs and platform resolution', async () => {
  const adsSrc = await read('src/constants/ads.ts');

  assert.match(adsSrc, /GOOGLE_ADS_CONFIG/, 'ads.ts must export GOOGLE_ADS_CONFIG');
  assert.match(adsSrc, /isTestMode/, 'ads.ts must include isTestMode');
  assert.match(adsSrc, /maxDailyRewardedVideos:\s*4/, 'ads.ts must configure maxDailyRewardedVideos to 4');
  assert.match(adsSrc, /getBannerAdUnitId/, 'ads.ts must export getBannerAdUnitId');
  assert.match(adsSrc, /getRewardedAdUnitId/, 'ads.ts must export getRewardedAdUnitId');
  assert.match(adsSrc, /getInterstitialAdUnitId/, 'ads.ts must export getInterstitialAdUnitId');
  assert.match(adsSrc, /publisherId/, 'ads.ts must configure adsense publisherId');

  // Verify user's actual AdMob IDs
  assert.match(adsSrc, /9565168205/, 'ads.ts must contain iOS banner ID');
  assert.match(adsSrc, /4223368307/, 'ads.ts must contain iOS rewarded/interstitial ID');
  assert.match(adsSrc, /4550757080/, 'ads.ts must contain Android banner ID');
  assert.match(adsSrc, /3237675418/, 'ads.ts must contain Android rewarded/interstitial ID');
});

test('GoogleAdBanner, RewardedAdButton, and AppLaunchAd are integrated in dashboard and shop', async () => {
  const dashboardSrc = await read('src/app/dashboard.tsx');
  const shopSrc = await read('src/app/shop.tsx');
  const bannerSrc = await read('src/components/GoogleAdBanner.tsx');
  const rewardedSrc = await read('src/components/RewardedAdButton.tsx');
  const launchAdSrc = await read('src/components/AppLaunchAd.tsx');

  assert.match(dashboardSrc, /<GoogleAdBanner/, 'dashboard.tsx must render GoogleAdBanner');
  assert.match(dashboardSrc, /<AppLaunchAd/, 'dashboard.tsx must render AppLaunchAd');
  assert.match(shopSrc, /<GoogleAdBanner/, 'shop.tsx must render GoogleAdBanner');
  assert.match(shopSrc, /<RewardedAdButton/, 'shop.tsx must render RewardedAdButton');
  assert.match(bannerSrc, /GOOGLE_ADS_CONFIG/, 'GoogleAdBanner must use GOOGLE_ADS_CONFIG');
  assert.match(rewardedSrc, /awardBonusPetals/, 'RewardedAdButton must award petals upon completion');
  assert.match(rewardedSrc, /maxDailyRewardedVideos/, 'RewardedAdButton must check maxDailyRewardedVideos');
  assert.match(launchAdSrc, /hasShownLaunchAdThisSession/, 'AppLaunchAd must only run once per app session');
});

test('QuestCard keeps view on unclaimed tier and does not advance prematurely', async () => {
  const cardSrc = await read('src/components/QuestCard.tsx');

  assert.match(cardSrc, /firstUnclaimedIdx/, 'QuestCard must calculate firstUnclaimedIdx from unclaimedTiers');
  assert.match(cardSrc, /defaultIdx = firstUnclaimedIdx !== -1/, 'QuestCard must prioritize firstUnclaimedIdx over next tier');
  assert.doesNotMatch(
    cardSrc,
    /setOptimisticClaimedTiers\(\{\}\);\s*\},?\s*\[progress\]/,
    'QuestCard must not wipe optimisticClaimedTiers on every progress change to prevent button flickering'
  );
});

test('Anti-bypass protections prevent clicking disabled buttons and fake rewards', async () => {
  const rewardedSrc = await read('src/components/RewardedAdButton.tsx');
  const cardSrc = await read('src/components/QuestCard.tsx');
  const launchSrc = await read('src/components/AppLaunchAd.tsx');

  // RewardedAdButton protections
  assert.match(rewardedSrc, /pointerEvents=\{isLoading \|\| isLimitReached \? 'none' : 'auto'\}/);
  assert.match(rewardedSrc, /isProcessingRef\.current/, 'Must have sync processing ref to block rapid multi-tap');
  assert.match(rewardedSrc, /RewardedAdEventType\.ERROR/, 'Must handle ad load error explicitly');

  // QuestCard protections
  assert.match(cardSrc, /loadingClaim \|\| hasUserClaimed/, 'Must guard claim click when claiming or already claimed');
  assert.match(cardSrc, /pointerEvents=\{loadingClaim \|\| hasUserClaimed \? 'none' : 'auto'\}/);

  // AppLaunchAd protections
  assert.match(launchSrc, /pointerEvents=\{secondsLeft > 0 \? 'none' : 'auto'\}/);
  assert.match(launchSrc, /disabled=\{secondsLeft > 0\}/);
});


