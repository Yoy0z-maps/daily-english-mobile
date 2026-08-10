# 오늘의 문장

React Native + Expo 기반의 “하루 1문장 영어 학습 앱” MVP입니다.

## Included

- Expo Router 하단 탭: Home, Saved, Progress, Settings
- 온보딩, 홈, 표현 상세, 즐겨찾기, 진행도, 설정 화면
- Zustand + AsyncStorage persist 상태 관리
- 프리미엄 mock 토글과 광고 placeholder
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

## iOS Widget Build Note

If `pod install` fails under the Korean project path with `React-Core-prebuilt` / `Missing required attribute source`, prepare an ASCII-path iOS build copy:

```sh
npm run ios:prepare-ascii
```

Then open `/private/tmp/dailyenglish-ios-build/ios/app.xcworkspace` in Xcode.

위젯 타깃 연결은 `docs/IOS_WIDGET_SETUP.md`를 참고하세요.
