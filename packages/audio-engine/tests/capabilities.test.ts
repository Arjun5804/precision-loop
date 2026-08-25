import { describe, it, expect } from 'vitest';
import { detectCapabilities } from '../src/capabilities';
import { MockAudioContext } from './mocks';

describe('Capabilities Detection', () => {
  it('detects output selection support if setSinkId is present', () => {
    const cap = detectCapabilities(MockAudioContext as any);
    expect(cap.supportsOutputSelection).toBe(true);
  });

  it('reports no output selection support if setSinkId is missing', () => {
    class OldContext {}

    const cap = detectCapabilities(OldContext as any);
    expect(cap.supportsOutputSelection).toBe(false);
  });
});
