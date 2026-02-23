import { resolve } from 'path';
import { defineConfig } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: 'dist',
  },
  base: './',
  resolve: {
    alias: {
      'reddit-agent-common': resolve(__dirname, '../common/src/index.ts'),
    },
  },
});
