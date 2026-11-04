import { useEffect, useRef, type PropsWithChildren } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { useSegments } from 'expo-router';

type AnalyticsSDK = typeof import('@react-native-firebase/analytics');
let initialization: Promise<AnalyticsSDK | null> | undefined;

async function initialize(): Promise<AnalyticsSDK | null> {
  const configured = Constants.expoConfig?.extra?.firebaseAnalytics?.[Platform.OS];
  if (!configured || Platform.OS === 'web' || Constants.appOwnership === 'expo') return null;
  if (!initialization) {
    initialization = (async () => {
      // Lazy import also keeps existing development builds without RNFB usable.
      const sdk = require('@react-native-firebase/analytics') as AnalyticsSDK;
      await sdk.setAnalyticsCollectionEnabled(sdk.getAnalytics(),
        !__DEV__ || process.env.EXPO_PUBLIC_ANALYTICS_DEBUG === 'true');
      return sdk;
    })().catch(() => {
      console.warn('Firebase Analytics 초기화 실패: 설정 파일과 네이티브 재빌드를 확인하세요.');
      return null;
    });
  }
  return initialization;
}

export function AnalyticsProvider({ children }: PropsWithChildren) {
  // Route templates exclude expression IDs, query strings and user-entered data.
  const screen = useSegments().join('/') || 'index';
  const previous = useRef<string | null>(null);
  const queue = useRef(Promise.resolve());

  useEffect(() => {
    if (previous.current === screen) return;
    previous.current = screen;
    queue.current = queue.current.then(async () => {
      const sdk = await initialize();
      if (!sdk) return;
      await sdk.logEvent(sdk.getAnalytics(), 'screen_view', {
        screen_name: screen,
        screen_class: screen,
      });
    }).catch(() => {
      console.warn('Firebase Analytics 화면 기록에 실패했습니다.');
    });
  }, [screen]);

  return children;
}
