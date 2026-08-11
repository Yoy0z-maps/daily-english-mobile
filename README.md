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

필요하면 기존 `ADMOB_*` 및 `EXPO_PUBLIC_ADMOB_*` 환경변수로 이 값들을 덮어쓸 수 있습니다. 앱 ID를 바꾼 뒤에는 네이티브 설정 반영을 위해 `npx expo prebuild` 후 앱을 다시 빌드해야 합니다.

이 앱은 만 14세 이상만 이용할 수 있으며 생년월일을 입력받거나 저장하지 않습니다. 연령을 구분할 수 없으므로 모든 광고 요청에 미성년자 보호 설정을 적용하고, 광고 콘텐츠 등급은 최대 `PG`로 제한합니다. iOS ATT 추적 권한은 요청하지 않습니다. 이 설정은 개인정보 보호에 보수적이지만 성인 사용자에게도 개인 맞춤 광고가 제한될 수 있습니다. 미성년 처리 신호를 사용하는 동안에는 UMP 동의 양식을 조회하지 않습니다.

향후 성인 사용자를 구분하여 개인 맞춤 광고를 사용한다면 AdMob의 **개인정보 보호 및 메시지**에서 필요한 GDPR 메시지를 먼저 게시하고 UMP 동의 수집을 다시 연결해야 합니다. Google Play Console에서는 실제 대상 연령대를 정확히 선택한 뒤 **앱에 광고 포함**을 `예`로 설정해야 합니다. 개인정보처리방침과 이용약관에도 만 14세 이상 이용 조건 및 광고 SDK 사용 내용을 반영해야 합니다.

## iOS Widget Build Note

If `pod install` fails under the Korean project path with `React-Core-prebuilt` / `Missing required attribute source`, prepare an ASCII-path iOS build copy:

```sh
npm run ios:prepare-ascii
```

Then open `/private/tmp/dailyenglish-ios-build/ios/app.xcworkspace` in Xcode.

위젯 타깃 연결은 `docs/IOS_WIDGET_SETUP.md`를 참고하세요.
