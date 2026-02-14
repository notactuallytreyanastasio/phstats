/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { sqliteApiPlugin } from './src/server/sqlite-plugin'

export default defineConfig({
  plugins: [react(), sqliteApiPlugin()],
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './src/core'),
      '@shell': path.resolve(__dirname, './src/shell'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.spec.{ts,tsx}',
        'src/test-setup.ts',
        'src/vite-env.d.ts',
      ],
    },
  },
})
