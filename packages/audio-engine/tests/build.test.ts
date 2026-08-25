import { describe, it, expect } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('Build Artifacts', () => {
  it('should compile the foundation-processor worklet to a static JS asset in dist/worklets', () => {
    const workletPath = path.resolve(__dirname, '../dist/worklets/foundation-processor.js');
    
    const fileExists = fs.existsSync(workletPath);
    expect(fileExists).toBe(true);
    
    if (fileExists) {
      const content = fs.readFileSync(workletPath, 'utf8');
      expect(content).toContain('class FoundationProcessor extends AudioWorkletProcessor');
      expect(content).toContain('registerProcessor');
    }
  });
});
