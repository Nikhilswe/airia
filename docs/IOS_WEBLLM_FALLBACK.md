# iOS WebLLM Fallback and Custom Ollama Routing

## Problem

Mobile Safari repeatedly terminated the AIrIA page with:

> A problem repeatedly occurred on this webpage

The failure happened while WebLLM loaded its large JavaScript/WASM runtime and
initialized the on-device model. On iOS, Safari may expose `navigator.gpu` and
successfully return a WebGPU adapter while still terminating the page when
WebLLM allocates the model runtime. This is a browser process crash, so React
error handling cannot catch it after the allocation starts.

## Changes made

### 1. WebLLM capability gate

Added `packages/airia-service/src/WebGPU.ts` with separate checks for:

- Whether WebGPU exists and can acquire an adapter.
- Whether the device is an iPhone or iPad, including iPadOS desktop-mode user
  agents that identify as macOS.
- Whether WebLLM is safe to initialize on the current platform.

iOS devices are explicitly rejected before the dynamic WebLLM import. This is
intentional even when Safari returns a WebGPU adapter because adapter presence
does not prove that the WebLLM runtime is stable.

`OnDeviceClient.initialize()` now runs this gate before importing
`@mlc-ai/web-llm`. Failed initialization is also reset so it does not leave a
stale rejected promise behind.

### 2. TierRouter fallback behavior

`TierRouter` now:

- Uses the same WebLLM capability gate during initial backend detection.
- Rejects and replaces persisted `on-device` configurations on unsupported
  browsers.
- Resolves unsupported iOS sessions to the `free`/no-backend state when no
  Ollama endpoint is configured.
- Prioritizes a configured custom Ollama endpoint over automatic WebLLM and
  localhost detection.
- Probes the configured endpoint and selects an available Ollama model when
  possible.
- Owns custom endpoint persistence through
  `getCustomOllamaEndpoint()` and `setCustomOllamaEndpoint()`.

The endpoint is stored under `airia:custom_endpoint`. Clearing it also removes
the persisted route and runs backend detection again.

### 3. Ollama endpoint setting

The Settings panel now includes a validated Ollama endpoint field. Saving it
switches the active route to Ollama; clearing it returns to automatic backend
detection.

Examples:

- HTTP/LAN page: `http://192.168.1.10:11434`
- HTTPS/ngrok page: `https://your-ollama-tunnel.ngrok.app`

When AIrIA is opened through an HTTPS ngrok URL, the Ollama endpoint must also
use HTTPS. Browsers block an HTTPS page from calling an HTTP LAN endpoint as
mixed content. A separate HTTPS tunnel or a same-origin server proxy is needed.

The UI and chat errors now explain this requirement instead of retrying
WebLLM.

## Resulting runtime behavior

| Environment | Backend behavior |
| --- | --- |
| Desktop with reachable Ollama | Uses Ollama |
| Supported non-iOS mobile browser with usable WebGPU | May use WebLLM |
| iPhone or iPad without a custom endpoint | Does not load WebLLM; asks for an endpoint |
| iPhone or iPad with a custom endpoint | Uses the configured Ollama endpoint |
| Any device with an explicitly configured endpoint | Prioritizes that endpoint |

Submitting a chat on iOS can no longer initiate the WebLLM download path in the
new bundle.

## Current limitation

The PWA cannot perform reliable, fully on-device inference on iOS. An iOS user
currently needs one of these backends:

- A Mac or another LAN machine running Ollama and reachable by the phone.
- A hosted Ollama-compatible/cloud inference endpoint.
- A future native iOS application using a native runtime such as llama.cpp or
  Core ML.

Using a Mac means it must remain awake and reachable while generating replies.
A hosted endpoint removes that dependency. A native iOS app is the path to
reliable offline/on-device inference without Safari or a separate server.

## Deployment and retesting

After deploying this change, an iPhone that loaded an older PWA build may still
have the previous service worker and JavaScript bundle cached. Before retesting:

1. Rebuild and redeploy the frontend.
2. Close existing AIrIA Safari tabs or the installed PWA.
3. Clear website data for the old ngrok domain, or use a new ngrok URL.
4. Reopen AIrIA and configure an HTTPS Ollama endpoint in Settings.

If the old bundle is still active, it can continue entering WebLLM regardless
of the new source code.

## Verification

The completed checks include:

- Production frontend build.
- Frontend lint.
- Workspace TypeScript checks.
- Full workspace test suite.
- Unit coverage for iPhone detection, iPadOS desktop-mode detection, WebGPU
  adapter failure, iOS WebLLM rejection, custom endpoint routing, and migration
  away from persisted iOS `on-device` routes.

At the time of implementation, all 78 tests passed.
