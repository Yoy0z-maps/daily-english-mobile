# 오늘의 문장

React Native + Expo 기반의 “하루 1문장 영어 학습 앱” MVP입니다.

## Included

- Expo Router 하단 탭: Home, Saved, Progress, Settings
- 온보딩, 홈, 표현 상세, 즐겨찾기, 진행도, 설정 화면
- Zustand + AsyncStorage persist 상태 관리
- 프리미엄 mock 토글과 Google AdMob 배너/리워드 광고
- iOS WidgetKit Home Screen small/medium 위젯
- iOS WidgetKit Lock Screen accessoryCircular/accessoryRectangular/accessoryInline 위젯
- App Groups 기반 앱 ↔ 위젯 데이터 공유 구조
- `dailyenglish:///home`, `dailyenglish:///expression/0` 딥링크

## Run

```sh
npm install
npx expo install --fix
npm run ios
```

Expo Go에는 AdMob 네이티브 모듈이 포함되지 않으므로 `npm run ios` 또는 `npm run android`로 개발 빌드를 사용해야 합니다.
Android 네이티브 빌드는 JDK 17을 사용하세요.

`ios/`와 `android/`는 Expo Prebuild가 생성하는 로컬 산출물이므로 Git에서 추적하지 않습니다. 처음 받거나 네이티브 설정이 바뀐 뒤에는 `npx expo prebuild`를 실행해 다시 생성하세요.

## Google AdMob

개발 빌드에서는 Google 공식 테스트 광고가 표시되고, 배포 빌드에서는 아래에 설정된 실제 광고 단위가 사용됩니다.

| 플랫폼 | 앱 ID | 배너 광고 단위 ID | 보상형 광고 단위 ID |
| --- | --- | --- | --- |
| Android | `ca-app-pub-3780332868290454~6325666938` | `ca-app-pub-3780332868290454/6054204198` | `ca-app-pub-3780332868290454/4748715599` |
| iOS | `ca-app-pub-3780332868290454~1675975485` | `ca-app-pub-3780332868290454/2306530874` | `ca-app-pub-3780332868290454/2314123942` |

필요하면 기존 `ADMOB_*` 및 `EXPO_PUBLIC_ADMOB_*` 환경변수로 이 값들을 덮어쓸 수 있습니다. 앱 ID를 바꾼 뒤에는 네이티브 설정 반영을 위해 `npx expo prebuild` 후 앱을 다시 빌드해야 합니다. AdMob의 **개인정보 보호 및 메시지**에서는 필요한 GDPR 메시지를 구성하되, 앱이 iOS ATT 시스템 창을 직접 요청하므로 별도의 IDFA 설명 메시지는 게시하지 않습니다.

이 앱은 아동과 성인을 모두 대상으로 하는 혼합 대상 앱으로 구성되어 있습니다. 광고 SDK를 시작하기 전에 중립적인 생년월일 확인을 거치며, 생년월일 자체는 저장하지 않고 `child`·`teen`·`adult` 연령 구간만 기기에 저장합니다. 연령을 아직 확인하지 않은 상태에서는 광고를 요청하지 않습니다.

- 아동: 아동 대상·미성년 처리 태그, 최대 광고 콘텐츠 등급 `G`, iOS ATT 미요청
- 청소년: 미성년 처리 태그, 최대 광고 콘텐츠 등급 `PG`, iOS ATT 미요청
- 성인: 아동 대상·미성년 처리 해제, 최대 광고 콘텐츠 등급 `PG`, iOS ATT 요청 후 광고 동의 확인

현재 Expo 56과 호환되는 광고 래퍼에서는 기존 TFCD/TFUA 신호를 사용합니다. Google은 아동 요청에서 이 신호가 새 TFAT `CHILD`와 기능상 동일하다고 안내합니다.

Google Play Console에서는 실제 대상 연령대를 정확히 선택하고 **앱에 광고 포함**을 `예`로 설정해야 합니다. 개인정보처리방침에도 연령 구간 확인 목적과 광고 SDK 사용 내용을 반영해야 합니다.

## iOS Widget Build Note

If `pod install` fails under the Korean project path with `React-Core-prebuilt` / `Missing required attribute source`, prepare an ASCII-path iOS build copy:

```sh
npm run ios:prepare-ascii
```

Then open `/private/tmp/dailyenglish-ios-build/ios/app.xcworkspace` in Xcode.

위젯 타깃 연결은 `docs/IOS_WIDGET_SETUP.md`를 참고하세요.
