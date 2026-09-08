import { useEffect } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

const useToast = create<{ message: string | null; revision: number }>(() => ({ message: null, revision: 0 }));
export const showToast = (message: string) => useToast.setState((state) => ({ message, revision: state.revision + 1 }));

export function Toast() {
  const { message, revision } = useToast();
  const insets = useSafeAreaInsets();
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => useToast.setState({ message: null }), 4500);
    return () => clearTimeout(timer);
  }, [message, revision]);
  if (!message) return null;
  return (
    <Pressable accessibilityRole="alert" accessibilityLiveRegion="assertive"
      onPress={() => useToast.setState({ message: null })}
      style={[styles.toast, { bottom: insets.bottom + 72 }]}>
      <Text style={styles.text}>{message}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  toast: { position: 'absolute', left: 24, right: 24, backgroundColor: '#27272A', borderRadius: 16, padding: 16, zIndex: 1000, elevation: 20 },
  text: { color: '#FFFFFF', fontSize: 14, lineHeight: 21, textAlign: 'center' }
});
