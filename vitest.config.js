import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@sudoku': path.resolve(__dirname, 'src/node_modules/@sudoku'),
    },
  },
});
