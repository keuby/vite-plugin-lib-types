# vite-plugin-lib-types

Generate dts file while building library, supports vue file

## Usage

```bash
npm i -D vite-plugin-lib-types
```

A simple example is shown below:

```ts
import { defineConfig } from 'vite';
import types from 'vite-plugin-lib-types';

export default defineConfig({
  plugins: [types()],
  build: {
    target: 'ES2018',
    sourcemap: true,
    minify: false,
    lib: {
      entry: 'src/index.ts',
      formats: ['es', 'cjs'],
    },
  },
});
```

## Options

| name         | type                 | default                 | description                    |
| ------------ | -------------------- | ----------------------- | ------------------------------ |
| tsconfig     | `object`             | `undefined`             | override the value of tsconfig |
| tsconfigPath | `string`             | `${root}/tsconfig.json` | path of tsconfig               |
| outDir       | `string`             | `undefined`             | dts file output path           |
| fileName     | `string \| function` | `[]`                    | custom dts file names          |
| transformers | `Transformer[]`      | `[]`                    | Custom dts file transformer    |
