/**
 * ads.ts — Configuration Google Ads (Google AdMob pour Mobile & Google AdSense pour Web)
 *
 * IMPORTANT : Google interdit formellement d'afficher ou de cliquer sur de vraies publicités
 * lors des tests sous peine de bannissement de compte.
 * Par défaut, ce fichier utilise les identifiants de test officiels de Google (Test Ad Unit IDs).
 *
 * Dès que tes comptes AdMob et AdSense sont créés et validés par Google, remplace les identifiants
 * ci-dessous par tes vrais identifiants de production et passe isTestMode à false.
 */

import { Platform } from 'react-native';

export const GOOGLE_ADS_CONFIG = {
  // Activer ou désactiver globalement l'affichage des publicités
  enabled: true,

  // Mode test (recommandé à true tant que vos comptes Google ne sont pas approuvés)
  isTestMode: true,

  // --- GOOGLE ADMOB (Application Android & iOS) ---
  admob: {
    // App IDs officiels de test Google
    appIdAndroid: 'ca-app-pub-3940256099942544~3347511713',
    appIdIos: 'ca-app-pub-3940256099942544~1458002511',

    // Bannières discrètes (Format 320x50 ou adaptatif)
    bannerAndroid: 'ca-app-pub-3940256099942544/6300978111', // ID test Google
    bannerIos: 'ca-app-pub-3940256099942544/2934735716',     // ID test Google

    // Publicité vidéo récompensée (Rewarded Ad) pour gagner des pétales dans la boutique
    rewardedAndroid: 'ca-app-pub-3940256099942544/5224354917', // ID test Google
    rewardedIos: 'ca-app-pub-3940256099942544/1712485313',     // ID test Google
  },

  // --- GOOGLE ADSENSE (Version Web) ---
  adsense: {
    // Identifiant éditeur (format ca-pub-XXXXXXXXXXXXXXXX)
    publisherId: 'ca-pub-3940256099942544',
    // Identifiant du bloc d'annonces de votre site web
    slotId: '1234567890',
  },

  // Récompense offerte pour une vidéo publicitaire dans la boutique
  rewardPetalsAmount: 15,
};

/** Renvoie l'ID d'unité publicitaire de bannière adapté à la plateforme active */
export function getBannerAdUnitId(): string {
  if (Platform.OS === 'ios') {
    return GOOGLE_ADS_CONFIG.admob.bannerIos;
  }
  return GOOGLE_ADS_CONFIG.admob.bannerAndroid;
}

/** Renvoie l'ID d'unité publicitaire de vidéo récompensée adapté à la plateforme active */
export function getRewardedAdUnitId(): string {
  if (Platform.OS === 'ios') {
    return GOOGLE_ADS_CONFIG.admob.rewardedIos;
  }
  return GOOGLE_ADS_CONFIG.admob.rewardedAndroid;
}
