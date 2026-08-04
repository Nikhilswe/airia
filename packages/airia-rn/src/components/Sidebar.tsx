// AIrIA — Sidebar
// Glassmorphic drawer with conversation list, new-conversation button, and tier pill.

import React from 'react'
import {
  View,
  Text,
  Pressable,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native'
import type { Conversation, Tier } from '@airia/types'
import type { ThemeColors } from '@airia/ui'
import { THEMES } from '@airia/ui'

interface SidebarProps {
  conversations: Conversation[]
  activeId: string
  tier: Tier
  onSelectConversation: (id: string) => void
  onNewConversation: () => void
  theme?: ThemeColors
}

const TIER_ICON: Record<Tier, string> = {
  free:      '✦',
  local:     '⬡',
  cloud:     '☁',
  'on-device': '✦',
}

export function Sidebar({
  conversations,
  activeId,
  tier,
  onSelectConversation,
  onNewConversation,
  theme = THEMES.dawn,
}: SidebarProps) {
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.surface }]}>
      {/* Wordmark */}
      <View style={styles.top}>
        <Text style={[styles.wordmark, { color: theme.textPrimary }]}>
          AI<Text style={{ color: theme.accent }}>r</Text>IA
        </Text>

        <Pressable
          onPress={onNewConversation}
          style={({ pressed }) => [
            styles.newChatBtn,
            {
              borderColor: theme.surfaceBorder,
              backgroundColor: theme.accentLight,
              opacity: pressed ? 0.7 : 1,
              shadowColor: theme.accent,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="New conversation"
        >
          <Text style={[styles.newChatText, { color: theme.accent }]}>+ New conversation</Text>
        </Pressable>
      </View>

      {/* Conversation list */}
      <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionLabel, { color: theme.textTertiary }]}>RECENT</Text>
        {conversations.map(conv => {
          const active = conv.id === activeId
          return (
            <Pressable
              key={conv.id}
              onPress={() => onSelectConversation(conv.id)}
              style={({ pressed }) => [
                styles.convItem,
                active && {
                  backgroundColor: theme.accentLight,
                  borderColor: theme.accentBorder,
                  borderWidth: 1,
                },
                !active && { borderWidth: 1, borderColor: 'transparent' },
                pressed && { opacity: 0.7 },
              ]}
              accessibilityRole="button"
              accessibilityLabel={conv.title}
            >
              {active && <View style={[styles.activeIndicator, { backgroundColor: theme.accent }]} />}
              <Text
                numberOfLines={1}
                style={[
                  styles.convTitle,
                  { color: active ? theme.accentText : theme.textSecondary },
                ]}
              >
                {conv.title}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      {/* Footer tier pill */}
      <View style={[styles.bottom, { borderTopColor: theme.surfaceBorder }]}>
        <View style={[styles.tierPill, {
          backgroundColor: theme.bgCard,
          borderColor: theme.surfaceBorder,
        }]}>
          <View style={[styles.tierDot, { backgroundColor: theme.accent }]} />
          <Text style={[styles.tierText, { color: theme.accent }]}>
            {TIER_ICON[tier]} {tier}
          </Text>
        </View>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  top: {
    padding: 16,
    gap: 12,
  },
  wordmark: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1,
  },
  newChatBtn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 2,
  },
  newChatText: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 6,
    marginTop: 4,
    paddingHorizontal: 4,
  },
  convItem: {
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 10,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  activeIndicator: {
    width: 3,
    height: 16,
    borderRadius: 1.5,
  },
  convTitle: {
    fontSize: 13,
    flex: 1,
  },
  bottom: {
    padding: 16,
    borderTopWidth: 1,
  },
  tierPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 8,
    borderWidth: 1,
    paddingVertical: 6,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
  },
  tierDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  tierText: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
})
