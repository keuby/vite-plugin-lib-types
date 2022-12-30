import type { Plugin } from 'vite';
import type { EmittedAsset } from 'rollup';
import type { Options } from './types';
import { build } from './build';
import path from 'pathe';
import { readFile } from 'fs-extra';

export default function VitePluginLibTypes(options: Options = {}): Plugin {
  const emitFiles: EmittedAsset[] = [];
  return {
    name: 'vite-plugin-lib-types',
    async configResolved(config) {
      const root = config.root;
      const entry = config.build.lib && config.build.lib.entry;
      if (!entry || options.enable === false) return;

      const result = await build(root, entry, options);
      const ps = Object.values(result).map(async ({ fileName, filePath }) => {
        const source = await readFile(filePath, 'utf-8');
        emitFiles.push({
          type: 'asset',
          name: path.basename(filePath),
          fileName: fileName,
          source: (await options.transform?.(source)) ?? source,
        });
      });
      await Promise.all(ps);
    },
    buildEnd(err?) {
      if (err) return;

      emitFiles.forEach((file) => this.emitFile(file));
    },
  };
}
