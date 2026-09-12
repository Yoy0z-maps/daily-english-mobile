import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';
import { GoogleOneTapSignIn } from 'react-native-nitro-google-signin';
import { signInWithGoogle, signOutSocialSession } from '@/auth/socialAuth';

jest.mock('@react-native-kakao/user', () => ({}));
jest.mock('expo-apple-authentication', () => ({}));
jest.mock('expo-crypto', () => ({
  randomUUID: jest.fn(() => 'fresh-nonce'),
  digestStringAsync: jest.fn(async () => 'hashed-nonce'),
  CryptoDigestAlgorithm: { SHA256: 'SHA256' }
}));
jest.mock('react-native-nitro-google-signin', () => ({
  GoogleOneTapSignIn: {
    configure: jest.fn(), checkPlayServices: jest.fn(),
    presentExplicitSignIn: jest.fn(), signOut: jest.fn()
  },
  isCancelledResponse: (response: any) => response.type === 'cancelled',
  isSuccessResponse: (response: any) => response.type === 'success'
}));
jest.mock('@/lib/supabase', () => ({ supabase: {
  auth: { signInWithIdToken: jest.fn(), getUser: jest.fn(), updateUser: jest.fn(), signOut: jest.fn() },
  rpc: jest.fn(), from: jest.fn()
} }));

const session = { access_token: 'session-token', user: { id: 'user-1', app_metadata: { provider: 'google' } } };
const success = { type: 'success', data: { idToken: 'google-token', user: { name: 'Learner', photo: 'https://example.com/photo' } } };
const update = jest.fn();

beforeEach(() => {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: 'ios' });
  jest.mocked(GoogleOneTapSignIn.presentExplicitSignIn).mockResolvedValue(success as any);
  jest.mocked(supabase.auth.signInWithIdToken).mockResolvedValue({ data: { session }, error: null } as any);
  jest.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: session.user }, error: null } as any);
  jest.mocked(supabase.auth.updateUser).mockResolvedValue({ error: null } as any);
  jest.mocked(supabase.auth.signOut).mockResolvedValue({ error: null });
  jest.mocked(supabase.rpc).mockResolvedValue({ error: null } as any);
  update.mockReturnValue({ eq: jest.fn().mockResolvedValue({ error: null }) });
  jest.mocked(supabase.from).mockReturnValue({ update } as any);
});

it.each(['ios', 'android'])('exchanges a fresh token and nonce and syncs the profile on %s', async (platform) => {
  Object.defineProperty(Platform, 'OS', { value: platform });
  expect(await signInWithGoogle()).toEqual(session);
  expect(GoogleOneTapSignIn.configure).toHaveBeenCalledWith(expect.objectContaining({ nonce: 'hashed-nonce' }));
  expect(supabase.auth.signInWithIdToken).toHaveBeenCalledWith({ provider: 'google', token: 'google-token', nonce: 'fresh-nonce' });
  expect(update).toHaveBeenCalledWith(expect.objectContaining({ nickname: 'Learner', profile_image: 'https://example.com/photo' }));
});

it('does not contact Supabase when the account picker is cancelled', async () => {
  jest.mocked(GoogleOneTapSignIn.presentExplicitSignIn).mockResolvedValue({ type: 'cancelled' } as any);
  await expect(signInWithGoogle()).rejects.toMatchObject({ code: 'SIGN_IN_CANCELLED' });
  expect(supabase.auth.signInWithIdToken).not.toHaveBeenCalled();
});

it('rejects missing Google tokens', async () => {
  jest.mocked(GoogleOneTapSignIn.presentExplicitSignIn).mockResolvedValue({ ...success, data: { ...success.data, idToken: null } } as any);
  await expect(signInWithGoogle()).rejects.toThrow('Google ID 토큰');
  expect(supabase.auth.signInWithIdToken).not.toHaveBeenCalled();
});

it('explains a rejected client ID without updating the profile', async () => {
  jest.mocked(supabase.auth.signInWithIdToken).mockResolvedValue({ error: new Error('Unacceptable audience in id_token') } as any);
  await expect(signInWithGoogle()).rejects.toThrow('허용 Client ID');
  expect(update).not.toHaveBeenCalled();
});

it('clears both Supabase and Google sessions on logout', async () => {
  await signOutSocialSession(session as any);
  expect(supabase.auth.signOut).toHaveBeenCalled();
  expect(GoogleOneTapSignIn.signOut).toHaveBeenCalled();
});
