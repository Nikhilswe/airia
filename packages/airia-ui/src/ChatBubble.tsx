// AIrIA — ChatBubble (MessageCard)
// No rounded pill bubbles. Structural rows with accent edge indicators.
// User: right-aligned with subtle surface shift.
// Assistant: full-width card with thin left accent rail.

import React from 'react'
import { View, Text, StyleSheet } from 'react-native'
import Markdown from 'react-native-markdown-display'
import type { FeedbackSignalType } from '@airia/types'
import type { ThemeColors } from './ThemeToken'
import { THEMES } from './ThemeToken'

interface ChatBubbleProps {
  role: 'user' | 'assistant'
  content: string
  feedbackSignal?: FeedbackSignalType
  theme?: ThemeColors
}

export function ChatBubble({
  role,
  content,
  theme = THEMES.dawn,
}: ChatBubbleProps) {
  const isAssistant = role === 'assistant'

  const markdownStyles = {
    body: {
      color: theme.textPrimary,
      fontSize: 14.5,
      lineHeight: 24,
      fontFamily: 'System',
    },
    code_inline: {
      backgroundColor: 'rgba(255,255,255,0.04)',
      color: theme.shock,
      fontFamily: 'Menlo',
      fontSize: 12.5,
      borderRadius: 3,
      paddingHorizontal: 5,
      paddingVertical: 1,
    },
    fence: {
      backgroundColor: theme.bg,
      borderRadius: 6,
      borderWidth: 1,
      borderColor: theme.surfaceBorder,
      padding: 14,
      marginVertical: 8,
    },
    code_block: {
      color: theme.textPrimary,
      fontFamily: 'Menlo',
      fontSize: 12,
      lineHeight: 19,
    },
    link: { color: theme.shock },
    strong: { color: theme.textPrimary, fontWeight: '600' as const },
    em: { color: theme.textSecondary },
    paragraph: { marginVertical: 4 },
  }

  if (isAssistant) {
    return (
      <View style={[styles.assistantRow, { borderColor: theme.surfaceBorder }]}>
        <View style={[styles.accentRail, { backgroundColor: theme.accent }]} />
        <View style={styles.assistantContent}>
          <Markdown style={markdownStyles}>{content}</Markdown>
        </View>
      </View>
    )
  }

  return (
    <View style={[styles.userRow, { backgroundColor: theme.bgCard, borderColor: theme.surfaceBorder }]}>
      <Text style={[styles.userText, { color: theme.textPrimary }]}>{content}</Text>
      <View style={[styles.userAccent, { backgroundColor: theme.shock }]} />
    </View>
  )
}

const styles = StyleSheet.create({
  assistantRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    paddingVertical: 16,
    paddingRight: 16,
  },
  accentRail: {
    width: 2,
    borderRadius: 1,
    marginRight: 14,
    opacity: 0.5,
  },
  assistantContent: {
    flex: 1,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    alignSelf: 'flex-end',
    maxWidth: '82%',
    borderWidth: 1,
    borderRadius: 4,
    paddingVertical: 10,
    paddingLeft: 14,
    paddingRight: 0,
    marginVertical: 4,
  },
  userText: {
    flex: 1,
    fontSize: 14.5,
    lineHeight: 22,
    paddingRight: 12,
  },
  userAccent: {
    width: 2,
    borderRadius: 1,
    opacity: 0.7,
  },
})
