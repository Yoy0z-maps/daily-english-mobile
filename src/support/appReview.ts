import AsyncStorage from '@react-native-async-storage/async-storage';
import * as StoreReview from 'expo-store-review';
import { Linking, Platform } from 'react-native';

import { useAppStore } from '@/store/useAppStore';

const APP_STORE_ID = '6809145944';
const ANDROID_PACKAGE = 'com.dailyenglish.sentences';
export const FEEDBACK_URL = 'https://www.yoy0z-maps.com/apps/daily-english-sentence/feedback';

const LAST_PROMPTED_AT_KEY = 'daily-english-review-prompted-at-v1';
const MIN_COMPLETIONS_BEFORE_PROMPT = 3;
const PROMPT_INTERVAL_MS = 60 * 24 * 60 * 60 * 1000;
const PROMPT_DELAY_MS = 1000;

const getStoreReviewUrls = () =>
  Platform.OS === 'android'
    ? [
        `market://details?id=${ANDROID_PACKAGE}`,
        `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`
      ]
    : [
        `itms-apps://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`,
        `https://apps.apple.com/app/id${APP_STORE_ID}?action=write-review`
      ];

// 설정의 "리뷰 작성하기"는 시스템 팝업(노출 횟수 제한이 있음) 대신 스토어 리뷰 작성 화면으로 바로 보낸다.
export const openStoreReviewPage = async () => {
  const [storeAppUrl, webUrl] = getStoreReviewUrls();

  try {
    await Linking.openURL(storeAppUrl);
  } catch {
    // 스토어 앱이 없는 기기(시뮬레이터, 플레이 스토어 미설치 등)는 웹 페이지로 연다.
    await Linking.openURL(webUrl);
  }
};

export const openFeedbackPage = () => Linking.openURL(FEEDBACK_URL);

// 학습 완료처럼 기분 좋은 순간에만 시스템 리뷰 팝업을 요청한다.
// 실제 노출 여부는 OS가 결정하므로(iOS는 1년 3회 제한) 앱에서는 요청 간격만 관리한다.
export const maybeRequestStoreReview = async () => {
  const { isAdminMode, totalCompleted } = useAppStore.getState();

  if (isAdminMode || totalCompleted < MIN_COMPLETIONS_BEFORE_PROMPT) {
    return;
  }

  try {
    const lastPromptedAt = Number(await AsyncStorage.getItem(LAST_PROMPTED_AT_KEY));

    if (lastPromptedAt && Date.now() - lastPromptedAt < PROMPT_INTERVAL_MS) {
      return;
    }

    // isAvailableAsync가 false일 때 requestReview를 부르면 스토어 페이지로 이동해버리므로 반드시 먼저 확인한다.
    if (!(await StoreReview.isAvailableAsync())) {
      return;
    }

    await AsyncStorage.setItem(LAST_PROMPTED_AT_KEY, String(Date.now()));
    await new Promise((resolve) => setTimeout(resolve, PROMPT_DELAY_MS));
    await StoreReview.requestReview();
  } catch (error) {
    console.warn('앱 리뷰 요청에 실패했습니다.', error);
  }
};
