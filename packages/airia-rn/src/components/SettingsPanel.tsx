// AIrIA — SettingsPanel
// Glassmorphic settings drawer with interactive theme cards,
// frosted surface, and polished model management.

import React, { useEffect, useState, useCallback } from 'react'
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet, ActivityIndicator, Animated } from 'react-native'
import type { Tier, MetricsSummary } from '@airia/types'
import { tierRouter, MIN_PAIRS_THRESHOLD } from '@airia/service'
import { getFeedbackCount, getMetricsSummary } from '@airia/db'
import type { ThemeColors, ThemeName } from '@airia/ui/src/ThemeToken'
import { THEMES } from '@airia/ui/src/ThemeToken'
import { MODEL_REGISTRY, isModelOnDisk, type ModelEntry } from '../bridge/models'
import { getNativeAppBridge } from '@airia/service'

const THEME_NAMES = Object.keys(THEMES) as ThemeName[]
const PERIODS = [7, 30, 90]

function pct(rate: number): string { return `${Math.round(rate * 100)}%` }
function ms(n: number): string { return n < 1000 ? `${n}ms` : `${(n / 1000).toFixed(1)}s` }

interface SettingsPanelProps {
  theme: ThemeColors
  themeName: ThemeName
  onThemeChange: (name: ThemeName) => void
  tier: Tier
  onClose: () => void
  onTierConfigChanged: (config: { tier: Tier; modelName: string }) => void
}

function GlowOrb({ color, active }: { color: string; active: boolean }) {
  const scale = React.useRef(new Animated.Value(active ? 1 : 0.8)).current
  const opacity = React.useRef(new Animated.Value(active ? 0.5 : 0)).current

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: active ? 1.2 : 0.8, damping: 15, stiffness: 100, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: active ? 0.5 : 0, duration: 300, useNativeDriver: true }),
    ]).start()
  }, [active, scale, opacity])

  return (
    <Animated.View style={{
      position: 'absolute',
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: color,
      opacity,
      transform: [{ scale }],
    }} />
  )
}

export function SettingsPanel({
  theme, themeName, onThemeChange, tier, onClose, onTierConfigChanged,
}: SettingsPanelProps) {
  const [endpoint, setEndpoint] = useState(tierRouter.getCustomOllamaEndpoint())
  const [endpointError, setEndpointError] = useState<string | null>(null)
  const [feedbackCount, setFeedbackCount] = useState(0)
  const [period, setPeriod] = useState(7)
  const [summary, setSummary] = useState<MetricsSummary | null>(null)
  const [modelStates, setModelStates] = useState<Record<string, 'unknown' | 'available' | 'downloading' | 'ready'>>({})
  const [downloadProgress, setDownloadProgress] = useState<Record<string, number>>({})
  const [downloadError, setDownloadError] = useState<Record<string, string>>({})
  const [activeModelId, setActiveModelId] = useState<string | null>(null)
  const [expandedModelId, setExpandedModelId] = useState<string | null>(null)

  useEffect(() => {
    getFeedbackCount().then(setFeedbackCount).catch(console.error)
  }, [])

  useEffect(() => {
    getMetricsSummary(period).then(setSummary).catch(console.error)
  }, [period])

  useEffect(() => {
    async function checkModels() {
      const states: Record<string, 'available' | 'ready'> = {}
      for (const m of MODEL_REGISTRY) {
        states[m.id] = (await isModelOnDisk(m.id)) ? 'ready' : 'available'
      }
      setModelStates(states)
      const ready = MODEL_REGISTRY.find(m => states[m.id] === 'ready')
      if (ready) setActiveModelId(ready.id)
    }
    checkModels().catch(console.error)
  }, [])

  const handleModelDownload = useCallback(async (model: ModelEntry) => {
    setModelStates(prev => ({ ...prev, [model.id]: 'downloading' }))
    setDownloadProgress(prev => ({ ...prev, [model.id]: 0 }))
    setDownloadError(prev => ({ ...prev, [model.id]: '' }))
    try {
      await getNativeAppBridge().downloadModel(model.id, (progress) => {
        setDownloadProgress(prev => ({ ...prev, [model.id]: progress }))
      })
      setModelStates(prev => ({ ...prev, [model.id]: 'ready' }))
    } catch (err) {
      // Swallowing this left the button reverting to "Download" with no
      // explanation, which reads as the button simply not working.
      console.error(`Download failed for ${model.id}:`, err)
      setDownloadError(prev => ({ ...prev, [model.id]: (err as Error).message }))
      setModelStates(prev => ({ ...prev, [model.id]: 'available' }))
    }
  }, [])

  const handleModelSwitch = useCallback(async (model: ModelEntry) => {
    try {
      await getNativeAppBridge().initModel(model.id)
      setActiveModelId(model.id)
      onTierConfigChanged({ tier: 'on-device', modelName: model.displayName })
    } catch (err) {
      console.error('Failed to switch model:', err)
    }
  }, [onTierConfigChanged])

  const saveEndpoint = useCallback(async (value: string) => {
    try {
      setEndpointError(null)
      const config = await tierRouter.setCustomOllamaEndpoint(value.trim())
      onTierConfigChanged({ tier: config.tier, modelName: config.modelName })
    } catch (err) {
      setEndpointError(err instanceof Error ? err.message : String(err))
    }
  }, [onTierConfigChanged])

  const label = { color: theme.textTertiary, fontSize: 10, fontWeight: '600' as const, letterSpacing: 1.5 }

  return (
    <View style={[styles.panel, {
      backgroundColor: theme.bgCard,
      borderLeftColor: theme.surfaceBorder,
    }]}>
      {/* Frosted header */}
      <View style={[styles.header, { borderBottomColor: theme.surfaceBorder }]}>
        <Text style={{ color: theme.textPrimary, fontSize: 16, fontWeight: '600', letterSpacing: 0.5 }}>Settings</Text>
        <Pressable onPress={onClose} accessibilityLabel="Close settings" hitSlop={12}>
          <Text style={{ color: theme.textTertiary, fontSize: 18 }}>✕</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Theme cards */}
        <Text style={label}>THEME</Text>
        <View style={styles.themeGrid}>
          {THEME_NAMES.map(name => {
            const t = THEMES[name]
            const selected = name === themeName
            return (
              <Pressable
                key={name}
                onPress={() => onThemeChange(name)}
                accessibilityLabel={`Theme ${name}`}
                style={[
                  styles.themeCard,
                  {
                    borderColor: selected ? t.accent : theme.surfaceBorder,
                    backgroundColor: selected ? t.surface : 'rgba(255,255,255,0.02)',
                    shadowColor: selected ? t.accent : 'transparent',
                    shadowOpacity: selected ? 0.3 : 0,
                    shadowRadius: selected ? 12 : 0,
                    shadowOffset: { width: 0, height: 0 },
                    elevation: selected ? 6 : 0,
                  },
                ]}
              >
                <View style={styles.themeOrbWrap}>
                  <GlowOrb color={t.accent} active={selected} />
                  <View style={[styles.themeOrb, { backgroundColor: t.accent }]} />
                </View>
                <Text style={{
                  color: selected ? t.accent : theme.textSecondary,
                  fontSize: 11,
                  fontWeight: selected ? '600' : '400',
                  letterSpacing: 0.5,
                  textTransform: 'uppercase',
                }}>
                  {name}
                </Text>
              </Pressable>
            )
          })}
        </View>

        {/* Tier */}
        <Text style={[label, styles.sectionGap]}>TIER</Text>
        <View style={[styles.infoPill, { backgroundColor: theme.bgCard, borderColor: theme.surfaceBorder }]}>
          <View style={[styles.tierDot, { backgroundColor: theme.accent }]} />
          <Text style={{ color: theme.accent, fontSize: 13, fontWeight: '600', letterSpacing: 0.3 }}>{tier}</Text>
          <Text style={{ color: theme.textTertiary, fontSize: 11, marginLeft: 'auto' }}>active</Text>
        </View>

        {/* Ollama endpoint */}
        <Text style={[label, styles.sectionGap]}>OLLAMA ENDPOINT</Text>
        <Text style={{ color: theme.textTertiary, fontSize: 11, marginBottom: 6, lineHeight: 16 }}>
          Point to your Mac running Ollama on the same WiFi.
        </Text>
        <TextInput
          value={endpoint}
          onChangeText={setEndpoint}
          onBlur={() => { void saveEndpoint(endpoint) }}
          placeholder="http://192.168.x.x:11434"
          placeholderTextColor={theme.textTertiary}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          style={[styles.input, {
            color: theme.textPrimary,
            borderColor: endpointError ? '#e5484d' : theme.surfaceBorder,
            backgroundColor: 'rgba(255,255,255,0.03)',
          }]}
        />
        {endpointError && (
          <Text style={{ color: '#e5484d', fontSize: 11, marginTop: 4 }}>{endpointError}</Text>
        )}

        {/* Training */}
        <Text style={[label, styles.sectionGap]}>TRAINING</Text>
        <View style={[styles.infoPill, { backgroundColor: theme.bgCard, borderColor: theme.surfaceBorder }]}>
          <Text style={{ color: theme.textSecondary, fontSize: 12 }}>Feedback signals</Text>
          <Text style={{
            color: feedbackCount >= MIN_PAIRS_THRESHOLD ? theme.accent : theme.textSecondary,
            fontSize: 12, fontWeight: '600', marginLeft: 'auto',
          }}>
            {feedbackCount} / {MIN_PAIRS_THRESHOLD}
          </Text>
        </View>
        <Text style={{ color: theme.textTertiary, fontSize: 11, marginTop: 4 }}>
          Fine-tuning runs on the desktop app for now.
        </Text>

        {/* Metrics */}
        <Text style={[label, styles.sectionGap]}>METRICS</Text>
        <View style={styles.periodRow}>
          {PERIODS.map(p => (
            <Pressable
              key={p}
              onPress={() => setPeriod(p)}
              style={[styles.periodBtn, {
                borderColor: period === p ? theme.accent : 'rgba(255,255,255,0.06)',
                backgroundColor: period === p ? theme.accentLight : 'rgba(255,255,255,0.02)',
              }]}
            >
              <Text style={{ color: period === p ? theme.accent : theme.textTertiary, fontSize: 11, fontWeight: '500' }}>{p}d</Text>
            </Pressable>
          ))}
        </View>
        {!summary || summary.totalMessages === 0 ? (
          <Text style={{ color: theme.textTertiary, fontSize: 11 }}>
            No data yet — start chatting to see metrics.
          </Text>
        ) : (
          <View style={[styles.metricsCard, { backgroundColor: theme.bg, borderColor: theme.surfaceBorder }]}>
            <MetricRow theme={theme} labelText="Messages" value={String(summary.totalMessages)} />
            <MetricRow theme={theme} labelText="Thumbs up" value={pct(summary.thumbUpRate)} good />
            <MetricRow theme={theme} labelText="Thumbs down" value={pct(summary.thumbDownRate)} warn={summary.thumbDownRate > 0.2} />
            <MetricRow theme={theme} labelText="Retries" value={pct(summary.retryRate)} warn={summary.retryRate > 0.2} />
            <MetricRow theme={theme} labelText="Avg latency" value={ms(summary.avgLatencyMs)} />
            <MetricRow theme={theme} labelText="Tokens/sec" value={String(summary.avgTokensPerSecond)} />
            <MetricRow theme={theme} labelText="Uncertainty" value={pct(summary.uncertaintyRate)} warn={summary.uncertaintyRate > 0.2} />
            <MetricRow theme={theme} labelText="Contradiction" value={pct(summary.contradictionRate)} warn={summary.contradictionRate > 0.2} />
          </View>
        )}

        {/* Models */}
        <Text style={[label, styles.sectionGap]}>MODELS</Text>
        <Text style={{ color: theme.textTertiary, fontSize: 11, marginBottom: 8 }}>
          Download and switch between on-device models.
        </Text>
        {MODEL_REGISTRY.map(model => {
          const state = modelStates[model.id] ?? 'unknown'
          const isActive = model.id === activeModelId
          const progress = downloadProgress[model.id] ?? 0
          const sizeMB = Math.round(model.sizeBytes / 1_000_000)
          return (
            <View key={model.id} style={[styles.modelCard, {
              borderColor: isActive ? theme.accent : 'rgba(255,255,255,0.06)',
              backgroundColor: isActive ? theme.accentLight : 'rgba(255,255,255,0.02)',
              shadowColor: isActive ? theme.accent : 'transparent',
              shadowOpacity: isActive ? 0.15 : 0,
              shadowRadius: isActive ? 8 : 0,
              shadowOffset: { width: 0, height: 0 },
            }]}>
              <View style={styles.modelInfo}>
                <View style={styles.modelNameRow}>
                  <Text style={{ color: theme.textPrimary, fontSize: 13, fontWeight: '600', flex: 1, letterSpacing: 0.2 }}>
                    {model.displayName}
                  </Text>
                  <Pressable
                    onPress={() => setExpandedModelId(expandedModelId === model.id ? null : model.id)}
                    hitSlop={8}
                    style={[styles.infoBtn, {
                      borderColor: expandedModelId === model.id ? theme.accent : theme.textTertiary,
                      backgroundColor: expandedModelId === model.id ? theme.accentLight : 'transparent',
                    }]}
                  >
                    <Text style={{ color: expandedModelId === model.id ? theme.accent : theme.textTertiary, fontSize: 10, fontWeight: '700' }}>i</Text>
                  </Pressable>
                </View>
                {expandedModelId === model.id && (
                  <Text style={{ color: theme.textSecondary, fontSize: 11, marginTop: 4, lineHeight: 16 }}>
                    {model.description}
                  </Text>
                )}
                <View style={styles.modelTags}>
                  <Text style={[styles.modelTag, { color: theme.textTertiary, borderColor: theme.surfaceBorder }]}>
                    {sizeMB}MB
                  </Text>
                  <Text style={[styles.modelTag, { color: theme.textTertiary, borderColor: theme.surfaceBorder }]}>
                    {model.nCtx}ctx
                  </Text>
                  <Text style={[styles.modelTag, { color: theme.textTertiary, borderColor: theme.surfaceBorder }]}>
                    {model.minRamGB}GB+
                  </Text>
                </View>
                {downloadError[model.id] ? (
                  <Text style={[styles.modelError, { color: theme.shock }]}>
                    Download failed — {downloadError[model.id]}
                  </Text>
                ) : null}
              </View>
              <View style={styles.modelAction}>
                {state === 'downloading' ? (
                  <View style={styles.modelDownloading}>
                    <ActivityIndicator size="small" color={theme.accent} />
                    <Text style={{ color: theme.accent, fontSize: 10, fontWeight: '500' }}>{Math.round(progress * 100)}%</Text>
                  </View>
                ) : state === 'ready' ? (
                  isActive ? (
                    <View style={[styles.activeBadge, { backgroundColor: theme.accentLight, borderColor: theme.accentBorder }]}>
                      <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: '#34D399' }} />
                      <Text style={{ color: theme.accent, fontSize: 10, fontWeight: '600' }}>Active</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => handleModelSwitch(model)}
                      style={[styles.modelBtn, { borderColor: theme.accent }]}
                    >
                      <Text style={{ color: theme.accent, fontSize: 10, fontWeight: '600' }}>Use</Text>
                    </Pressable>
                  )
                ) : (
                  <Pressable
                    onPress={() => handleModelDownload(model)}
                    style={[styles.modelBtn, { borderColor: theme.accent }]}
                  >
                    <Text style={{ color: theme.accent, fontSize: 10, fontWeight: '600' }}>Download</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )
        })}
      </ScrollView>
    </View>
  )
}

function MetricRow({ theme, labelText, value, good, warn }: {
  theme: ThemeColors; labelText: string; value: string; good?: boolean; warn?: boolean
}) {
  return (
    <View style={styles.metricRow}>
      <Text style={{ color: theme.textTertiary, fontSize: 12 }}>{labelText}</Text>
      <Text style={{
        color: good ? theme.accent : warn ? '#e5484d' : theme.textPrimary,
        fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'],
      }}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  panel: {
    position: 'absolute',
    top: 0, right: 0, bottom: 0,
    width: 300,
    borderLeftWidth: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  content: { padding: 16, paddingBottom: 48 },
  sectionGap: { marginTop: 24 },
  themeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  themeCard: {
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    width: 84,
  },
  themeOrbWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  themeOrb: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  infoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  tierDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
  },
  periodRow: { flexDirection: 'row', gap: 8, marginVertical: 8 },
  periodBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  metricsCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  modelCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 10,
    marginBottom: 8,
    elevation: 2,
  },
  modelInfo: { flex: 1 },
  modelError: { fontSize: 10, lineHeight: 14, marginTop: 6 },
  modelNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modelTags: { flexDirection: 'row', gap: 4, marginTop: 4 },
  modelTag: {
    fontSize: 10,
    fontWeight: '500',
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    fontVariant: ['tabular-nums'],
  },
  infoBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelAction: { marginLeft: 8 },
  modelDownloading: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modelBtn: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
})
