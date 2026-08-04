// AIrIA — timeoutSignal
// AbortSignal.timeout() is not implemented in Hermes (React Native's JS
// engine), so any fetch using it throws synchronously and is silently caught
// as a network failure. This AbortController-based helper works everywhere.

export function timeoutSignal(ms: number): AbortSignal {
  const controller = new AbortController()
  setTimeout(() => controller.abort(), ms)
  return controller.signal
}
