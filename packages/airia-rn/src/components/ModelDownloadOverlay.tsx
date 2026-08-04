// AIrIA — ModelDownloadOverlay
// Full-screen download progress overlay shown during initial model load.

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import { AiriaLogo } from '@airia/ui'
import type { ThemeColors } from '@airia/ui'
import { THEMES } from '@airia/ui'

interface ModelDownloadOverlayProps {
  progress: number   // 0–1
  text: string
  modelId: string
  theme?: ThemeColors
}

export function ModelDownloadOverlay({
  progress,
  text,
  modelId,
  theme = THEMES.dawn,
}: ModelDownloadOverlayProps) {
  const pct = Math.round(progress * 100)

  return (
    <View style={[styles.overlay, { backgroundColor: theme.bg }]}>
      <AiriaLogo size={72} animate accentColor={theme.accent} />

      <Text style={[styles.title, { color: theme.textPrimary }]}>
        Preparing AI model
      </Text>

      <Text style={[styles.modelId, { color: theme.textSecondary }]}>
        {modelId}
      </Text>

      <View style={[styles.barTrack, { backgroundColor: theme.surfaceRaised }]}>
        <View
          style={[
            styles.barFill,
            { width: `${pct}%` as `${number}%`, backgroundColor: theme.accent },
          ]}
        />
      </View>

      <Text style={[styles.pct, { color: theme.accent }]}>{pct}%</Text>

      {text ? (
        <Text style={[styles.statusText, { color: theme.textTertiary }]}>{text}</Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    paddingHorizontal: 32,
    zIndex: 100,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 16,
  },
  modelId: {
    fontSize: 13,
    fontFamily: 'monospace',
  },
  barTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    marginTop: 8,
    overflow: 'hidden',
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  pct: {
    fontSize: 15,
    fontWeight: '700',
  },
  statusText: {
    fontSize: 12,
    textAlign: 'center',
  },
})
