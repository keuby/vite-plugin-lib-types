import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    transformer: 'src/transformer/index.ts',
  },
  dts: true,
  clean: true,
  splitting: false,
  cjsInterop: true,
  external: ['typescript'],
});
