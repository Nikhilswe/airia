import React, { useEffect, useRef } from 'react'
import { View, Animated, StyleSheet } from 'react-native'
import type { ThemeColors } from '@airia/ui/src/ThemeToken'

interface TypingIndicatorProps {
  theme: ThemeColors
}

export function TypingIndicator({ theme }: TypingIndicatorProps) {
  const dot1 = useRef(new Animated.Value(0.3)).current
  const dot2 = useRef(new Animated.Value(0.3)).current
  const dot3 = useRef(new Animated.Value(0.3)).current

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 400, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0.3, duration: 400, useNativeDriver: true }),
        ])
      )

    const a1 = animate(dot1, 0)
    const a2 = animate(dot2, 200)
    const a3 = animate(dot3, 400)
    a1.start()
    a2.start()
    a3.start()

    return () => { a1.stop(); a2.stop(); a3.stop() }
  }, [dot1, dot2, dot3])

  const dotStyle = { backgroundColor: theme.accent }

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.dot, dotStyle, { opacity: dot1 }]} />
      <Animated.View style={[styles.dot, dotStyle, { opacity: dot2 }]} />
      <Animated.View style={[styles.dot, dotStyle, { opacity: dot3 }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
})
