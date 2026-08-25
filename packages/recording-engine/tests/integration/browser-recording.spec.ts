import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import * as esbuild from 'esbuild';
import http from 'http';

test.describe('RecordingEngine Browser Integration', () => {
  let server: http.Server;
  let port: number;

  test.afterEach(() => {
    if (server) server.close();
  });

  test('should capture exact number of frames via public API', async ({ page }) => {
    page.on('console', msg => console.log('BROWSER CONSOLE:', msg.text()));
    page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
    
    // Bundle a test script that uses the real RecordingEngine
    const testScriptCode = `
      import { RecordingEngine } from './src/index';
      
      window.runTest = async () => {
          try {
            const ctx = new AudioContext({ sampleRate: 48000 });
            const engine = new RecordingEngine(ctx);
            
            // Wait for context to be ready
            if (ctx.state !== 'running') {
              await ctx.resume();
            }

            // The URL matches our local server
            await engine.prepare('/worklets/recording-processor.js');
            
            const startTime = ctx.currentTime + 0.1;
            const endTime = startTime + 1.0; 
            
            // Should resolve with RecordedTake
            const take = await engine.arm({ startTime, endTime });
            return { frameCount: take.frameCount };
          } catch (err) {
            return { error: err.message };
          }
      };
    `;
    
    // Use esbuild to bundle it
    const buildResult = await esbuild.build({
      stdin: {
        contents: testScriptCode,
        resolveDir: __dirname + '/../../', // root of recording-engine
        loader: 'ts'
      },
      bundle: true,
      write: false,
      format: 'iife'
    });
    
    const bundleStr = buildResult.outputFiles[0].text;
    
    const workletPath = path.resolve(__dirname, '../../dist/worklets/recording-processor.js');
    if (!fs.existsSync(workletPath)) {
        test.skip(true, 'Worklet asset not built');
    }
    const workletCode = fs.readFileSync(workletPath, 'utf-8');

    // Start native HTTP server
    await new Promise<void>((resolve) => {
        server = http.createServer((req, res) => {
            if (req.url === '/') {
                res.writeHead(200, { 'Content-Type': 'text/html' });
                res.end(`<html><body><script>${bundleStr}</script></body></html>`);
            } else if (req.url === '/worklets/recording-processor.js') {
                res.writeHead(200, { 'Content-Type': 'application/javascript' });
                res.end(workletCode);
            } else {
                res.writeHead(404);
                res.end();
            }
        });
        server.listen(0, () => {
            port = (server.address() as any).port;
            resolve();
        });
    });

    await page.goto(`http://localhost:${port}/`);
    
    const result = await page.evaluate(async () => {
        return await (window as any).runTest();
    });
    
    if (result.error) {
        throw new Error(result.error);
    }
    
    expect(result.frameCount).toBe(48000);
  });
});
