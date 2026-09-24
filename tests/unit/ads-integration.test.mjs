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
  assert.match(adsSrc, /getBannerAdUnitId/, 'ads.ts must export getBannerAdUnitId');
  assert.match(adsSrc, /getRewardedAdUnitId/, 'ads.ts must export getRewardedAdUnitId');
  assert.match(adsSrc, /publisherId/, 'ads.ts must configure adsense publisherId');
});

test('GoogleAdBanner and RewardedAdButton are cleanly integrated in dashboard and shop', async () => {
  const dashboardSrc = await read('src/app/dashboard.tsx');
  const shopSrc = await read('src/app/shop.tsx');
  const bannerSrc = await read('src/components/GoogleAdBanner.tsx');
  const rewardedSrc = await read('src/components/RewardedAdButton.tsx');

  assert.match(dashboardSrc, /<GoogleAdBanner/, 'dashboard.tsx must render GoogleAdBanner');
  assert.match(shopSrc, /<GoogleAdBanner/, 'shop.tsx must render GoogleAdBanner');
  assert.match(shopSrc, /<RewardedAdButton/, 'shop.tsx must render RewardedAdButton');
  assert.match(bannerSrc, /GOOGLE_ADS_CONFIG/, 'GoogleAdBanner must use GOOGLE_ADS_CONFIG');
  assert.match(rewardedSrc, /awardBonusPetals/, 'RewardedAdButton must award petals upon completion');
});

test('QuestCard does not prematurely wipe optimistic claim on progress changes', async () => {
  const cardSrc = await read('src/components/QuestCard.tsx');

  assert.doesNotMatch(
    cardSrc,
    /setOptimisticClaimedTiers\(\{\}\);\s*\},?\s*\[progress\]/,
    'QuestCard must not wipe optimisticClaimedTiers on every progress change to prevent button flickering'
  );
});
