import { mockExpressions } from '@/data/mockExpressions';

const mockSave = jest.fn().mockResolvedValue(true);
const mockReload = jest.fn().mockResolvedValue(true);
const mockSetItem = jest.fn().mockResolvedValue(undefined);

jest.mock('react-native', () => {
  const reactNative = jest.requireActual('react-native');
  reactNative.Platform.OS = 'android';
  reactNative.NativeModules.DailyEnglishWidgetBridge = {
    saveWidgetExpressionData: (...args: unknown[]) => mockSave(...args),
    reloadAllWidgets: (...args: unknown[]) => mockReload(...args)
  };
  return reactNative;
});
jest.mock('@react-native-async-storage/async-storage', () => ({
  __esModule: true, default: { setItem: (...args: unknown[]) => mockSetItem(...args) }
}));

import { saveWidgetExpressionData } from '@/widget/saveWidgetExpressionData';
import { reloadAllWidgets } from '@/widget/reloadWidgets';

describe('Android widget bridge', () => {
  it('persists the schedule through the native bridge instead of JS-only storage', async () => {
    await expect(saveWidgetExpressionData(mockExpressions[0], 3, {
      nextExpression: mockExpressions[1], lastCompletedDate: '2026-09-12'
    })).resolves.toBe(true);
    expect(mockSave).toHaveBeenCalledWith(expect.objectContaining({
      id: mockExpressions[0].id, advanceAfterDate: '2026-09-12',
      nextExpression: expect.objectContaining({ id: mockExpressions[1].id })
    }));
    expect(mockSetItem).not.toHaveBeenCalled();
  });

  it('asks Android to update installed widgets', async () => {
    await expect(reloadAllWidgets()).resolves.toBe(true);
    expect(mockReload).toHaveBeenCalledTimes(1);
  });
});
