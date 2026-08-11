import { createContext, type PropsWithChildren, useContext, useEffect, useState } from 'react';
import mobileAds, { MaxAdContentRating } from 'react-native-google-mobile-ads';

type AdMobContextValue = {
  isReady: boolean;
};

const AdMobContext = createContext<AdMobContextValue>({ isReady: false });

let mobileAdsInitialization: Promise<void> | null = null;

const initializeMobileAds = async () => {
  if (!mobileAdsInitialization) {
    mobileAdsInitialization = mobileAds()
      .initialize()
      .then(() => undefined)
      .catch((error) => {
        mobileAdsInitialization = null;
        throw error;
      });
  }

  await mobileAdsInitialization;
};

export const AdMobProvider = ({ children }: PropsWithChildren) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const startMobileAds = async () => {
      try {
        await initializeMobileAds();

        if (isMounted) {
          setIsReady(true);
        }
      } catch (error) {
        console.warn('Google Mobile Ads 초기화에 실패했습니다.', error);
      }
    };

    const requestPrivacyPermissionsAndStartAds = async () => {
      try {
        await mobileAds().setRequestConfiguration({
          maxAdContentRating: MaxAdContentRating.PG,
          tagForChildDirectedTreatment: false,
          tagForUnderAgeOfConsent: true
        });
      } catch (error) {
        console.warn('미성년자 보호 광고 요청 설정에 실패했습니다.', error);
        return;
      }

      await startMobileAds();
    };

    void requestPrivacyPermissionsAndStartAds();

    return () => {
      isMounted = false;
    };
  }, []);

  return <AdMobContext.Provider value={{ isReady }}>{children}</AdMobContext.Provider>;
};

export const useAdMob = () => useContext(AdMobContext);
