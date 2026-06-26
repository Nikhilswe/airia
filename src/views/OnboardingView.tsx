// AIrIA — OnboardingView
// First open: one real question, then tier selection.
// No form, no pricing page first.
import { useState } from 'react'
import type { Tier } from '../types/core'

interface OnboardingViewProps {
  onComplete: (tier: Tier) => void
}

type Step = 'question' | 'tier'

const TIERS: { id: Tier; label: string; desc: string; badge: string }[] = [
  { id: 'local',  label: 'Local',  desc: 'Trains on your own hardware. Everything stays on your machine.', badge: 'RTX 4080+ needed' },
  { id: 'cloud',  label: 'Cloud',  desc: "We handle training. Your data stays isolated — never shared.", badge: 'Pay per training run' },
  { id: 'free',   label: 'Free',   desc: 'Chat freely. Receive curated updates we research and push.', badge: 'Always free' },
]

export function OnboardingView({ onComplete }: OnboardingViewProps) {
  const [step, setStep] = useState<Step>('question')
  const [answer, setAnswer] = useState('')
  const [selectedTier, setSelectedTier] = useState<Tier>('free')

  const handleQuestionSubmit = () => {
    if (!answer.trim()) return
    // Store the opening answer in localStorage for AIrIA's first context
    localStorage.setItem('airia:opening_answer', answer.trim())
    setStep('tier')
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="wordmark onboarding-wordmark">air<span className="wordmark-accent">IA</span></div>

        {step === 'question' && (
          <>
            <div className="onboarding-orb">✦</div>
            <h1 className="onboarding-greeting">Hey. I'm AIrIA.</h1>
            <p className="onboarding-sub">
              I'm not here to answer questions. I'm here to get to know you — and get better at it over time.
            </p>
            <div className="onboarding-question">
              What's something you've been thinking about a lot lately?
            </div>
            <textarea
              className="onboarding-input"
              placeholder="Take your time…"
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              rows={3}
              autoFocus
              aria-label="Your answer"
              onKeyDown={e => {
                if (e.key === 'Enter' && e.metaKey) handleQuestionSubmit()
              }}
            />
            <button
              className="onboarding-btn"
              onClick={handleQuestionSubmit}
              disabled={!answer.trim()}
            >
              Continue →
            </button>
          </>
        )}

        {step === 'tier' && (
          <>
            <h2 className="onboarding-tier-title">How do you want AIrIA to grow with you?</h2>
            <p className="onboarding-tier-sub">AIrIA learns from every conversation. Choose how that learning happens.</p>
            <div className="tier-grid">
              {TIERS.map(t => (
                <button
                  key={t.id}
                  className={`tier-card ${selectedTier === t.id ? 'tier-card--selected' : ''}`}
                  onClick={() => setSelectedTier(t.id)}
                  aria-pressed={selectedTier === t.id}
                >
                  <div className="tier-card-name">{t.label}</div>
                  <div className="tier-card-desc">{t.desc}</div>
                  <div className="tier-card-badge">{t.badge}</div>
                </button>
              ))}
            </div>
            <button className="onboarding-btn" onClick={() => onComplete(selectedTier)}>
              Start with {TIERS.find(t => t.id === selectedTier)?.label} →
            </button>
            <p className="onboarding-hint">You can switch tiers anytime from settings</p>
          </>
        )}
      </div>
    </div>
  )
}
