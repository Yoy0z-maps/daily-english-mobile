import { login as kakaoLogin, logout as kakaoLogout, me as getKakaoProfile } from '@react-native-kakao/user';
import type { Session, User } from '@supabase/supabase-js';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Crypto from 'expo-crypto';

import { supabase } from '@/lib/supabase';

type ProfilePatch = {
  avatarUrl?: string | null;
  nickname?: string | null;
};

const APPLE_NATIVE_CLIENT_ID = 'com.dailyenglish.sentences';
const KAKAO_NATIVE_CLIENT_ID = 'bb53ac5001095de0bcbd0b3a539fbdf0';

const getIdTokenSignInError = (provider: 'Apple' | 'Kakao', error: Error) => {
  if (!error.message.includes('Unacceptable audience in id_token')) {
    return error;
  }

  const expectedClientId =
    provider === 'Apple' ? APPLE_NATIVE_CLIENT_ID : KAKAO_NATIVE_CLIENT_ID;

  return new Error(
    `Supabase ${provider} 로그인 설정의 허용 Client ID에 ${expectedClientId}를 추가해주세요.`
  );
};

const getDeviceTimezone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
  } catch {
    return 'Asia/Seoul';
  }
};

const requireSession = (session: Session | null) => {
  if (!session) {
    throw new Error('로그인 세션을 만들지 못했습니다. 잠시 후 다시 시도해주세요.');
  }

  return session;
};

const getUserProviders = (user: User) => {
  const providers = new Set<string>();
  const metadataProviders = user.app_metadata.providers;

  if (typeof user.app_metadata.provider === 'string') {
    providers.add(user.app_metadata.provider);
  }

  if (Array.isArray(metadataProviders)) {
    metadataProviders.forEach((provider) => {
      if (typeof provider === 'string') {
        providers.add(provider);
      }
    });
  }

  user.identities?.forEach((identity) => providers.add(identity.provider));
  return providers;
};

const verifySupabaseSession = async (session: Session, provider: 'apple' | 'kakao') => {
  const { data, error } = await supabase.auth.getUser(session.access_token);

  if (error || !data.user || data.user.id !== session.user.id) {
    throw new Error('Supabase 로그인 세션을 확인하지 못했습니다. 다시 시도해주세요.');
  }

  if (!getUserProviders(data.user).has(provider)) {
    throw new Error(`Supabase 사용자에 ${provider} 로그인 정보가 연결되지 않았습니다.`);
  }

  return session;
};

const syncProfile = async (session: Session, patch: ProfilePatch) => {
  const metadata: Record<string, string> = {};

  if (patch.nickname) {
    metadata.name = patch.nickname;
  }

  if (patch.avatarUrl) {
    metadata.avatar_url = patch.avatarUrl;
  }

  if (Object.keys(metadata).length > 0) {
    const { error: metadataError } = await supabase.auth.updateUser({ data: metadata });

    if (metadataError) {
      throw metadataError;
    }
  }

  const { error: initializationError } = await supabase.rpc('get_current_content_id');

  if (initializationError) {
    throw initializationError;
  }

  const profileUpdate: {
    nickname?: string;
    profile_image?: string;
    timezone: string;
  } = {
    timezone: getDeviceTimezone()
  };

  if (patch.nickname) {
    profileUpdate.nickname = patch.nickname;
  }

  if (patch.avatarUrl) {
    profileUpdate.profile_image = patch.avatarUrl;
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update(profileUpdate)
    .eq('id', session.user.id);

  if (profileError) {
    throw profileError;
  }
};

export async function signInWithApple() {
  const isAvailable = await AppleAuthentication.isAvailableAsync();

  if (!isAvailable) {
    throw new Error('애플 로그인을 사용할 수 없는 기기입니다.');
  }

  const rawNonce = Crypto.randomUUID();
  const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  const credential = await AppleAuthentication.signInAsync({
    nonce: hashedNonce,
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL
    ]
  });

  if (!credential.identityToken) {
    throw new Error('Apple ID 토큰을 받지 못했습니다. 다시 시도해주세요.');
  }

  const { data, error } = await supabase.auth.signInWithIdToken({
    provider: 'apple',
    token: credential.identityToken,
    nonce: rawNonce,
    ...(credential.authorizationCode ? { access_token: credential.authorizationCode } : {})
  });

  if (error) {
    throw getIdTokenSignInError('Apple', error);
  }

  const session = await verifySupabaseSession(requireSession(data.session), 'apple');
  const fullName = credential.fullName
    ? AppleAuthentication.formatFullName(credential.fullName).trim() || null
    : null;

  await syncProfile(session, { nickname: fullName });
  return session;
}

export async function signInWithKakao() {
  const token = await kakaoLogin();

  if (!token.idToken) {
    throw new Error(
      '카카오 OpenID Connect 토큰을 받지 못했습니다. Kakao Developers에서 OpenID Connect를 활성화해주세요.'
    );
  }

  const [profile, authResult] = await Promise.all([
    getKakaoProfile(),
    supabase.auth.signInWithIdToken({
      provider: 'kakao',
      token: token.idToken
    })
  ]);

  if (authResult.error) {
    throw getIdTokenSignInError('Kakao', authResult.error);
  }

  const session = await verifySupabaseSession(requireSession(authResult.data.session), 'kakao');
  await syncProfile(session, {
    avatarUrl: profile.profileImageUrl,
    nickname: profile.nickname
  });

  return session;
}

export async function signOutSocialSession(session: Session | null) {
  const provider = session?.user.app_metadata.provider;
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }

  if (provider === 'kakao') {
    try {
      await kakaoLogout();
    } catch (error) {
      console.warn('카카오 SDK 로그아웃을 완료하지 못했습니다.', error);
    }
  }
}
