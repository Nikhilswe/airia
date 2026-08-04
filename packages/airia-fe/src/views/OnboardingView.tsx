// AIrIA — OnboardingView
// Single animated landing screen: orb + wordmark + opening question.
// Tier selection removed — app auto-detects the best model tier.
import { useState } from 'react'

interface OnboardingViewProps {
  onComplete: () => void
}

export function OnboardingView({ onComplete }: OnboardingViewProps) {
  const [answer, setAnswer] = useState('')

  const handleContinue = () => {
    if (answer.trim()) {
      localStorage.setItem('airia:opening_answer', answer.trim())
    }
    onComplete()
  }

  const handleSkip = () => {
    onComplete()
  }

  return (
    <div className="onboarding">
      <div className="onboarding-card">
        <div className="onboarding-orb" aria-hidden="true">
          <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" width="120" height="120">
            <defs>
              <radialGradient id="orb-gradient" cx="50%" cy="40%" r="55%">
                <stop offset="0%" stopColor="var(--accent, #a78bfa)" stopOpacity="0.9" />
                <stop offset="60%" stopColor="var(--accent-dim, #7c3aed)" stopOpacity="0.6" />
                <stop offset="100%" stopColor="var(--accent-dark, #3b0764)" stopOpacity="0.2" />
              </radialGradient>
              <filter id="orb-glow">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <circle
              cx="60"
              cy="60"
              r="48"
              fill="url(#orb-gradient)"
              filter="url(#orb-glow)"
            />
          </svg>
        </div>

        <div className="wordmark onboarding-wordmark onboarding-wordmark--animate">
          air<span className="wordmark-accent">IA</span>
        </div>

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
            if (e.key === 'Enter' && e.metaKey) handleContinue()
          }}
        />

        <button
          className="onboarding-btn"
          onClick={handleContinue}
        >
          Continue →
        </button>

        <p className="onboarding-hint">
          <button
            type="button"
            className="onboarding-skip"
            onClick={handleSkip}
          >
            Skip for now →
          </button>
        </p>
      </div>
    </div>
  )
}
