import { vi } from 'vitest';

class MockAudioWorkletNode {
    port = { postMessage: vi.fn(), onmessage: null };
    connect = vi.fn();
    disconnect = vi.fn();
}

vi.stubGlobal('AudioWorkletNode', MockAudioWorkletNode);
