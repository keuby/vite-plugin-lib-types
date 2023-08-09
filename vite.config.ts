import { defineConfig } from 'vite';
import LibTypes from './src';
import pkg from './package.json';

export default defineConfig({
  plugins: [LibTypes({ tsconfigPath: './tsconfig.build.json' })],
  build: {
    minify: false,
    target: 'ES2018',
    emptyOutDir: true,
    lib: {
      entry: {
        cli: './src/cli.ts',
        index: './src/index.ts',
        parser: './src/parser/index.ts',
        transformer: './src/transformer/index.ts',
      },
      formats: ['cjs', 'es'],
    },
    rollupOptions: {
      output: {
        exports: 'named',
      },
      external: [...Object.keys(pkg.dependencies), ...Object.keys(pkg.peerDependencies)],
    },
  },
});
