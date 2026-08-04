// AIrIA — ModelDownloadPrompt
// Shown when on-device tier is active but the model isn't downloaded yet.
// User must explicitly tap "Download" — nothing downloads automatically.
// In production, modelUrl will point to CloudFront + S3.

import React from 'react'
import { View, Text, Pressable, StyleSheet } from 'react-native'
import type { ThemeColors } from '@airia/ui/src/ThemeToken'
import { THEMES } from '@airia/ui/src/ThemeToken'
import type { ModelEntry } from '../bridge/models'

interface ModelDownloadPromptProps {
  model: ModelEntry
  onDownload: () => void
  theme?: ThemeColors
}

function formatBytes(bytes: number): string {
  return `${Math.round(bytes / 1_000_000)} MB`
}

export function ModelDownloadPrompt({
  model,
  onDownload,
  theme = THEMES.dawn,
}: ModelDownloadPromptProps) {
  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.orbIcon, { color: theme.accent }]}>✦</Text>

      <Text style={[styles.title, { color: theme.textPrimary }]}>
        Download AI model
      </Text>

      <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
        AIrIA needs a local model to run without a server.{'\n'}
        This is a one-time download.
      </Text>

      <View style={[styles.card, { backgroundColor: theme.surfaceRaised, borderColor: theme.surfaceBorder }]}>
        <Text style={[styles.modelName, { color: theme.textPrimary }]}>{model.displayName}</Text>
        <Text style={[styles.modelMeta, { color: theme.textSecondary }]}>
          {formatBytes(model.sizeBytes)} · runs fully on-device · no internet needed after download
        </Text>
      </View>

      <Pressable
        onPress={onDownload}
        style={({ pressed }) => [
          styles.btn,
          { backgroundColor: theme.accent },
          pressed && { opacity: 0.85 },
        ]}
        accessibilityLabel="Download model"
        accessibilityRole="button"
      >
        <Text style={[styles.btnText, { color: theme.bg }]}>Download · {formatBytes(model.sizeBytes)}</Text>
      </Pressable>

      <Text style={[styles.hint, { color: theme.textTertiary }]}>
        Connect to Wi-Fi before downloading
      </Text>
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
  orbIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 6,
    marginVertical: 8,
  },
  modelName: {
    fontSize: 15,
    fontWeight: '600',
  },
  modelMeta: {
    fontSize: 13,
    lineHeight: 18,
  },
  btn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: {
    fontSize: 16,
    fontWeight: '700',
  },
  hint: {
    fontSize: 12,
    textAlign: 'center',
  },
})
