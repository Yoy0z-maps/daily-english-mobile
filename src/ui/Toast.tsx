import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

type ToastAction = { label: string; onPress: () => void };
const useToast = create<{ message: string | null; revision: number; action?: ToastAction }>(() => ({ message: null, revision: 0 }));
export const showToast = (message: string, action?: ToastAction) => useToast.setState((state) => ({ message, action, revision: state.revision + 1 }));

export function Toast() {
  const { message, revision, action } = useToast();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => useToast.setState({ message: null }), action ? 12000 : 4500);
    return () => clearTimeout(timer);
  }, [message, revision, action]);
  if (!message) return null;
  return (
    <View accessibilityRole="alert" accessibilityLiveRegion="assertive"
      style={[styles.toast, { bottom: insets.bottom + 72 }]}>
      <Text style={styles.text}>{message}</Text>
      {action ? <Pressable accessibilityRole="button" style={{ padding: 10 }} onPress={() => {
        if (useToast.getState().revision !== revision || !useToast.getState().message) return;
        useToast.setState({ message: null, action: undefined });
        action.onPress();
      }}><Text style={[styles.text, { fontWeight: '800' }]}>{action.label}</Text></Pressable> : null}
    </View>
  );
}
const styles = StyleSheet.create({
  toast: { position: 'absolute', left: 24, right: 24, backgroundColor: '#27272A', borderRadius: 16, padding: 16, zIndex: 1000, elevation: 20 },
  text: { color: '#FFFFFF', fontSize: 14, lineHeight: 21, textAlign: 'center' }
});
