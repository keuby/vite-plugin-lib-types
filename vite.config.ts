import { defineConfig } from 'vite';
import types from './src';
import pkg from './package.json';

export default defineConfig({
  plugins: [types({ tsconfigPath: './tsconfig.build.json' })],
  build: {
    minify: false,
    target: 'ES2018',
    emptyOutDir: true,
    lib: {
      entry: {
        index: './src/index.ts',
        parser: './src/parser/index.ts',
        transformer: './src/transformer/index.ts',
      },
      formats: ['cjs', 'es'],
    },
    rollupOptions: {
      output: {
        exports: 'named',
        interop: 'auto',
      },
      external: [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)],
    },
  },
});
