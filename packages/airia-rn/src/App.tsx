import React, { useState, useEffect, useCallback, Component } from 'react'
import { View, Text, ScrollView } from 'react-native'
import { NavigationContainer } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { fetch as expoFetch } from 'expo/fetch'
import Constants from 'expo-constants'
import { setNativeAppBridge, setOllamaFetch, tierRouter } from '@airia/service'
import { ExpoGoStubBridge } from './bridge/ExpoGoStubBridge'
import { nativeBridge } from './bridge/NativeAppBridgeImpl'
import { ChatScreen } from './screens/ChatScreen'
import { OnboardingScreen } from './screens/OnboardingScreen'
import { THEMES } from './theme'
import type { ThemeName } from './theme'
import { getSetting, setSetting } from './db/rnDb'
import { createTierStorage } from './db/tierStorage'

const THEME_SETTING_KEY = 'themeName'

// Expo Go can't load llama.rn native bindings — use the stub there.
// An EAS dev-client / production build gets the real implementation.
const isExpoGo = Constants.executionEnvironment === 'storeClient'
const bridge = isExpoGo ? new ExpoGoStubBridge() : nativeBridge
setNativeAppBridge(bridge)
tierRouter.setOnDeviceCheck(async () => {
  try {
    return (await bridge.getDeviceInfo()).supportsOnDevice
  } catch {
    return false
  }
})
// RN's built-in fetch can't stream response bodies; expo/fetch can.
setOllamaFetch(expoFetch as unknown as typeof fetch)

class ErrorBoundary extends Component<{ children: React.ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: '#111', padding: 24, paddingTop: 60 }}>
          <Text style={{ color: '#F5A623', fontSize: 18, fontWeight: '700', marginBottom: 12 }}>
            AIrIA crashed on startup
          </Text>
          <ScrollView>
            <Text style={{ color: '#fff', fontSize: 13, fontFamily: 'Courier' }}>
              {(this.state.error as Error).message}{'\n\n'}
              {(this.state.error as Error).stack}
            </Text>
          </ScrollView>
        </View>
      )
    }
    return this.props.children
  }
}

export type RootStackParamList = {
  Onboarding: undefined
  Chat: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

export default function App() {
  const [themeName, setThemeName] = useState<ThemeName>('dawn')
  const [tierStorageReady, setTierStorageReady] = useState(false)
  const theme = THEMES[themeName]

  useEffect(() => {
    getSetting(THEME_SETTING_KEY).then(saved => {
      if (saved && saved in THEMES) setThemeName(saved as ThemeName)
    }).catch(console.error)
  }, [])

  useEffect(() => {
    // Must finish before ChatScreen's effect calls tierRouter.detect(), or
    // the persisted endpoint/tier config won't be there yet to read.
    createTierStorage()
      .then(storage => tierRouter.setStorage(storage))
      .catch(console.error)
      .finally(() => setTierStorageReady(true))
  }, [])

  const handleThemeChange = useCallback((name: ThemeName) => {
    setThemeName(name)
    setSetting(THEME_SETTING_KEY, name).catch(console.error)
  }, [])
  if (!tierStorageReady) return null

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <StatusBar style="light" backgroundColor={theme.bg} />
        <NavigationContainer
          theme={{
            dark: true,
            colors: {
              primary:      theme.accent,
              background:   theme.bg,
              card:         theme.surface,
              text:         theme.textPrimary,
              border:       theme.surfaceBorder,
              notification: theme.accent,
            },
          }}
        >
          <Stack.Navigator
            initialRouteName="Onboarding"
            screenOptions={{ headerShown: false }}
          >
            <Stack.Screen name="Onboarding">
              {props => <OnboardingScreen {...props} theme={theme} />}
            </Stack.Screen>
            <Stack.Screen name="Chat">
              {() => (
                <ChatScreen
                  theme={theme}
                  themeName={themeName}
                  onThemeChange={handleThemeChange}
                />
              )}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
      </GestureHandlerRootView>
      </SafeAreaProvider>
    </ErrorBoundary>
  )
}
