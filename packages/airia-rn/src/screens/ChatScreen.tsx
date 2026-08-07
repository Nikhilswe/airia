// AIrIA — ChatScreen
// Premium layered UI: structural message rows, glassmorphic header,
// shock accent indicators, floating input bar.

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Image,
  Keyboard,
  Platform,
  StyleSheet,
  Animated,
  Easing,
  Alert,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { FeedbackSignalType, Tier, AttachmentHint } from '@airia/types'
import * as ImagePicker from 'expo-image-picker'
import * as DocumentPicker from 'expo-document-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import { tierRouter } from '@airia/service'
import { OrbAvatar } from '@airia/ui/src/OrbAvatar'
import { ChatBubble } from '@airia/ui/src/ChatBubble'
import { FeedbackRow } from '@airia/ui/src/FeedbackRow'
import { AttachmentPreview } from '@airia/ui/src/AttachmentPreview'
import type { ThemeColors, ThemeName } from '@airia/ui/src/ThemeToken'
import { THEMES } from '@airia/ui/src/ThemeToken'
import { SettingsPanel } from '../components/SettingsPanel'
import Constants from 'expo-constants'
import { useChat } from '../hooks/useChat'
import { useModelSync } from '../hooks/useModelSync'
import { Sidebar } from '../components/Sidebar'
import { ModelDownloadOverlay } from '../components/ModelDownloadOverlay'
import { ModelDownloadPrompt } from '../components/ModelDownloadPrompt'
import { SyncOverlay } from '../components/SyncOverlay'
import { TypingIndicator } from '../components/TypingIndicator'
import { nativeBridge } from '../bridge/NativeAppBridgeImpl'
import { DEFAULT_MODEL_ID, getModel } from '../bridge/models'

function generateConversationId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

interface ChatScreenProps {
  theme: ThemeColors
  themeName: ThemeName
  onThemeChange: (name: ThemeName) => void
}

function StatusLight({ active, color }: { active: boolean; color: string }) {
  const pulse = useRef(new Animated.Value(1)).current
  useEffect(() => {
    if (!active) { pulse.setValue(1); return }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.3, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    )
    anim.start()
    return () => anim.stop()
  }, [active, pulse])

  return (
    <Animated.View style={{
      width: 6, height: 6, borderRadius: 3,
      backgroundColor: color,
      opacity: pulse,
      shadowColor: color,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.8,
      shadowRadius: 6,
    }} />
  )
}

export function ChatScreen({ theme = THEMES.dawn, themeName, onThemeChange }: ChatScreenProps) {
  const insets = useSafeAreaInsets()
  const [conversationId, setConversationId] = useState(() => generateConversationId())
  const [tier, setTier] = useState<Tier>('free')
  const [modelName, setModelName] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [modelDownloadState, setModelDownloadState] = useState<'idle' | 'prompt' | 'downloading' | 'ready'>('idle')
  const [downloadProgress, setDownloadProgress] = useState(0)
  const [downloadText, setDownloadText] = useState('')
  const [downloadModelId, setDownloadModelId] = useState(DEFAULT_MODEL_ID)
  const [trustLevel, setTrustLevel] = useState<0 | 1 | 2 | 3>(0)
  const [inputText, setInputText] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [attachments, setAttachments] = useState<AttachmentHint[]>([])
  const listRef = useRef<FlatList>(null)
  const inputRef = useRef<TextInput>(null)

  const {
    messages, isStreaming, streamingContent,
    sendMessage, cancelStream,
    conversations, loadConversation,
    error, dismissError, recordFeedback, retryMessage,
  } = useChat({ conversationId, tier })

  const { syncing, newModel, dismissSync } = useModelSync()

  useEffect(() => {
    const isNativeBuild = Constants.executionEnvironment !== 'storeClient'
    async function init() {
      if (isNativeBuild) {
        const config = await tierRouter.detect()
        setTier(config.tier)
        setModelName(config.modelName)
        if (config.tier !== 'on-device') return
        const modelId = DEFAULT_MODEL_ID
        setDownloadModelId(modelId)
        setModelName(getModel(modelId)?.displayName ?? modelId)
        const already = await nativeBridge.isModelDownloaded(modelId)
        if (already) {
          await nativeBridge.initModel(modelId)
          setModelDownloadState('ready')
        } else {
          setModelDownloadState('prompt')
        }
      } else {
        const metroHost = __DEV__ ? Constants.expoConfig?.hostUri?.split(':')[0] : undefined
        const hasStoredEndpoint = Boolean(tierRouter.getCustomOllamaEndpoint())
        const config = (metroHost && !hasStoredEndpoint)
          ? await tierRouter.setCustomOllamaEndpoint(`http://${metroHost}:11434`)
          : await tierRouter.detect()
        setTier(config.tier)
        setModelName(config.modelName)
      }
    }
    init().catch(console.error)
  }, [])

  // Keep the latest turn in view once the keyboard has finished opening.
  useEffect(() => {
    const onShow = Keyboard.addListener('keyboardDidShow', () => {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)
    })
    return () => onShow.remove()
  }, [])

  useEffect(() => {
    const count = conversations.length
    if (count >= 10)     setTrustLevel(3)
    else if (count >= 5) setTrustLevel(2)
    else if (count >= 1) setTrustLevel(1)
    else                 setTrustLevel(0)
  }, [conversations.length])

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50)
    }
  }, [messages, streamingContent])

  const handleSend = useCallback(async () => {
    const content = inputText.trim()
    if (!content || isStreaming) return
    setInputText('')
    const hints = [...attachments]
    setAttachments([])
    await sendMessage(content, hints.length > 0 ? hints : undefined)
  }, [inputText, isStreaming, sendMessage, attachments])

  const handlePickImage = useCallback(async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: false,
      quality: 0.8,
    })
    if (!result.canceled && result.assets.length > 0) {
      const asset = result.assets[0]
      // The vision model decodes with stb_image, which has no HEIC support and
      // chokes on very large images — normalise to a bounded JPEG up front.
      let uri = asset.uri
      try {
        const jpeg = await ImageManipulator.manipulateAsync(
          asset.uri,
          [{ resize: { width: 1024 } }],
          { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG }
        )
        uri = jpeg.uri
      } catch (err) {
        console.warn('Image conversion failed, using original:', err)
      }

      setAttachments(prev => [...prev, {
        type: 'image' as const,
        mimeType: 'image/jpeg',
        filename: asset.fileName ?? 'image.jpg',
        uri,
        sizeBytes: asset.fileSize,
      }])
    }
  }, [])

  const handlePickDocument = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      multiple: true,
      copyToCacheDirectory: true,
    })
    if (result.canceled) return
    setAttachments(prev => [...prev, ...result.assets.map(a => ({
      type: 'file' as const,
      mimeType: a.mimeType,
      filename: a.name,
      uri: a.uri,
      sizeBytes: a.size,
    }))])
  }, [])

  // The ⊕ button offers both sources; the router reads mime/extension off the
  // resulting hints to decide which model handles the turn.
  const handleAttach = useCallback(() => {
    Alert.alert('Add attachment', undefined, [
      { text: 'Photo', onPress: () => { handlePickImage().catch(console.error) } },
      { text: 'Document', onPress: () => { handlePickDocument().catch(console.error) } },
      { text: 'Cancel', style: 'cancel' },
    ])
  }, [handlePickImage, handlePickDocument])

  const handleFeedback = useCallback(
    async (messageId: string, signal: FeedbackSignalType) => {
      const msg = messages.find(m => m.id === messageId)
      if (!msg) return
      if (signal === 'retry') { await retryMessage(messageId); return }
      await recordFeedback(messageId, signal, msg.content)
    },
    [messages, retryMessage, recordFeedback]
  )

  const startModelDownload = useCallback(() => {
    setModelDownloadState('downloading')
    nativeBridge.downloadModel(downloadModelId, (progress, text) => {
      setDownloadProgress(progress)
      setDownloadText(text)
    }).then(() => setModelDownloadState('ready'))
      .catch(err => {
        console.error('Model download failed:', err)
        setModelDownloadState('prompt')
      })
  }, [downloadModelId])

  // Fetch a capability model the router wanted but couldn't find on disk.
  // Once it lands, the next matching turn hot-swaps to it automatically.
  const handleDownloadModel = useCallback((modelId: string) => {
    setDownloadModelId(modelId)
    setDownloadProgress(0)
    setDownloadText('')
    setModelDownloadState('downloading')
    nativeBridge.downloadModel(modelId, (progress, text) => {
      setDownloadProgress(progress)
      setDownloadText(text)
    }).then(() => setModelDownloadState('ready'))
      .catch(err => {
        console.error(`Model download failed (${modelId}):`, err)
        setModelDownloadState('ready')
      })
  }, [])

  const startNewConversation = useCallback(() => {
    setConversationId(generateConversationId())
    setSidebarOpen(false)
  }, [])

  const currentConv = conversations.find(c => c.id === conversationId)

  const renderMessage = useCallback(
    ({ item: msg }: { item: (typeof messages)[number] }) => {
      const isAssistant = msg.role === 'assistant'
      const isTypingPlaceholder = msg.id === '__streaming__' && !streamingContent
      return (
        <View style={styles.messageRow}>
          {isTypingPlaceholder ? (
            <View style={[styles.typingRow, { borderColor: theme.surfaceBorder }]}>
              <View style={[styles.typingRail, { backgroundColor: theme.accent }]} />
              <TypingIndicator theme={theme} />
            </View>
          ) : (
            <>
              {msg.attachments?.length ? (
                <AttachmentPreview
                  attachments={msg.attachments}
                  theme={theme}
                  align={msg.role === 'user' ? 'right' : 'left'}
                />
              ) : null}
              <ChatBubble role={msg.role} content={msg.content} feedbackSignal={msg.feedbackSignal} theme={theme} />
              {isAssistant && !isTypingPlaceholder && (
                <FeedbackRow
                  messageId={msg.id}
                  feedbackSignal={msg.feedbackSignal}
                  onFeedback={handleFeedback}
                  theme={theme}
                  modelUsed={msg.modelUsed}
                  routeInfo={msg.routeInfo}
                  onDownloadModel={handleDownloadModel}
                />
              )}
            </>
          )}
        </View>
      )
    },
    [trustLevel, theme, handleFeedback, streamingContent]
  )

  const sidebar = (
    <Sidebar
      conversations={conversations}
      activeId={conversationId}
      tier={tier}
      onSelectConversation={id => {
        setConversationId(id)
        loadConversation(id)
        setSidebarOpen(false)
      }}
      onNewConversation={startNewConversation}
      theme={theme}
    />
  )

  const streamingItem = isStreaming
    ? [{ id: '__streaming__', role: 'assistant' as const, content: streamingContent || '…', conversationId, timestamp: Date.now() }]
    : []
  const allItems = [...messages, ...streamingItem]

  const friendlyError = error
    ? error.replace(/fetch failed:.*ConnectException.*Failed to connect to [^\s]+/i,
        'Unable to reach AIrIA server. Check your connection or server status.')
        .replace(/fetch failed:/i, 'Network error —')
        .slice(0, 120)
    : null

  const modelReady = modelDownloadState === 'ready'
  const statusColor = modelReady ? '#34D399' : isStreaming ? theme.shock : theme.textTertiary
  const inputDisabled = isStreaming || (tier === 'on-device' && modelDownloadState !== 'ready')

  return (
    <View style={[styles.screen, { backgroundColor: theme.bg, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Sidebar */}
      {/* The dismiss-on-tap backdrop sits *behind* the panel rather than
          wrapping it — a Pressable ancestor swallows the pan gesture, which
          left the scrollable panels unscrollable on Android. */}
      <Modal visible={sidebarOpen} transparent animationType="slide" onRequestClose={() => setSidebarOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSidebarOpen(false)} accessibilityLabel="Close menu" />
          <View style={[styles.sidebarContainer, { backgroundColor: theme.surface }]}>
            {sidebar}
          </View>
        </View>
      </Modal>

      {/* Settings */}
      <Modal visible={settingsOpen} transparent animationType="slide" onRequestClose={() => setSettingsOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSettingsOpen(false)} accessibilityLabel="Close settings" />
          <SettingsPanel
            theme={theme} themeName={themeName} onThemeChange={onThemeChange}
            tier={tier} onClose={() => setSettingsOpen(false)}
            onTierConfigChanged={config => { setTier(config.tier); setModelName(config.modelName) }}
          />
        </View>
      </Modal>

      {/* Header — glassmorphic bar */}
      <View style={[styles.header, { backgroundColor: theme.surface, borderBottomColor: theme.surfaceBorder }]}>
        <Pressable onPress={() => setSidebarOpen(true)} style={styles.headerBtn} accessibilityLabel="Open menu" hitSlop={8}>
          <Text style={[styles.headerBtnIcon, { color: theme.textTertiary }]}>≡</Text>
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]} numberOfLines={1}>
            {currentConv?.title ?? 'New conversation'}
          </Text>
          <View style={styles.statusRow}>
            <StatusLight active={isStreaming} color={statusColor} />
            <Text style={[styles.statusLabel, { color: theme.textTertiary }]} numberOfLines={1}>
              {modelReady ? modelName
                : modelDownloadState === 'downloading' ? 'downloading…'
                : modelDownloadState === 'prompt' ? 'model required'
                : modelName || 'detecting…'}
            </Text>
          </View>
        </View>

        <OrbAvatar trustLevel={trustLevel} animating={isStreaming} size={28} theme={theme} />

        <Pressable onPress={() => setSettingsOpen(true)} style={styles.headerBtn} accessibilityLabel="Open settings" hitSlop={8}>
          <Text style={[styles.headerBtnIcon, { color: theme.textTertiary }]}>⚙</Text>
        </Pressable>
      </View>

      {/* Model prompts */}
      {modelDownloadState === 'prompt' && (
        <ModelDownloadPrompt
          model={getModel(downloadModelId) ?? { id: downloadModelId, displayName: downloadModelId, description: '', sizeBytes: 800_000_000, url: '', nCtx: 4096, nThreads: 4, minRamGB: 2, capability: 'reason' }}
          onDownload={startModelDownload}
          theme={theme}
        />
      )}
      {modelDownloadState === 'downloading' && (
        <ModelDownloadOverlay progress={downloadProgress} text={downloadText} modelId={downloadModelId} theme={theme} />
      )}
      {syncing && newModel && <SyncOverlay newModel={newModel} onDismiss={dismissSync} theme={theme} />}

      {/* Message stream + input */}
      {modelDownloadState !== 'prompt' && modelDownloadState !== 'downloading' && (
        <KeyboardAvoidingView
          style={styles.flex}
          // Android lifts the window itself via softwareKeyboardLayoutMode:
          // "pan" — under edge-to-edge the keyboard is folded into the safe-area
          // bottom inset, so doing the arithmetic here as well cancels the lift.
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <FlatList
            ref={listRef}
            data={allItems}
            keyExtractor={item => item.id}
            renderItem={renderMessage}
            contentContainerStyle={[styles.messageList, { paddingBottom: 16 }]}
            keyboardShouldPersistTaps="handled"
            ListEmptyComponent={
              !isStreaming ? (
                <View style={styles.emptyState}>
                  <View style={[styles.emptyDot, { backgroundColor: theme.shock, shadowColor: theme.shock }]} />
                  <Text style={[styles.emptyText, { color: theme.textTertiary }]}>
                    What's on your mind?
                  </Text>
                </View>
              ) : null
            }
          />

          {friendlyError && (
            <View style={[styles.errorBar, { backgroundColor: theme.bgCard, borderColor: theme.surfaceBorder }]}>
              <View style={[styles.errorAccent, { backgroundColor: '#e5484d' }]} />
              <Text style={[styles.errorText, { color: theme.textPrimary }]}>{friendlyError}</Text>
              <Pressable onPress={dismissError} hitSlop={12} accessibilityLabel="Dismiss error">
                <Text style={{ color: theme.textTertiary, fontSize: 14 }}>✕</Text>
              </Pressable>
            </View>
          )}

          {/* Attachment preview */}
          {attachments.length > 0 && (
            <View style={[styles.attachmentBar, { backgroundColor: theme.bgCard, borderColor: theme.surfaceBorder }]}>
              {attachments.map((att, i) => (
                <View key={i} style={[styles.attachmentChip, { borderColor: theme.accentBorder, backgroundColor: theme.bgFloat }]}>
                  {att.type === 'image' && att.uri ? (
                    <Image source={{ uri: att.uri }} style={styles.chipThumb} />
                  ) : null}
                  <Text style={[styles.attachmentChipText, { color: theme.accent }]}>
                    {att.type === 'image' && att.uri ? '' : att.type === 'image' ? '🖼 ' : '📄 '}
                    {att.filename ?? att.type}
                  </Text>
                  <Pressable onPress={() => setAttachments(prev => prev.filter((_, j) => j !== i))} hitSlop={6}>
                    <Text style={{ color: theme.textTertiary, fontSize: 12 }}>✕</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}

          {/* Input bar — fixed at bottom */}
          <View style={[styles.inputBar, {
            backgroundColor: theme.bgCard,
            borderTopColor: theme.surfaceBorder,
            borderColor: inputFocused ? theme.accentBorder : theme.surfaceBorder,
          }]}>
            <Pressable
              onPress={handleAttach}
              style={styles.attachBtn}
              accessibilityLabel="Attach image"
              hitSlop={6}
            >
              <Text style={{ color: attachments.length > 0 ? theme.accent : theme.textTertiary, fontSize: 18 }}>⊕</Text>
            </Pressable>
            <TextInput
              ref={inputRef}
              style={[styles.input, { color: theme.textPrimary }]}
              value={inputText}
              onChangeText={setInputText}
              placeholder={inputDisabled && !isStreaming ? 'Download a model first…' : 'Message AIrIA…'}
              placeholderTextColor={theme.textTertiary}
              multiline
              editable={!inputDisabled}
              accessibilityLabel="Message input"
              returnKeyType="send"
              onSubmitEditing={handleSend}
              blurOnSubmit={false}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
            />
            <Pressable
              style={[styles.sendBtn, {
                backgroundColor: isStreaming ? theme.accentDark : (inputText.trim() ? theme.shock : 'rgba(255,255,255,0.04)'),
                shadowColor: inputText.trim() && !isStreaming ? theme.shock : 'transparent',
              }]}
              onPress={isStreaming ? cancelStream : handleSend}
              accessibilityLabel={isStreaming ? 'Cancel' : 'Send'}
              hitSlop={4}
            >
              <Text style={[styles.sendIcon, { color: isStreaming || inputText.trim() ? theme.bg : theme.textTertiary }]}>
                {isStreaming ? '■' : '↑'}
              </Text>
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  modalRoot: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    flexDirection: 'row',
  },
  sidebarContainer: { width: 280, height: '100%' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    gap: 8,
  },
  headerBtn: { padding: 6 },
  headerBtnIcon: { fontSize: 20 },
  headerCenter: { flex: 1, gap: 2 },
  headerTitle: { fontSize: 14, fontWeight: '600', letterSpacing: 0.2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statusLabel: { fontSize: 10, fontFamily: 'Menlo', letterSpacing: 0.3 },

  messageList: { paddingHorizontal: 16, paddingTop: 8, flexGrow: 1 },
  messageRow: {},
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    paddingVertical: 14,
  },
  typingRail: { width: 2, height: 20, borderRadius: 1, marginRight: 14, opacity: 0.5 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 100, gap: 16 },
  emptyDot: {
    width: 8, height: 8, borderRadius: 4,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 10,
  },
  emptyText: { fontSize: 14, fontFamily: 'Menlo', letterSpacing: 0.5 },

  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 6,
    borderWidth: 1,
    borderRadius: 4,
    overflow: 'hidden',
    gap: 8,
    paddingRight: 10,
  },
  errorAccent: { width: 3, alignSelf: 'stretch' },
  errorText: { flex: 1, fontSize: 12, fontFamily: 'Menlo', paddingVertical: 8, paddingLeft: 8 },

  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderWidth: 1,
    borderBottomWidth: 0,
    marginHorizontal: 0,
    gap: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    maxHeight: 120,
    paddingVertical: 6,
    paddingHorizontal: 4,
    fontFamily: 'System',
  },
  sendBtn: {
    width: 32, height: 32, borderRadius: 4,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 3,
  },
  sendIcon: { fontSize: 14, fontWeight: '700' },
  attachBtn: {
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  attachmentBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  attachmentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipThumb: {
    width: 20,
    height: 20,
    borderRadius: 3,
    marginRight: 6,
  },
  attachmentChipText: {
    fontSize: 11,
    fontFamily: 'Menlo',
  },
})
