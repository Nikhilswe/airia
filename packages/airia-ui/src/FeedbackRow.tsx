// AIrIA — FeedbackRow
// Minimal inline action strip — no pills, no borders. Ghost buttons with shock glow on active.

import React from 'react'
import { View, Pressable, Text, StyleSheet } from 'react-native'
import type { FeedbackSignalType, RouteInfo } from '@airia/types'
import type { ThemeColors } from './ThemeToken'
import { THEMES } from './ThemeToken'

interface FeedbackRowProps {
  messageId: string
  feedbackSignal?: FeedbackSignalType
  onFeedback: (messageId: string, signal: FeedbackSignalType) => void
  theme?: ThemeColors
  modelUsed?: string
  routeInfo?: RouteInfo
  /** Offers the missing capability model when routing had to fall back. */
  onDownloadModel?: (modelId: string) => void
}

const CAPABILITY_ICONS: Record<RouteInfo['capability'], string> = {
  vision: '◉',
  code:   '‹›',
  reason: '◇',
}

const SIGNAL_LABELS: Record<FeedbackSignalType, string> = {
  thumb_up:   '▲',
  thumb_down: '▼',
  retry:      '↻',
  copy:       '⎘',
  edit:       '✎',
}

const SIGNALS: FeedbackSignalType[] = ['thumb_up', 'thumb_down', 'retry', 'copy']

export function FeedbackRow({
  messageId,
  feedbackSignal,
  onFeedback,
  theme = THEMES.dawn,
  modelUsed,
  routeInfo,
  onDownloadModel,
}: FeedbackRowProps) {
  const hasVoted = feedbackSignal === 'thumb_up' || feedbackSignal === 'thumb_down'
  const missing = routeInfo?.fallback === 'not-downloaded' ? routeInfo : undefined

  return (
    <View style={styles.wrap}>
      <View style={styles.strip}>
      {routeInfo && (
        <Text style={[styles.modelTag, { color: theme.textTertiary, borderColor: theme.surfaceBorder }]}>
          {CAPABILITY_ICONS[routeInfo.capability]} {routeInfo.capability}
        </Text>
      )}
      {modelUsed && (
        <Text style={[styles.modelTag, { color: theme.textTertiary, borderColor: theme.surfaceBorder }]}>
          {modelUsed}
        </Text>
      )}
      {SIGNALS.map(signal => {
        const isVoteBtn = signal === 'thumb_up' || signal === 'thumb_down'
        const isActive = feedbackSignal === signal
        if (isVoteBtn && hasVoted && !isActive) return null

        return (
          <Pressable
            key={signal}
            onPress={() => { if (!isActive) onFeedback(messageId, signal) }}
            disabled={isActive}
            accessibilityLabel={signal.replace('_', ' ')}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.btn,
              isActive && { backgroundColor: 'rgba(255,255,255,0.04)' },
              pressed && !isActive && { opacity: 0.5 },
            ]}
          >
            <Text style={[
              styles.icon,
              { color: isActive ? theme.shock : theme.textTertiary },
            ]}>
              {SIGNAL_LABELS[signal]}
            </Text>
          </Pressable>
        )
      })}
      </View>

      {missing && (
        <View style={[styles.fallbackNote, { borderColor: theme.surfaceBorder, backgroundColor: theme.bgCard }]}>
          <Text style={[styles.fallbackText, { color: theme.textTertiary }]}>
            Routed to <Text style={{ color: theme.shock }}>{missing.capability}</Text>, but{' '}
            {missing.requestedModel} isn’t downloaded — answered with {missing.actualModel}.
          </Text>
          {missing.requestedModelId && onDownloadModel && (
            <Pressable
              onPress={() => onDownloadModel(missing.requestedModelId!)}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.downloadBtn,
                { borderColor: theme.accentBorder },
                pressed && { opacity: 0.6 },
              ]}
            >
              <Text style={[styles.downloadText, { color: theme.accent }]}>
                Download {missing.requestedModel}
              </Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 8,
    marginLeft: 16,
  },
  strip: {
    flexDirection: 'row',
    gap: 2,
    alignItems: 'center',
  },
  fallbackNote: {
    marginTop: 6,
    marginRight: 16,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1,
    borderRadius: 6,
    gap: 6,
    alignItems: 'flex-start',
  },
  fallbackText: {
    fontSize: 11,
    lineHeight: 16,
  },
  downloadBtn: {
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  downloadText: {
    fontSize: 11,
    fontWeight: '600',
  },
  btn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 3,
  },
  icon: {
    fontSize: 12,
    fontFamily: 'Menlo',
  },
  modelTag: {
    fontSize: 9,
    fontFamily: 'Menlo',
    letterSpacing: 0.5,
    borderWidth: 1,
    borderRadius: 3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginRight: 4,
    alignSelf: 'center',
  },
})
