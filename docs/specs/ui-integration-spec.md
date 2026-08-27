# UI Integration Specification

This specification defines the strict boundaries and state-bridging patterns between the Browser UI (`packages/web-app`) and the Application layer (`packages/application`).

## 1. Interaction Flow (UI → Application)

All UI intent must translate to method calls on the `ApplicationController` singleton, provided via a React Context (`ApplicationProvider`).

- **Forbidden**: 
  - Directly calling methods on `AudioEngine`, `AudioScheduler`, `PlaybackEngine`, or `RecordingEngine`.
  - Calling `context.resume()` or interacting with `AudioNode`s directly.
  - Modifying `Session` state directly (e.g., mutating arrays, modifying properties).

The UI translates hardware-inspired gestures into high-level commands:
- `All Start` -> `controller.startPlayback()`
- `Stop` -> `controller.stop()`
- `Track Record` -> `controller.startRecording(trackId, countInBars, recordingBars)`

## 2. State Flow (Application → UI)

The UI must remain reactive to the state managed by `ApplicationController`. We achieve this through subscription hooks.

- `useApplicationState()`: Subscribes to `controller.onStateChange()`.
  - Reflects `IDLE`, `PREPARING`, `RECORDING`, `PLAYING`, `ERROR`.
  - UI uses this to style indicators (e.g., flashing red for RECORDING, solid green for PLAYING) and disable conflicting actions.
- `useAudioState()`: Subscribes to `controller.onAudioStateChange()`.
  - Reflects `uninitialized`, `suspended`, `running`, `closed`.
  - UI uses this to render initialization overlays and block transport until `running`.

## 3. Audio Initialization Protocol

Browsers prohibit audio context initialization without a user gesture.
1. `ApplicationController.initialize()` is called on app load. The underlying `AudioContext` is created in a `suspended` state.
2. The UI observes `audioState === 'suspended'`.
3. The UI presents an explicit "Initialize Audio" overlay, blocking transport access.
4. User clicks "Initialize Audio".
5. UI calls `controller.resumeAudio()`.
6. `AudioEngine` resumes. `ApplicationController` emits `onAudioStateChange('running')`.
7. UI clears the overlay and enables transport.

## 4. Forbidden Dependencies

- **Domain/Infrastructure Layer**: Cannot import `react`, `react-dom`, or any DOM-specific globals (`window`, `document`) outside of specifically designed Web adapters.
- **UI Layer**: Cannot import Web Audio API types for direct manipulation. Must not use `Date.now()`, `setTimeout()`, `setInterval()`, or `requestAnimationFrame()` for **audio timing**. (Animation for visual purposes is permitted but must not dictate domain behavior).

## 5. Testing Boundaries

- **UI Tests**: Conducted using Playwright in `packages/web-app`. Tests interact with the rendered DOM to verify state changes propagate correctly between the UI and the real `ApplicationController`.
- **Domain Tests**: Handled by Vitest in their respective packages, focusing on deterministic verification without browser rendering overhead.
