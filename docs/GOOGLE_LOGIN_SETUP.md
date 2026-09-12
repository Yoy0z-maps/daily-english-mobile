# Google 로그인 설정

앱은 `react-native-nitro-google-signin`으로 네이티브 계정 선택 창을 열고, Google ID 토큰과 nonce를 Supabase에 전달합니다. 로그인 후 기존 프로필·학습 동기화를 사용합니다. iOS/Android 개발 빌드 또는 배포 앱에서 사용하며 Expo Go와 웹은 지원하지 않습니다.

## 1. Google Cloud 설정 (직접 수행)

[Google Cloud Console](https://console.cloud.google.com/auth/overview)에서 사용할 프로젝트를 선택하고 Google Auth Platform의 Branding, Audience, Data Access를 설정합니다. 앱 이름, 지원 이메일, 필요한 홈페이지·개인정보처리방침을 등록하고 기본 로그인 범위(openid, email, profile)를 사용합니다. 테스트 상태인 경우 사용할 계정을 테스트 사용자에 추가하세요.

동일한 프로젝트의 Clients에서 다음 OAuth 클라이언트를 만듭니다.

| 유형 | 설정 | 사용 위치 |
| --- | --- | --- |
| 웹 애플리케이션 | 이름 예: Daily English Backend | 앱의 WEB_CLIENT_ID, Supabase Google 설정 |
| iOS | 번들 ID `com.dailyenglish.sentences` | 앱의 IOS_CLIENT_ID, Supabase 허용 ID |
| Android | 패키지 `com.dailyenglish.sentences` + 앱 서명 SHA-1 | Google의 Android 앱 검증 |

Android는 사용하는 서명별로 OAuth 클라이언트를 등록합니다. 개발 debug 서명, 직접 설치하는 release 서명, Google Play **앱 서명 키 인증서** SHA-1을 구분하세요. Play 배포본은 업로드 키가 아닌 앱 서명 키가 필요합니다. Play Console의 앱 무결성/앱 서명 화면에서 확인할 수 있습니다.

로컬 서명 지문은 JDK 17 환경에서 다음 명령으로 확인합니다.

```sh
cd android
./gradlew signingReport
```

Android 클라이언트 ID를 웹 클라이언트 ID 환경변수에 넣으면 안 됩니다. Firebase 설정 파일 없이 명시적인 클라이언트 ID를 사용하는 구성입니다.

## 2. Supabase 설정 (직접 수행)

사용 중인 Supabase 프로젝트의 Authentication → Sign In / Providers → Google에서:

1. Google 제공자를 활성화합니다.
2. Client IDs에는 **웹 클라이언트 ID를 첫 번째**로 넣고, iOS 및 필요한 Android ID를 쉼표로 구분하여 추가합니다.
3. Client Secret 입력이 필요한 경우 웹 OAuth 클라이언트의 secret을 Supabase 대시보드에만 입력합니다. 앱 코드나 `EXPO_PUBLIC_*`에 넣지 마세요.
4. `Skip nonce checks`는 끈 상태를 유지합니다. 앱이 매 로그인마다 새 nonce를 생성하고 검증합니다.
5. 저장합니다.

웹 OAuth 콜백을 설정하는 경우 Supabase 화면에 표시되는 `https://<project-ref>.supabase.co/auth/v1/callback`을 Google 웹 클라이언트의 승인된 리디렉션 URI에 등록합니다. 현재 앱의 네이티브 ID 토큰 로그인은 브라우저 리디렉션을 사용하지 않습니다.

## 3. 환경변수와 재빌드

프로젝트 루트 `.env`의 기존 Supabase 값은 유지하고 발급받은 값을 입력합니다.

```dotenv
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=발급받은-웹-ID.apps.googleusercontent.com
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=발급받은-iOS-ID.apps.googleusercontent.com
```

이 ID들은 공개 식별자입니다. OAuth Client Secret은 이 파일에 추가하지 않습니다. 배포 빌드 환경에도 같은 변수를 설정하세요.

`app.config.js`가 iOS ID를 뒤집어 URL scheme을 자동 등록합니다. ID 설정 후 네이티브 앱을 다시 생성·빌드해야 하며 Metro 새로고침만으로 적용되지 않습니다.

```sh
npx expo prebuild
npm run ios
# 또는
npm run android
```

## 4. 실제 기기 확인

- Google로 로그인 → 계정 선택 → 홈 이동, 설정에서 Google 계정 표시
- 새 사용자의 프로필 생성과 학습 데이터 저장
- 앱 종료·재실행 후 세션 복원
- 로그아웃 후 다른 Google 계정으로 로그인
- 계정 선택 취소 후 온보딩에 머무르고 재시도 가능
- Android 개발 빌드와 Play 배포본 모두 확인

`허용 Client ID` 오류는 Supabase의 ID 목록을, Android `DEVELOPER_ERROR`/설정 오류는 패키지·서명 SHA-1·웹 클라이언트 ID가 같은 Cloud 프로젝트인지 확인하세요. iOS에서 앱으로 돌아오지 않으면 iOS ID 설정 후 prebuild와 재빌드를 했는지 확인하세요.

자동 테스트는 SDK/Supabase를 모킹하여 토큰 전달, nonce, 프로필 갱신, 취소, 오류, 로그아웃을 검증합니다. 실제 OAuth 콘솔 설정과 기기 인증은 위 절차로 별도 확인해야 합니다.

## 참고

- [Supabase Google 인증](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [사용 중인 SDK 설정 안내](https://react-native-nitro-google-sign-in.github.io/docs/setup/google-cloud)
- [사용 중인 SDK 소스와 설치 안내](https://github.com/react-native-nitro-google-sign-in/google-signin)
