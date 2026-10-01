import React, { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { GOOGLE_ADS_CONFIG, getBannerAdUnitId } from '../constants/ads';
import { Colors } from '../constants/Colors';
import { useOnboardingStore } from '../store/onboardingStore';

interface GoogleAdBannerProps {
  style?: any;
}

export default function GoogleAdBanner({ style }: GoogleAdBannerProps) {
  const isDarkMode = useOnboardingStore((s) => s.isDarkMode);
  const theme = isDarkMode ? Colors.dark : Colors.light;
  const [adError, setAdError] = useState(false);
  const [useFallbackTest, setUseFallbackTest] = useState(false);
  const webAdRef = useRef<any>(null);

  // Initialisation AdSense côté Web
  useEffect(() => {
    if (Platform.OS === 'web' && GOOGLE_ADS_CONFIG.enabled && !GOOGLE_ADS_CONFIG.isTestMode) {
      try {
        if (typeof window !== 'undefined') {
          ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
        }
      } catch (err) {
        console.warn('AdSense push error:', err);
      }
    }
  }, []);

  if (!GOOGLE_ADS_CONFIG.enabled || !(GOOGLE_ADS_CONFIG as any).enableBannerAds || adError) {
    return null;
  }

  // --- VERSION WEB ---
  if (Platform.OS === 'web') {
    if (GOOGLE_ADS_CONFIG.isTestMode) {
      return (
        <View style={[styles.container, styles.testBanner, { borderColor: isDarkMode ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.12)' }, style]}>
          <View style={[styles.badge, { backgroundColor: isDarkMode ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.08)' }]}>
            <Text style={[styles.badgeText, { color: theme.text, opacity: 0.7 }]}>ANNONCE</Text>
          </View>
          <Text style={[styles.testText, { color: theme.text, opacity: 0.6 }]}>
            Espace Google AdSense (Web)
          </Text>
        </View>
      );
    }

    return (
      <View style={[styles.container, style]}>
        <div ref={webAdRef} style={{ width: '100%', minHeight: 60, display: 'flex', justifyContent: 'center' }}>
          <ins
            className="adsbygoogle"
            style={{ display: 'inline-block', width: '320px', height: '50px' }}
            data-ad-client={GOOGLE_ADS_CONFIG.adsense.publisherId}
            data-ad-slot={GOOGLE_ADS_CONFIG.adsense.slotId}
          />
        </div>
      </View>
    );
  }

  // --- VERSION MOBILE (ANDROID & IOS) ---
  let BannerAdComponent: any = null;
  let BannerAdSize: any = null;
  try {
    const mobileAds = require('react-native-google-mobile-ads');
    BannerAdComponent = mobileAds.BannerAd;
    BannerAdSize = mobileAds.BannerAdSize;
  } catch {
    BannerAdComponent = null;
  }

  if (BannerAdComponent && BannerAdSize) {
    const primaryUnitId = getBannerAdUnitId();
    const testUnitId = Platform.OS === 'ios'
      ? GOOGLE_ADS_CONFIG.admob.test.bannerIos
      : GOOGLE_ADS_CONFIG.admob.test.bannerAndroid;
    const activeUnitId = useFallbackTest ? testUnitId : primaryUnitId;

    return (
      <View style={[styles.container, style]}>
        <BannerAdComponent
          unitId={activeUnitId}
          size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
          requestOptions={{ requestNonPersonalizedAdsOnly: true }}
          onAdFailedToLoad={(err: any) => {
            console.warn('AdMob banner load error with unitId', activeUnitId, err);
            if (!useFallbackTest && activeUnitId !== testUnitId) {
              setUseFallbackTest(true);
            } else {
              setAdError(true);
            }
          }}
        />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 2,
  },
  testBanner: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: 'dashed',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingHorizontal: 14,
    maxWidth: 420,
    alignSelf: 'center',
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  testText: {
    fontSize: 12,
    fontStyle: 'italic',
    fontWeight: '500',
  },
});
