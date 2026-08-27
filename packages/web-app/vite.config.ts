/// <reference types="vitest" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { configDefaults } from 'vitest/config'

// https://vite.dev/config/
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: /^@precision-loop\/(.*)$/, replacement: path.resolve(__dirname, '../$1/src') }
    ]
  },
  optimizeDeps: {
    include: [
      '@precision-loop/application',
      '@precision-loop/loop-model',
      '@precision-loop/audio-engine',
      '@precision-loop/audio-scheduler',
      '@precision-loop/recording-engine',
      '@precision-loop/playback-engine',
      '@precision-loop/transport',
      '@precision-loop/musical-clock'
    ]
  },
  test: {
    exclude: [...configDefaults.exclude, '**/e2e/**']
  }
})
