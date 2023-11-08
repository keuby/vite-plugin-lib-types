import fs from 'fs-extra';
import type { EmittedAsset, InputOption } from 'rollup';
import type { Plugin, ResolvedConfig } from 'vite';
import { buildTypes as _buildTypes, compileTypes } from './build';
import type { UserOptions } from './types';

export default function VitePluginLibTypes(options: UserOptions = {}): Plugin {
  const emitFiles: EmittedAsset[] = [];

  const createBuilder = (
    config: ResolvedConfig,
    root: string,
    outDir: string,
    entry: InputOption,
  ) => {
    return async () => {
      let tempDir: string | null = null;

      try {
        tempDir = await compileTypes(root, { ...options, outDir });
        if (!tempDir) return;

        const outputOptions = config.build.rollupOptions.output;
        const chunks = await _buildTypes(root, {
          ...options,
          entry,
          tempDir,
          external: config.build.rollupOptions.external,
          exports: Array.isArray(outputOptions) ? undefined : outputOptions?.exports,
        });
        for (const chunk of chunks) {
          emitFiles.push({
            type: 'asset',
            name: chunk.name,
            source: chunk.type === 'chunk' ? chunk.code : chunk.source,
            fileName: chunk.fileName,
          });
        }
      } finally {
        tempDir && (await fs.rm(tempDir, { recursive: true }));
      }
    };
  };

  let buildTypes: (() => Promise<void>) | null = null;

  return {
    name: 'vite-plugin-lib-types',
    apply: 'build',
    async configResolved(config) {
      const root = config.root;
      const outDir = config.build.outDir ?? 'dist';
      const entry = config.build.lib && config.build.lib.entry;

      if (!entry) return;

      buildTypes = createBuilder(config, root, outDir, entry);

      if (options.pluginHook == null || options.pluginHook === 'configResolved') {
        await buildTypes();
      }
    },
    async renderStart() {
      if (options.pluginHook === 'renderStart' && buildTypes) {
        await buildTypes();
      }
    },
    buildEnd(err?) {
      if (err) return;
      emitFiles.forEach((file) => this.emitFile(file));
    },
  };
}
