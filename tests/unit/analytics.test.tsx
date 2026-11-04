import { render, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';
import Constants from 'expo-constants';
import { AnalyticsProvider } from '@/analytics/AnalyticsProvider';
import { logEvent, setAnalyticsCollectionEnabled } from '@react-native-firebase/analytics';

let mockSegments = ['expression', '[id]'];
jest.mock('expo-router', () => ({ useSegments: () => mockSegments }));
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { extra: { firebaseAnalytics: { ios: false, android: false } } } }
}));
jest.mock('@react-native-firebase/analytics', () => ({
  getAnalytics: jest.fn(() => 'analytics'),
  setAnalyticsCollectionEnabled: jest.fn().mockResolvedValue(undefined),
  logEvent: jest.fn().mockResolvedValue(undefined)
}));

test('missing configuration renders the app without calling Firebase', async () => {
  const view = render(<AnalyticsProvider><Text>ready</Text></AnalyticsProvider>);
  await waitFor(() => expect(view.getByText('ready')).toBeTruthy());
  expect(logEvent).not.toHaveBeenCalled();
});

test('tracks route templates once per navigation and disables development collection', async () => {
  Constants.expoConfig!.extra!.firebaseAnalytics = { ios: true, android: true };
  const view = render(<AnalyticsProvider><Text>ready</Text></AnalyticsProvider>);
  await waitFor(() => expect(logEvent).toHaveBeenCalledWith('analytics', 'screen_view', {
    screen_name: 'expression/[id]', screen_class: 'expression/[id]'
  }));
  expect(setAnalyticsCollectionEnabled).toHaveBeenCalledWith('analytics', false);
  view.rerender(<AnalyticsProvider><Text>updated</Text></AnalyticsProvider>);
  expect(logEvent).toHaveBeenCalledTimes(1);
  mockSegments = ['review'];
  view.rerender(<AnalyticsProvider><Text>review</Text></AnalyticsProvider>);
  await waitFor(() => expect(logEvent).toHaveBeenCalledTimes(2));
});
