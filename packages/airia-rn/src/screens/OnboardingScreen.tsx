// AIrIA — OnboardingScreen
// Animated "system initialization" experience with orbital logo,
// staggered text reveals, ambient background, and shimmer CTA.

import React, { useEffect, useRef } from 'react'
import { View, Text, Pressable, StyleSheet, Animated, Easing, Dimensions } from 'react-native'
import { AiriaLogo } from '@airia/ui/src/AiriaLogo'
import type { ThemeColors } from '@airia/ui/src/ThemeToken'
import { THEMES } from '@airia/ui/src/ThemeToken'
import type { NativeStackScreenProps } from '@react-navigation/native-stack'
import type { RootStackParamList } from '../App'

type Props = NativeStackScreenProps<RootStackParamList, 'Onboarding'>

interface OnboardingScreenProps extends Props {
  theme: ThemeColors
}

const { width: SCREEN_W } = Dimensions.get('window')

function useFadeUp(delay: number) {
  const opacity = useRef(new Animated.Value(0)).current
  const translateY = useRef(new Animated.Value(18)).current

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 400,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          damping: 15,
          stiffness: 100,
          mass: 0.8,
          useNativeDriver: true,
        }),
      ]),
    ]).start()
  }, [opacity, translateY, delay])

  return { opacity, transform: [{ translateY }] }
}

export function OnboardingScreen({ navigation, theme = THEMES.dawn }: OnboardingScreenProps) {
  // Ambient background glow
  const glowOpacity = useRef(new Animated.Value(0)).current
  const glowScale = useRef(new Animated.Value(0.8)).current

  // CTA shimmer
  const shimmerX = useRef(new Animated.Value(-1)).current

  // CTA press spring
  const ctaScale = useRef(new Animated.Value(1)).current

  // Boot sequence: bg glow fades in, then shimmer loops
  useEffect(() => {
    Animated.timing(glowOpacity, {
      toValue: 1,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start()

    Animated.loop(
      Animated.sequence([
        Animated.timing(glowScale, {
          toValue: 1.05,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 0.95,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start()

    // CTA shimmer starts after text has appeared
    const shimmerLoop = Animated.loop(
      Animated.sequence([
        Animated.delay(3000),
        Animated.timing(shimmerX, {
          toValue: 1,
          duration: 1200,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(shimmerX, {
          toValue: -1,
          duration: 0,
          useNativeDriver: true,
        }),
        Animated.delay(2000),
      ])
    )
    const shimmerTimer = setTimeout(() => shimmerLoop.start(), 1200)
    return () => clearTimeout(shimmerTimer)
  }, [glowOpacity, glowScale, shimmerX])

  // Staggered fade-in-up for each element
  const logoAnim = useFadeUp(200)
  const titleAnim = useFadeUp(400)
  const taglineAnim = useFadeUp(600)
  const bodyAnim = useFadeUp(800)
  const ctaAnim = useFadeUp(1000)

  const shimmerTranslate = shimmerX.interpolate({
    inputRange: [-1, 1],
    outputRange: [-SCREEN_W * 0.5, SCREEN_W * 0.5],
  })

  const onPressIn = () => {
    Animated.spring(ctaScale, {
      toValue: 0.95,
      damping: 15,
      mass: 0.6,
      stiffness: 200,
      useNativeDriver: true,
    }).start()
  }

  const onPressOut = () => {
    Animated.spring(ctaScale, {
      toValue: 1,
      damping: 10,
      mass: 0.6,
      stiffness: 200,
      useNativeDriver: true,
    }).start()
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      {/* Ambient radial glow */}
      <Animated.View
        style={[
          styles.ambientGlow,
          {
            backgroundColor: theme.accent,
            opacity: Animated.multiply(glowOpacity, new Animated.Value(0.08)),
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      {/* Secondary softer glow offset upward */}
      <Animated.View
        style={[
          styles.ambientGlowSecondary,
          {
            backgroundColor: theme.accent,
            opacity: Animated.multiply(glowOpacity, new Animated.Value(0.04)),
            transform: [{ scale: glowScale }],
          },
        ]}
      />

      {/* Logo with boot-up spring */}
      <Animated.View style={[styles.logoWrap, logoAnim]}>
        <AiriaLogo size={120} animate glow bootUp accentColor={theme.accent} />
      </Animated.View>

      {/* Title */}
      <Animated.View style={titleAnim}>
        <Text style={[styles.title, { color: theme.textPrimary }]}>
          AI<Text style={{ color: theme.accent }}>r</Text>IA
        </Text>
      </Animated.View>

      {/* Tagline */}
      <Animated.View style={taglineAnim}>
        <Text style={[styles.tagline, { color: theme.textSecondary }]}>
          Your personal AI that gets to know you.
        </Text>
      </Animated.View>

      {/* Body */}
      <Animated.View style={bodyAnim}>
        <Text style={[styles.body, { color: theme.textTertiary }]}>
          Private. Adaptive. Yours.{'\n'}
          Conversations stay on your device.
        </Text>
      </Animated.View>

      {/* CTA with shimmer and spring */}
      <Animated.View style={[ctaAnim, { transform: [...ctaAnim.transform, { scale: ctaScale }] }]}>
        <Pressable
          onPressIn={onPressIn}
          onPressOut={onPressOut}
          onPress={() => navigation.replace('Chat')}
          accessibilityRole="button"
          accessibilityLabel="Get started"
          style={styles.ctaOuter}
        >
          <View
            style={[
              styles.cta,
              {
                backgroundColor: theme.accent,
                shadowColor: theme.accent,
              },
            ]}
          >
            {/* Shimmer overlay */}
            <Animated.View
              style={[
                styles.shimmer,
                {
                  transform: [{ translateX: shimmerTranslate }],
                },
              ]}
            />
            <Text style={[styles.ctaText, { color: theme.bg }]}>Get started</Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  ambientGlow: {
    position: 'absolute',
    width: SCREEN_W * 1.2,
    height: SCREEN_W * 1.2,
    borderRadius: SCREEN_W * 0.6,
    top: '15%',
  },
  ambientGlowSecondary: {
    position: 'absolute',
    width: SCREEN_W * 0.8,
    height: SCREEN_W * 0.8,
    borderRadius: SCREEN_W * 0.4,
    top: '25%',
  },
  logoWrap: {
    marginBottom: 8,
  },
  title: {
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: 2,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 17,
    textAlign: 'center',
    marginTop: 4,
  },
  body: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
  },
  ctaOuter: {
    marginTop: 32,
  },
  cta: {
    borderRadius: 28,
    paddingHorizontal: 48,
    paddingVertical: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 60,
    backgroundColor: 'rgba(255,255,255,0.18)',
    transform: [{ skewX: '-15deg' }],
  },
  ctaText: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
})
