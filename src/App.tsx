// AIrIA — App entry point
import { useState, useEffect } from 'react'
import type { Tier } from './types/core'
import { tierRouter } from './services/TierRouter'
import { ChatView } from './views/ChatView'
import { OnboardingView } from './views/OnboardingView'
import './styles/themes.css'
import './styles/app.css'

type AppState = 'loading' | 'onboarding' | 'chat'

export default function App() {
  const [appState, setAppState] = useState<AppState>('loading')
  const [theme, setTheme] = useState<string>('dawn')

  useEffect(() => {
    async function init() {
      await tierRouter.detect()
      const savedTheme = localStorage.getItem('airia:theme') ?? 'dawn'
      setTheme(savedTheme)
      document.documentElement.setAttribute('data-theme', savedTheme)

      // First time user — go to onboarding
      const hasOnboarded = localStorage.getItem('airia:onboarded')
      setAppState(hasOnboarded ? 'chat' : 'onboarding')
    }
    init().catch(console.error)
  }, [])

  const handleOnboardingComplete = async (selectedTier: Tier) => {
    await tierRouter.switchTier(selectedTier)
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
        <div className="loading-orb">✦</div>
      </div>
    )
  }

  if (appState === 'onboarding') {
    return <OnboardingView onComplete={handleOnboardingComplete} />
  }

  return (
    <ChatView
      theme={theme}
      onThemeChange={handleThemeChange}
    />
  )
}
