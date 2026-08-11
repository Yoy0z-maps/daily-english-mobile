import { useRef } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';
import {
  BannerAd,
  BannerAdSize,
  useForeground
} from 'react-native-google-mobile-ads';

import { useAdMob } from '@/ads/AdMobProvider';
import { bannerAdUnitId } from '@/ads/adUnits';
import type { AppTheme } from '@/theme/colors';
import { useThemeColors } from '@/theme/useThemeColors';

export const AdBanner = () => {
  const colors = useThemeColors();
  const styles = createStyles(colors);
  const bannerRef = useRef<BannerAd>(null);
  const { isReady } = useAdMob();

  useForeground(() => {
    if (Platform.OS === 'ios') {
      bannerRef.current?.load();
    }
  });

  return (
    <View style={styles.container}>
      {isReady ? (
        <BannerAd
          ref={bannerRef}
          unitId={bannerAdUnitId}
          size={BannerAdSize.LARGE_ANCHORED_ADAPTIVE_BANNER}
          onAdFailedToLoad={(error) => console.warn('배너 광고를 불러오지 못했습니다.', error)}
        />
      ) : (
        <ActivityIndicator color={colors.primary} />
      )}
    </View>
  );
};

const createStyles = (colors: AppTheme) =>
  StyleSheet.create({
    container: {
      alignItems: 'center',
      alignSelf: 'stretch',
      backgroundColor: colors.background,
      justifyContent: 'center',
      minHeight: 50,
      width: '100%'
    }
  });
