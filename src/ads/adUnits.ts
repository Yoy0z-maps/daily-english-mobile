import { Platform } from 'react-native';
import { TestIds } from 'react-native-google-mobile-ads';

const productionBannerIds = {
  android:
    process.env.EXPO_PUBLIC_ADMOB_ANDROID_BANNER_UNIT_ID ??
    'ca-app-pub-3780332868290454/6054204198',
  ios:
    process.env.EXPO_PUBLIC_ADMOB_IOS_BANNER_UNIT_ID ??
    'ca-app-pub-3780332868290454/2306530874'
};

const productionRewardedIds = {
  android:
    process.env.EXPO_PUBLIC_ADMOB_ANDROID_REWARDED_UNIT_ID ??
    'ca-app-pub-3780332868290454/4748715599',
  ios:
    process.env.EXPO_PUBLIC_ADMOB_IOS_REWARDED_UNIT_ID ??
    'ca-app-pub-3780332868290454/2314123942'
};

const selectProductionId = (ids: typeof productionBannerIds) => {
  if (Platform.OS === 'android') {
    return ids.android;
  }

  if (Platform.OS === 'ios') {
    return ids.ios;
  }

  return undefined;
};

// Development builds always use Google's demo units; production builds use this app's units.
export const bannerAdUnitId =
  (__DEV__ ? undefined : selectProductionId(productionBannerIds)) ?? TestIds.ADAPTIVE_BANNER;

export const rewardedAdUnitId =
  (__DEV__ ? undefined : selectProductionId(productionRewardedIds)) ?? TestIds.REWARDED;
