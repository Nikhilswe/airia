// AIrIA — OrbAvatar
// Animated orb avatar. Trust level 0-3 controls glow intensity.
// animating=true triggers pulse loop (used during streaming).

import React, { useEffect, useRef } from 'react'
import { Animated, Easing, StyleSheet, View } from 'react-native'
import type { ThemeColors } from './ThemeToken'
import { THEMES } from './ThemeToken'

interface OrbAvatarProps {
  trustLevel?: 0 | 1 | 2 | 3
  animating?: boolean
  size?: number
  theme?: ThemeColors
}

export function OrbAvatar({
  trustLevel = 0,
  animating = false,
  size = 32,
  theme = THEMES.dawn,
}: OrbAvatarProps) {
  const pulse = useRef(new Animated.Value(0)).current

  useEffect(() => {
    if (!animating && trustLevel < 2) {
      pulse.setValue(0)
      return
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    )
    loop.start()
    return () => loop.stop()
  }, [animating, trustLevel, pulse])

  const scale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, trustLevel >= 2 ? 1.12 : 1.06],
  })

  const opacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.7, 1.0],
  })

  const glowSize = size + (trustLevel >= 2 ? 8 : 4)

  return (
    <View style={[styles.wrapper, { width: glowSize, height: glowSize }]}>
      <Animated.View
        style={[
          styles.orb,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: theme.orbBg,
            borderColor: theme.accent,
            borderWidth: trustLevel >= 1 ? 1.5 : 1,
            shadowColor: theme.orbGlow,
            shadowRadius: trustLevel >= 2 ? 12 : 6,
            shadowOpacity: trustLevel >= 1 ? 0.7 : 0.4,
            shadowOffset: { width: 0, height: 0 },
            transform: [{ scale }],
            opacity,
          },
        ]}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  orb: {
    elevation: 4,
  },
})
