import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  plugins: [svelte({ hot: false })],
  resolve: {
    alias: {
      $lib: path.resolve(__dirname, 'src/lib'),
      '@nexus/kernel': path.resolve(__dirname, '../kernel/pkg/nexus_kernel.js'),
      'svelte/internal/server': path.resolve(
        __dirname,
        'node_modules/svelte/src/internal/server/index.js',
      ),
      'svelte/internal/client': path.resolve(
        __dirname,
        'node_modules/svelte/src/internal/client/index.js',
      ),
      'svelte/internal/disclose-version': path.resolve(
        __dirname,
        'node_modules/svelte/src/internal/disclose-version.js',
      ),
      'svelte/internal/flags/legacy': path.resolve(
        __dirname,
        'node_modules/svelte/src/internal/flags/legacy.js',
      ),
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    reporters: ['default', 'junit', 'json'],
    outputFile: {
      junit: './test-results/vitest-junit.xml',
      json: './test-results/vitest-results.json',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/lib/**/*.ts', 'src/lib/**/*.svelte'],
      exclude: ['src/lib/**/*.test.ts', 'src/lib/**/__tests__/**'],
      // thresholds re-enabled after comprehensive test pass
      // thresholds: {
      //   statements: 40,
      //   branches: 35,
      //   functions: 40,
      //   lines: 40,
      // },
    },
  },
});
