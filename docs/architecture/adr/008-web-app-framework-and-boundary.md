# 8. Web Application Framework and Boundary

Date: 2026-08-27

## Status

Accepted

## Context

The Precision Loop project has completed its foundational domain and infrastructure packages (`musical-clock`, `audio-scheduler`, `audio-engine`, `recording-engine`, `transport`, `playback-engine`, `loop-model`, `application`). These packages are designed as pure TypeScript modules with strict domain logic and runtime boundaries.

The next phase requires a visual interface to interact with the application. We need to select a framework for this browser application while preserving the architectural purity of the underlying domain.

The requirements are:
- Provide a robust, reactive UI suitable for a complex digital instrument.
- Integrate cleanly with the existing Vite/Vitest workspace.
- Prevent browser/DOM concepts from leaking into domain logic.
- Prevent Web Audio concepts from leaking into the presentation layer.
- Enforce `ApplicationController` as the sole entry point for user interaction.

## Decision

1. **Framework Selection**: We will use React and TypeScript, built with Vite, as the UI presentation layer for the new `@precision-loop/web-app` package.
2. **Strict Isolation**: React and all DOM-related dependencies must remain completely isolated within the `web-app` package. No domain, infrastructure, or application-level package may depend on React.
3. **Application Boundary**: The UI must interact exclusively with `ApplicationController`. It must not reach around this boundary to interact with `AudioEngine`, `AudioScheduler`, `Session`, or any Web Audio nodes directly.
4. **State Bridging**: The UI will use simple React Hooks (`useState`, `useEffect`, `useContext`) to subscribe to events emitted by the `ApplicationController`. We will not introduce external state management libraries (e.g., Redux) unless scaling requirements explicitly demand it in the future.
5. **Autoplay Policy Handling**: Audio initialization must occur via an explicit user gesture handled by the React UI. This gesture triggers `ApplicationController.resumeAudio()`, completely abstracting the browser's audio context constraints from the UI components.

## Consequences

- The visual presentation of the loop station can be highly dynamic and reactive without complicating the underlying domain modeling.
- We maintain the ability to run the core domain and application tests in Node-based environments without a DOM.
- The UI layer acts as a thin, replaceable presentation shell.
- Enforcing the application boundary requires strict discipline; UI components must synthesize view state from application state rather than directly parsing `Session` internals where possible, though read-only observation of domain state during render is acceptable.
