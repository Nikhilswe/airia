// AIrIA — SyncOverlay
// Full-screen animation shown when a new fine-tuned model version has synced.

import React, { useEffect, useRef } from 'react'
import { Animated, Easing, Pressable, StyleSheet, Text } from 'react-native'
import { AiriaLogo } from '@airia/ui'
import type { ThemeColors } from '@airia/ui'
import { THEMES } from '@airia/ui'

interface SyncOverlayProps {
  newModel: string
  onDismiss: () => void
  theme?: ThemeColors
}

export function SyncOverlay({ newModel, onDismiss, theme = THEMES.dawn }: SyncOverlayProps) {
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()
  }, [fadeAnim])

  return (
    <Animated.View style={[styles.overlay, { backgroundColor: theme.bg, opacity: fadeAnim }]}>
      <AiriaLogo size={80} animate glow accentColor={theme.accent} />

      <Text style={[styles.headline, { color: theme.textPrimary }]}>
        AIrIA has evolved
      </Text>

      <Text style={[styles.modelName, { color: theme.accent }]}>{newModel}</Text>

      <Text style={[styles.body, { color: theme.textSecondary }]}>
        Your fine-tuned model is now active.{'\n'}
        AIrIA knows you a little better.
      </Text>

      <Pressable
        style={({ pressed }) => [
          styles.btn,
          { borderColor: theme.accentBorder, backgroundColor: theme.accentLight, opacity: pressed ? 0.7 : 1 },
        ]}
        onPress={onDismiss}
        accessibilityRole="button"
        accessibilityLabel="Continue"
      >
        <Text style={[styles.btnText, { color: theme.accent }]}>Continue</Text>
      </Pressable>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 32,
    zIndex: 200,
  },
  headline: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
  modelName: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  body: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  btn: {
    marginTop: 24,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 36,
    paddingVertical: 12,
  },
  btnText: {
    fontSize: 15,
    fontWeight: '600',
  },
})
