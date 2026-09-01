// AIrIA — AiriaLogo
// SVG orbital node graphic with gyroscope rotation, core pulse, and boot-up spring.

import React, { useEffect, useRef } from 'react'
import { Animated, Easing } from 'react-native'
import Svg, { Circle, Line, Path, Defs, RadialGradient, Stop } from 'react-native-svg'

interface AiriaLogoProps {
  size?: number
  animate?: boolean
  glow?: boolean
  accentColor?: string
  bootUp?: boolean
}

export function AiriaLogo({
  size = 64,
  animate = false,
  glow = false,
  accentColor = '#F5A623',
  bootUp = false,
}: AiriaLogoProps) {
  const pulseScale = useRef(new Animated.Value(1)).current
  const pulseOpacity = useRef(new Animated.Value(0.8)).current
  const ring1Rotate = useRef(new Animated.Value(0)).current
  const ring2Rotate = useRef(new Animated.Value(0)).current
  const outerRingRotate = useRef(new Animated.Value(0)).current
  const bootScale = useRef(new Animated.Value(bootUp ? 0 : 1)).current
  const bootOpacity = useRef(new Animated.Value(bootUp ? 0 : 1)).current
  const glowPulse = useRef(new Animated.Value(0.4)).current

  useEffect(() => {
    if (bootUp) {
      Animated.parallel([
        Animated.spring(bootScale, {
          toValue: 1,
          damping: 12,
          mass: 0.8,
          stiffness: 100,
          useNativeDriver: true,
        }),
        Animated.timing(bootOpacity, {
          toValue: 1,
          duration: 600,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [bootUp, bootScale, bootOpacity])

  useEffect(() => {
    if (!animate) return

    // Core breath pulse: scale 1 → 1.08 → 1, opacity 0.8 → 1 → 0.8
    const pulse = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(pulseScale, {
            toValue: 1.08,
            duration: 1800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseScale, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
        Animated.sequence([
          Animated.timing(pulseOpacity, {
            toValue: 1,
            duration: 1800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(pulseOpacity, {
            toValue: 0.8,
            duration: 1800,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ]),
      ])
    )

    // Gyroscope: rings rotate in opposite directions at different speeds
    const r1 = Animated.loop(
      Animated.timing(ring1Rotate, {
        toValue: 1,
        duration: 10000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    const r2 = Animated.loop(
      Animated.timing(ring2Rotate, {
        toValue: 1,
        duration: 14000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )
    const outer = Animated.loop(
      Animated.timing(outerRingRotate, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    )

    // Glow pulse
    const gp = Animated.loop(
      Animated.sequence([
        Animated.timing(glowPulse, {
          toValue: 0.7,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glowPulse, {
          toValue: 0.4,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    )

    pulse.start()
    r1.start()
    r2.start()
    outer.start()
    gp.start()

    return () => {
      pulse.stop()
      r1.stop()
      r2.stop()
      outer.stop()
      gp.stop()
    }
  }, [animate, pulseScale, pulseOpacity, ring1Rotate, ring2Rotate, outerRingRotate, glowPulse])

  const half = size / 2
  const outerR = half * 0.92
  const innerR = half * 0.55

  const nodes = [
    { angle: 0,   r: half * 0.68 },
    { angle: 72,  r: half * 0.62 },
    { angle: 144, r: half * 0.72 },
    { angle: 216, r: half * 0.60 },
    { angle: 288, r: half * 0.70 },
  ]

  const toXY = (angle: number, r: number) => ({
    x: half + r * Math.cos((angle - 90) * (Math.PI / 180)),
    y: half + r * Math.sin((angle - 90) * (Math.PI / 180)),
  })

  const nodePoints = nodes.map(n => toXY(n.angle, n.r))

  const arcPath = (rx: number, ry: number, tilt: number) => {
    const cos = Math.cos(tilt)
    const sin = Math.sin(tilt)
    const x1 = half + rx * cos
    const y1 = half + rx * sin
    const x2 = half - rx * cos
    const y2 = half - rx * sin
    return `M ${x1} ${y1} A ${rx} ${ry} 0 0 1 ${x2} ${y2}`
  }

  const spin1 = ring1Rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })
  const spin2 = ring2Rotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-360deg'],
  })
  const spinOuter = outerRingRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  })

  const svgContent = (
    <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <Defs>
        <RadialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0%" stopColor={accentColor} stopOpacity={glow ? 0.9 : 0.6} />
          <Stop offset="60%" stopColor={accentColor} stopOpacity={0.15} />
          <Stop offset="100%" stopColor={accentColor} stopOpacity={0} />
        </RadialGradient>
      </Defs>

      {/* Constellation lines */}
      {nodePoints.map((pt, i) => {
        const next = nodePoints[(i + 1) % nodePoints.length]
        return (
          <Line
            key={`line-${i}`}
            x1={pt.x} y1={pt.y}
            x2={next.x} y2={next.y}
            stroke={accentColor}
            strokeWidth={size * 0.008}
            strokeOpacity={0.2}
          />
        )
      })}

      {/* Constellation nodes */}
      {nodePoints.map((pt, i) => (
        <Circle
          key={`node-${i}`}
          cx={pt.x} cy={pt.y}
          r={size * 0.03}
          fill={accentColor}
          fillOpacity={0.6}
        />
      ))}

      {/* Inner ring */}
      <Circle
        cx={half} cy={half} r={innerR}
        stroke={accentColor}
        strokeWidth={size * 0.01}
        strokeOpacity={0.15}
        fill="none"
      />

      {/* Glow behind center */}
      {glow && (
        <Circle cx={half} cy={half} r={half * 0.35} fill="url(#centerGlow)" />
      )}

      {/* Center dot */}
      <Circle
        cx={half} cy={half}
        r={size * 0.065}
        fill={accentColor}
        fillOpacity={0.95}
      />
    </Svg>
  )

  return (
    <Animated.View
      style={{
        width: size,
        height: size,
        transform: [{ scale: bootScale }],
        opacity: bootOpacity,
      }}
    >
      {/* Outer ring — slow clockwise */}
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          transform: [{ rotate: spinOuter }],
        }}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Circle
            cx={half} cy={half} r={outerR}
            stroke={accentColor}
            strokeWidth={size * 0.015}
            strokeOpacity={0.3}
            fill="none"
            strokeDasharray={`${size * 0.15} ${size * 0.08}`}
          />
        </Svg>
      </Animated.View>

      {/* Orbital arc 1 — clockwise with 3D tilt */}
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          transform: [
            { perspective: 300 },
            { rotateX: '15deg' },
            { rotate: spin1 },
          ],
        }}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Path
            d={arcPath(half * 0.78, half * 0.38, 0.4)}
            stroke={accentColor}
            strokeWidth={size * 0.012}
            strokeOpacity={0.45}
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Orbital arc 2 — counter-clockwise with opposite tilt */}
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          transform: [
            { perspective: 300 },
            { rotateX: '-12deg' },
            { rotate: spin2 },
          ],
        }}
      >
        <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <Path
            d={arcPath(half * 0.70, half * 0.32, -1.1)}
            stroke={accentColor}
            strokeWidth={size * 0.01}
            strokeOpacity={0.3}
            fill="none"
          />
        </Svg>
      </Animated.View>

      {/* Core: constellation + center with pulse */}
      <Animated.View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          transform: [{ scale: pulseScale }],
          opacity: pulseOpacity,
        }}
      >
        {svgContent}
      </Animated.View>

      {/* Ambient glow layer */}
      {glow && (
        <Animated.View
          style={{
            position: 'absolute',
            width: size,
            height: size,
            opacity: glowPulse,
          }}
        >
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Circle cx={half} cy={half} r={half * 0.5} fill="url(#centerGlow)" />
          </Svg>
        </Animated.View>
      )}
    </Animated.View>
  )
}
