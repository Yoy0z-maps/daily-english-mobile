import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import { requestTrackingPermissionsAsync } from 'expo-tracking-transparency';
import { Platform } from 'react-native';
import mobileAds, { AdsConsent, MaxAdContentRating } from 'react-native-google-mobile-ads';

import { useAppStore } from '@/store/useAppStore';

type AdMobContextValue = {
  isReady: boolean;
};

const AdMobContext = createContext<AdMobContextValue>({ isReady: false });

let mobileAdsInitialization: Promise<boolean> | null = null;

const initializeMobileAdsIfAllowed = async () => {
  const { canRequestAds } = await AdsConsent.getConsentInfo();

  if (!canRequestAds) {
    return false;
  }

  if (!mobileAdsInitialization) {
    mobileAdsInitialization = mobileAds()
      .initialize()
      .then(() => true)
      .catch((error) => {
        mobileAdsInitialization = null;
        throw error;
      });
  }

  return mobileAdsInitialization;
};

export const AdMobProvider = ({ children }: PropsWithChildren) => {
  const [isReady, setIsReady] = useState(false);
  const adAgeTreatment = useAppStore((state) => state.adAgeTreatment);
  const hasHydrated = useAppStore((state) => state.hasHydrated);

  useEffect(() => {
    if (!hasHydrated || adAgeTreatment === null) {
      setIsReady(false);
      return;
    }

    let isMounted = true;
    const isChild = adAgeTreatment === 'child';
    const isMinor = adAgeTreatment !== 'adult';

    const startMobileAds = async () => {
      try {
        const didInitialize = await initializeMobileAdsIfAllowed();

        if (didInitialize && isMounted) {
          setIsReady(true);
        }
      } catch (error) {
        console.warn('Google Mobile Ads 초기화에 실패했습니다.', error);
      }
    };

    const requestPrivacyPermissionsAndStartAds = async () => {
      try {
        await mobileAds().setRequestConfiguration({
          maxAdContentRating: isChild ? MaxAdContentRating.G : MaxAdContentRating.PG,
          tagForChildDirectedTreatment: isChild,
          tagForUnderAgeOfConsent: isMinor
        });
      } catch (error) {
        console.warn('연령에 맞는 광고 요청 설정에 실패했습니다.', error);
        return;
      }

      if (Platform.OS === 'ios' && !isMinor) {
        try {
          // Mixed-audience apps must not request tracking permission from child/teen users.
          await requestTrackingPermissionsAsync();
        } catch (error) {
          console.warn('iOS 추적 권한을 요청하지 못했습니다.', error);
        }
      }

      try {
        await AdsConsent.gatherConsent({ tagForUnderAgeOfConsent: isMinor });
      } catch (error) {
        console.warn('광고 개인정보 동의 상태를 확인하지 못했습니다.', error);
      }

      await startMobileAds();
    };

    void requestPrivacyPermissionsAndStartAds();

    return () => {
      isMounted = false;
    };
  }, [adAgeTreatment, hasHydrated]);

  return <AdMobContext.Provider value={{ isReady }}>{children}</AdMobContext.Provider>;
};

export const useAdMob = () => useContext(AdMobContext);
