import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from 'path';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'));

export default defineConfig({
  plugins: [sveltekit()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@nexus/kernel': path.resolve(__dirname, '../kernel/pkg/nexus_kernel.js'),
    },
  },
  optimizeDeps: {
    exclude: ['@nexus/kernel'],
  },
  server: {
    fs: {
      allow: ['../..'],
    },
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    },
  },
});
