// Web fallback mock for react-native-google-mobile-ads
// On web, Google Ads are handled via Google AdSense (or test placeholders),
// but Metro statically resolves require('react-native-google-mobile-ads') calls.

const BannerAd = () => null;

const BannerAdSize = {
  BANNER: 'BANNER',
  FULL_BANNER: 'FULL_BANNER',
  LARGE_BANNER: 'LARGE_BANNER',
  LEADERBOARD: 'LEADERBOARD',
  MEDIUM_RECTANGLE: 'MEDIUM_RECTANGLE',
  ADAPTIVE_BANNER: 'ADAPTIVE_BANNER',
  ANCHORED_ADAPTIVE_BANNER: 'ANCHORED_ADAPTIVE_BANNER',
  INLINE_ADAPTIVE_BANNER: 'INLINE_ADAPTIVE_BANNER',
  WIDE_SKYSCRAPER: 'WIDE_SKYSCRAPER',
};

const AdEventType = {
  LOADED: 'loaded',
  ERROR: 'error',
  OPENED: 'opened',
  CLICKED: 'clicked',
  CLOSED: 'closed',
};

const RewardedAdEventType = {
  LOADED: 'loaded',
  EARNED_REWARD: 'earned_reward',
};

const InterstitialAd = {
  createForAdRequest: () => ({
    load: () => {},
    show: () => Promise.resolve(),
    addAdEventListener: () => () => {},
    removeAllListeners: () => {},
  }),
};

const RewardedAd = {
  createForAdRequest: () => ({
    load: () => {},
    show: () => Promise.resolve(),
    addAdEventListener: () => () => {},
    removeAllListeners: () => {},
  }),
};

const mobileAds = () => ({
  initialize: async () => [],
  setRequestConfiguration: async () => {},
});

mobileAds.BannerAd = BannerAd;
mobileAds.BannerAdSize = BannerAdSize;
mobileAds.InterstitialAd = InterstitialAd;
mobileAds.RewardedAd = RewardedAd;
mobileAds.AdEventType = AdEventType;
mobileAds.RewardedAdEventType = RewardedAdEventType;
mobileAds.TestIds = {
  BANNER: 'ca-app-pub-3940256099942544/6300978111',
  INTERSTITIAL: 'ca-app-pub-3940256099942544/1033173712',
  REWARDED: 'ca-app-pub-3940256099942544/5224354917',
};

module.exports = mobileAds;
module.exports.default = mobileAds;
module.exports.BannerAd = BannerAd;
module.exports.BannerAdSize = BannerAdSize;
module.exports.InterstitialAd = InterstitialAd;
module.exports.RewardedAd = RewardedAd;
module.exports.AdEventType = AdEventType;
module.exports.RewardedAdEventType = RewardedAdEventType;
module.exports.TestIds = mobileAds.TestIds;
