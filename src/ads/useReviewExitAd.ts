import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigation, usePreventRemove } from 'expo-router/react-navigation';
import { AdEventType, RewardedAd, RewardedAdEventType } from 'react-native-google-mobile-ads';
import { useAdMob } from '@/ads/AdMobProvider';
import { rewardedAdUnitId } from '@/ads/adUnits';
import { selectEffectiveIsPremium, useAppStore } from '@/store/useAppStore';

// One opportunity per review: never wait for an ad to load when leaving.
export function useReviewExitAd(hasQuestions: boolean) {
  const navigation = useNavigation();
  const { isReady } = useAdMob();
  const isPremium = useAppStore(selectEffectiveIsPremium);
  const adRef = useRef<RewardedAd | null>(null);
  const loadedRef = useRef(false);
  const consumed = useRef(false);
  const continuation = useRef<(() => void) | null>(null);
  const [released, setReleased] = useState(false);
  const [pendingAction, setPendingAction] = useState<Parameters<typeof navigation.dispatch>[0] | null>(null);

  const finish = useCallback(() => {
    const next = continuation.current;
    continuation.current = null;
    setReleased(true);
    next?.();
  }, []);

  useEffect(() => {
    if (!isReady || isPremium || consumed.current) return;
    const ad = RewardedAd.createForAdRequest(rewardedAdUnitId);
    adRef.current = ad;
    const unsubscribe = ad.addAdEventsListener(({ type }) => {
      if (type === RewardedAdEventType.LOADED) loadedRef.current = true;
      if (type === AdEventType.CLOSED || type === AdEventType.ERROR) {
        loadedRef.current = false;
        if (continuation.current) finish();
      }
    });
    try { ad.load(); } catch { loadedRef.current = false; }
    return () => { unsubscribe(); adRef.current = null; loadedRef.current = false; };
  }, [isReady, isPremium, finish]);

  const endReview = useCallback((next: () => void) => {
    if (continuation.current) return;
    if (consumed.current) { next(); return; }
    consumed.current = true;
    continuation.current = next;
    if (!hasQuestions || isPremium || !isReady || !loadedRef.current || !adRef.current) {
      finish();
      return;
    }
    try { void adRef.current.show().catch(finish); } catch { finish(); }
  }, [hasQuestions, isPremium, isReady, finish]);

  useEffect(() => {
    if ((!isReady || isPremium) && continuation.current) finish();
  }, [isReady, isPremium, finish]);

  usePreventRemove(hasQuestions && !released && !isPremium, ({ data }) => {
    endReview(() => setPendingAction(data.action));
  });
  useEffect(() => {
    if (pendingAction && released) {
      setPendingAction(null);
      navigation.dispatch(pendingAction);
    }
  }, [pendingAction, released, navigation]);

  useEffect(() => () => { continuation.current = null; }, []);
  return endReview;
}
