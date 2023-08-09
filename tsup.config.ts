import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/cli.ts',
    './src/parser/index.ts',
    './src/transformer/index.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  splitting: true,
  external: ['@vue/compiler-sfc'],
});
