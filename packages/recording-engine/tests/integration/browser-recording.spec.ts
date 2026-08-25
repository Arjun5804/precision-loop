import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

test.describe('RecordingEngine Browser Integration', () => {
  test('should capture exact number of frames in browser', async ({ page }) => {
    // Route a fake localhost URL to ensure Secure Context for AudioWorklet
    await page.route('http://localhost:3000/', route => {
        route.fulfill({
            status: 200,
            contentType: 'text/html',
            body: '<html><body>Testing</body></html>'
        });
    });
    await page.goto('http://localhost:3000/');
    
    const workletPath = path.resolve(__dirname, '../../dist/worklets/recording-processor.js');
    if (!fs.existsSync(workletPath)) {
        test.skip(true, 'Worklet asset not built');
    }
    
    const workletCode = fs.readFileSync(workletPath, 'utf-8');
    
    const result = await page.evaluate(async (workletSource) => {
        const blob = new Blob([workletSource], { type: 'application/javascript' });
        const objUrl = URL.createObjectURL(blob);
        
        // Use standard sample rate for testing
        const ctx = new AudioContext({ sampleRate: 48000 });
        await ctx.audioWorklet.addModule(objUrl);
        
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const source = ctx.createMediaStreamSource(stream);
        
        const node = new AudioWorkletNode(ctx, 'recording-processor');
        const gain = ctx.createGain();
        gain.gain.value = 0;
        
        source.connect(node);
        node.connect(gain);
        gain.connect(ctx.destination);
        
        return new Promise<{frameCount: number}>((resolve, reject) => {
            const chunks: Float32Array[] = [];
            let currentFrameCount = 0;
            
            node.port.onmessage = (event) => {
                const msg = event.data;
                if (msg.type === 'CHUNK') {
                    const arr = new Float32Array(msg.buffer);
                    chunks.push(arr);
                    currentFrameCount += arr.length;
                } else if (msg.type === 'COMPLETED') {
                    resolve({ frameCount: currentFrameCount });
                } else if (msg.type === 'ERROR') {
                    reject(msg.message);
                }
            };
            
            setTimeout(() => {
                const startTime = ctx.currentTime + 0.1;
                const endTime = startTime + 1.0; 
                const startFrame = Math.round(startTime * ctx.sampleRate);
                const endFrame = Math.round(endTime * ctx.sampleRate);
                
                node.port.postMessage({ type: 'ARM', startFrame, endFrame });
            }, 100);
        });
    }, workletCode);
    
    expect(result.frameCount).toBe(48000);
  });
});
