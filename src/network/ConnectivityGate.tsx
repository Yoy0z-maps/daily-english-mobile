import NetInfo from '@react-native-community/netinfo';
import { type PropsWithChildren, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';

import { useThemeColors } from '@/theme/useThemeColors';

type ConnectivityStatus = 'checking' | 'online' | 'offline';

const toStatus = (isConnected: boolean | null, isInternetReachable: boolean | null) => {
  if (isConnected === false || isInternetReachable === false) {
    return 'offline' as const;
  }

  if (isConnected === true) {
    return 'online' as const;
  }

  return 'checking' as const;
};

export function ConnectivityGate({ children }: PropsWithChildren) {
  const colors = useThemeColors();
  const [status, setStatus] = useState<ConnectivityStatus>('checking');

  const checkConnection = useCallback(async () => {
    setStatus('checking');
    const state = await NetInfo.fetch();
    setStatus(toStatus(state.isConnected, state.isInternetReachable));
  }, []);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setStatus(toStatus(state.isConnected, state.isInternetReachable));
    });

    void checkConnection();
    return unsubscribe;
  }, [checkConnection]);

  if (status === 'online') {
    return children;
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {status === 'checking' ? (
          <>
            <ActivityIndicator color={colors.primary} size="large" />
            <Text style={[styles.title, { color: colors.text }]}>인터넷 연결 확인 중</Text>
            <Text style={[styles.description, { color: colors.textMuted }]}>
              안전하게 학습 기록을 불러오고 있어요.
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.icon}>📡</Text>
            <Text style={[styles.title, { color: colors.text }]}>인터넷 연결이 필요해요</Text>
            <Text style={[styles.description, { color: colors.textMuted }]}>
              학습 기록은 Supabase에 안전하게 저장됩니다. Wi-Fi 또는 모바일 데이터를 연결한 뒤
              다시 시도해주세요.
            </Text>
            <Pressable
              style={[styles.button, { backgroundColor: colors.primary }]}
              onPress={() => void checkConnection()}
            >
              <Text style={styles.buttonText}>다시 연결하기</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 18,
    marginTop: 22,
    paddingHorizontal: 24,
    paddingVertical: 14
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900'
  },
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32
  },
  description: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 23,
    marginTop: 10,
    maxWidth: 340,
    textAlign: 'center'
  },
  icon: {
    fontSize: 48
  },
  safeArea: {
    flex: 1
  },
  title: {
    fontSize: 24,
    fontWeight: '900',
    marginTop: 18
  }
});
