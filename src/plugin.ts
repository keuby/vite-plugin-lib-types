import type { Plugin } from 'vite';
import type { EmittedAsset } from 'rollup';
import type { UserOptions } from './types';
import fs from 'fs-extra';
import path from 'pathe';
import { buildTypes, createProject } from './build';

export default function VitePluginLibTypes(options: UserOptions = {}): Plugin {
  const emitFiles: EmittedAsset[] = [];
  return {
    name: 'vite-plugin-lib-types',
    apply: 'build',
    async configResolved(config) {
      const root = config.root;
      const outDir = config.build.outDir ?? 'dist';
      const entry = config.build.lib && config.build.lib.entry;

      if (!entry) return;

      const tempDir = path.resolve(root, options.tempDir ?? outDir, '.temp');
      await fs.mkdir(tempDir, { recursive: true });
      try {
        const project = await createProject({
          ...options,
          tempDir,
        });
        await project.emit({ emitOnlyDtsFiles: true });

        const outputOptions = config.build.rollupOptions.output;
        const chunks = await buildTypes({
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
        await fs.rm(tempDir, { recursive: true });
      }
    },
    buildEnd(err?) {
      if (err) return;
      emitFiles.forEach((file) => this.emitFile(file));
    },
  };
}
