import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary'],
      include: ['src/**/*.js'],
      // The DOM and canvas layers are covered by the browser smoke test, not by
      // unit tests; excluding them keeps the coverage number honest.
      exclude: ['src/main.js', 'src/render.js', 'src/ui.js', 'src/exec-shell.js']
    }
  }
});
