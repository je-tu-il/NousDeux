module.exports = ({ config }) => {
  const production = process.env.EAS_BUILD_PROFILE === 'production' || process.env.EXPO_PUBLIC_APP_ENV === 'production';
  const androidAppId = process.env.ADMOB_ANDROID_APP_ID;
  const iosAppId = process.env.ADMOB_IOS_APP_ID;
  if (production) {
    if (process.env.EXPO_PUBLIC_FIREBASE_EMULATORS === 'true') {
      throw new Error('Un build de production ne peut pas utiliser les comptes fictifs locaux.');
    }
    for (const [name, value] of Object.entries({ ADMOB_ANDROID_APP_ID: androidAppId, ADMOB_IOS_APP_ID: iosAppId })) {
      if (!value || !/^ca-app-pub-\d+~\d+$/.test(value) || value.includes('3940256099942544')) {
        throw new Error(`${name} doit contenir votre véritable identifiant d’application AdMob avant le build store.`);
      }
    }
  }
  return {
    ...config,
    name: config.name || 'NousDeux',
    slug: config.slug || 'nousdeux',
    plugins: config.plugins?.map((plugin) => {
      if (!Array.isArray(plugin) || plugin[0] !== 'react-native-google-mobile-ads') return plugin;
      return [plugin[0], {
        ...plugin[1],
        ...(androidAppId ? { androidAppId } : {}),
        ...(iosAppId ? { iosAppId } : {}),
      }];
    }),
  };
};
