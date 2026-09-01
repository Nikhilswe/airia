// AIrIA — App entry point
import { useState, useEffect } from 'react'
import { tierRouter } from '@airia/service'
import { ChatView } from './views/ChatView'
import { OnboardingView } from './views/OnboardingView'
import SyncOverlay from './components/SyncOverlay'
import { AiriaLogo } from './components/AiriaLogo'
import { useModelSync } from './hooks/useModelSync'
import { MetricsProvider } from './context/MetricsContext'
import './styles/themes.css'
import './styles/app.css'

type AppState = 'loading' | 'onboarding' | 'chat'

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading')
  const [theme, setTheme] = useState<string>('dawn')
  const { syncing, newModel, dismissSync } = useModelSync()

  useEffect(() => {
    // Apply theme synchronously so the loading screen logo is visible immediately
    const savedTheme = localStorage.getItem('airia:theme') ?? 'dawn'
    setTheme(savedTheme)
    document.documentElement.setAttribute('data-theme', savedTheme)

    async function init() {
      await tierRouter.detect()
      const hasOnboarded = localStorage.getItem('airia:onboarded')
      setAppState(hasOnboarded ? 'chat' : 'onboarding')
    }
    init().catch(console.error)
  }, [])

  const handleOnboardingComplete = () => {
    localStorage.setItem('airia:onboarded', 'true')
    setAppState('chat')
  }

  const handleThemeChange = (newTheme: string) => {
    setTheme(newTheme)
    localStorage.setItem('airia:theme', newTheme)
    document.documentElement.setAttribute('data-theme', newTheme)
  }

  if (appState === 'loading') {
    return (
      <div className="loading-screen" aria-label="Loading AIrIA">
        <AiriaLogo size={96} animate glow />
        <span className="loading-label">Loading AIrIA…</span>
      </div>
    )
  }

  if (appState === 'onboarding') {
    return <OnboardingView onComplete={handleOnboardingComplete} />
  }

  return (
    <MetricsProvider>
      <ChatView theme={theme} onThemeChange={handleThemeChange} />
      {syncing && newModel && (
        <SyncOverlay newModel={newModel} onDismiss={dismissSync} />
      )}
    </MetricsProvider>
  )
}
