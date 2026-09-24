/**
 * ads.ts — Configuration Google Ads (Google AdMob pour Mobile & Google AdSense pour Web)
 *
 * IMPORTANT : En phase de test (développement local ou avant validation du compte Google),
 * conservez `isTestMode: true` pour éviter tout risque de suspension pour faux clics.
 * Dès que votre application est validée sur Google Play / App Store, passez `isTestMode: false`.
 */

import { Platform } from 'react-native';

export const GOOGLE_ADS_CONFIG = {
  // Activer ou désactiver globalement l'affichage des publicités
  enabled: true,

  // Mode test (à passer à false en production une fois l'app validée sur les stores)
  isTestMode: false,

  // Limite quotidienne de vidéos pour obtenir des pétales gratuits (3 ou 4 max)
  maxDailyRewardedVideos: 4,

  // Récompense en pétales offerte pour chaque vidéo
  rewardPetalsAmount: 15,

  // --- GOOGLE ADMOB (Application Android & iOS) ---
  admob: {
    // Identifiants réels de production
    production: {
      bannerIos: 'ca-app-pub-3211840066693840/9565168205',
      rewardedIos: 'ca-app-pub-3211840066693840/4223368307',
      interstitialIos: 'ca-app-pub-3211840066693840/4223368307',

      bannerAndroid: 'ca-app-pub-3211840066693840/4550757080',
      rewardedAndroid: 'ca-app-pub-3211840066693840/3237675418',
      interstitialAndroid: 'ca-app-pub-3211840066693840/3237675418',
    },

    // Identifiants officiels de test Google (sécurité en mode dev)
    test: {
      bannerAndroid: 'ca-app-pub-3940256099942544/6300978111',
      bannerIos: 'ca-app-pub-3940256099942544/2934735716',
      rewardedAndroid: 'ca-app-pub-3940256099942544/5224354917',
      rewardedIos: 'ca-app-pub-3940256099942544/1712485313',
      interstitialAndroid: 'ca-app-pub-3940256099942544/1033173712',
      interstitialIos: 'ca-app-pub-3940256099942544/4411468910',
      appOpenAndroid: 'ca-app-pub-3940256099942544/9257395921',
      appOpenIos: 'ca-app-pub-3940256099942544/5575463023',
    }
  },

  // --- GOOGLE ADSENSE (Version Web) ---
  adsense: {
    // Identifiant éditeur AdSense du compte utilisateur
    publisherId: 'ca-pub-3211840066693840',
    // Identifiant du bloc d'annonces de votre site web
    slotId: '1234567890',
  },
};

/** Renvoie l'ID d'unité publicitaire de bannière adapté à la plateforme active */
export function getBannerAdUnitId(): string {
  const units = GOOGLE_ADS_CONFIG.isTestMode
    ? GOOGLE_ADS_CONFIG.admob.test
    : GOOGLE_ADS_CONFIG.admob.production;

  if (Platform.OS === 'ios') {
    return units.bannerIos;
  }
  return units.bannerAndroid;
}

/** Renvoie l'ID d'unité publicitaire de vidéo récompensée adapté à la plateforme active */
export function getRewardedAdUnitId(): string {
  const units = GOOGLE_ADS_CONFIG.isTestMode
    ? GOOGLE_ADS_CONFIG.admob.test
    : GOOGLE_ADS_CONFIG.admob.production;

  if (Platform.OS === 'ios') {
    return units.rewardedIos;
  }
  return units.rewardedAndroid;
}

/** Renvoie l'ID d'unité publicitaire interstitielle (pub courte au lancement) */
export function getInterstitialAdUnitId(): string {
  const units = GOOGLE_ADS_CONFIG.isTestMode
    ? GOOGLE_ADS_CONFIG.admob.test
    : GOOGLE_ADS_CONFIG.admob.production;

  if (Platform.OS === 'ios') {
    return units.interstitialIos;
  }
  return units.interstitialAndroid;
}
