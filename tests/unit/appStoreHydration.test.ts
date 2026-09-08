import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAppStore } from '@/store/useAppStore';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn().mockResolvedValue(null),
  setItem: jest.fn().mockResolvedValue(undefined),
  removeItem: jest.fn().mockResolvedValue(undefined)
}));

describe('device settings hydration', () => {
  beforeEach(() => {
    useAppStore.setState({ hasHydrated: false, notificationsEnabled: true });
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(null);
  });

  it('finishes startup with enabled reminders when no settings exist', async () => {
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().hasHydrated).toBe(true);
    expect(useAppStore.getState().notificationsEnabled).toBe(true);
  });

  it('finishes startup if stored settings cannot be parsed', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue('invalid json');
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().hasHydrated).toBe(true);
  });

  it('finishes startup if device storage rejects the read', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('storage unavailable'));
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().hasHydrated).toBe(true);
  });

  it('preserves an existing opt-out when migrating old settings', async () => {
    jest.mocked(AsyncStorage.getItem).mockResolvedValue(JSON.stringify({
      state: { isDarkMode: true, notificationsEnabled: false }, version: 0
    }));
    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState()).toMatchObject({
      hasHydrated: true, isDarkMode: true, notificationsEnabled: false
    });
  });
});
