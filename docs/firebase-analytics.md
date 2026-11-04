# Firebase Analytics 운영

Firebase 프로젝트: `daily-english-sentence`
앱 식별자(iOS/Android): `com.dailyenglish.sentences`
콘솔: https://console.firebase.google.com/project/daily-english-sentence/overview

## 수집 범위

네이티브 Firebase Analytics가 first_open, session_start, user_engagement 등을 관리한다.
앱은 Expo Router 화면 템플릿으로 screen_view를 추가한다. 실제 문장 ID, 검색어,
이메일, 이름, 학습 답변 및 Supabase 계정 ID는 전송하지 않는다.
현재 사용자 식별은 앱 인스턴스 기준이다. 다른 기기 및 앱 재설치는 별도 사용자로
집계될 수 있으며 로그인 계정 수와 같지 않다. 웹 분석은 이번 연동 범위에 포함하지 않는다.
개발 빌드에서는 수집이 기본 비활성화된다. 운영 빌드는 시작 시 활성화된다.
광고 목적 데이터 사용은 Firebase 기본 동의 설정에서 비활성화한다.

## 지표 확인

Firebase의 Analytics에서 연결된 Google Analytics 속성을 연다.
GA4 보고서의 참여도/유지 개요 및 탐색에서 다음을 확인한다. 메뉴가 없으면
보고서 라이브러리에서 수명 주기 컬렉션을 게시한다.

| 지표 | 기준 |
| --- | --- |
| DAU | 하루 동안의 중복 제거 활성 사용자 |
| WAU | 최근 7일의 중복 제거 활성 사용자 |
| MAU | 최근 30일의 중복 제거 활성 사용자. 달력 월 집계와 구분 |
| 활성 사용자 수 | 선택한 기간의 활성 사용자(activeUsers) |
| D1/D7/D30 유지율 | 최초 방문 코호트 중 해당 경과일에 돌아온 사용자 비율 |
| 재방문율 | 같은 기간의 returningUsers / totalUsers × 100 |
| DAU/MAU | 사용자 고착도이며, 코호트 유지율 또는 재방문율과 다름 |

탐색에서 날짜와 플랫폼을 행으로, 활성 사용자·전체 사용자·재방문 사용자를
측정항목으로 선택한다. 재방문율 계산은 같은 기간의 전체 행 값을 사용한다.
신규 사용자와 재방문 사용자는 기간 안에서 겹칠 수 있으므로 둘의 합을 분모로 쓰지 않는다.
일별 사용자를 더해서 MAU를 만들지 않는다.
보고 시간대는 대한민국(Asia/Seoul)으로 맞춘다.
새 SDK가 포함된 버전부터 수집되며 과거 설치 사용 기록은 소급 수집되지 않는다.
D30 지표는 최소 30일이 지난 코호트가 필요하다.

## 네이티브 빌드

루트에 google-services.json 및 GoogleService-Info.plist를 둔다(Git 제외).
다른 경로는 FIREBASE_ANDROID_CONFIG/FIREBASE_IOS_CONFIG로 지정한다.
Firebase SDK 추가는 OTA 업데이트로 완료할 수 없으며 새 네이티브 빌드가 필요하다.

```sh
npx expo prebuild --no-install
cd ios
pod install
```

RNFirebase 23.8.8과 static frameworks를 사용해 기존 AdMob CocoaPods 의존성과 호환한다. 실제 Xcode/Android
빌드에서 기존 Google 로그인·AdMob·위젯과 함께 검증한다.
Expo Go는 지원하지 않는다.

## DebugView 확인

1. 로컬 .env에 EXPO_PUBLIC_ANALYTICS_DEBUG=true를 설정하고 개발 빌드를 실행한다.
2. Android: adb shell setprop debug.firebase.analytics.app com.dailyenglish.sentences
3. iOS: Xcode Run Arguments에 -FIRDebugEnabled를 추가한다.
4. Firebase Analytics DebugView에서 screen_view와 자동 수집 이벤트를 확인한다.
5. 홈→저장→복습 화면 이동 시 화면 이름이 바뀌는지 확인한다.
6. Android 디버그 해제: adb shell setprop debug.firebase.analytics.app .none.
   iOS 디버그 해제: -FIRDebugEnabled 제거. 환경 변수도 false로 복원한다.

일반 보고서는 실시간 화면보다 늦게 반영될 수 있다. DebugView에서 먼저 전송을 검증한다.
배포 전에 개인정보처리방침 및 스토어의 데이터 수집 안내에 Firebase Analytics
사용 목적과 수집 항목을 반영한다.

## 공식 문서

- https://rnfirebase.io/
- https://rnfirebase.io/analytics/usage
- https://support.google.com/analytics/answer/12253918
- https://support.google.com/analytics/answer/11004084
- https://developers.google.com/analytics/devguides/reporting/data/v1/api-schema
