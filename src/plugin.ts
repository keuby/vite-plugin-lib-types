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
      const entry = config.build.lib && config.build.lib.entry;
      if (!entry || options.enable === false) return;

      const transform = !options.transformers
        ? (code: string) => code
        : async (code: string) => {
            for (const fn of options.transformers!) {
              const parsedCode = await fn(code, { root });
              if (typeof parsedCode === 'string') {
                code = parsedCode;
              }
            }
            return code;
          };

      const outDir = path.resolve(root, config.build.outDir);
      const tempDir = path.resolve(root, options.tempDir ?? outDir, '.types');
      await fs.mkdir(tempDir, { recursive: true });
      try {
        const project = await createProject({
          ...options,
          tempDir,
        });
        await project.emit({ emitOnlyDtsFiles: true });
        const buildResult = await buildTypes({
          ...options,
          entry,
          tempDir,
        });
        const ps = Object.values(buildResult).map(async ({ fileName, filePath }) => {
          const source = await fs.readFile(filePath, 'utf-8');
          emitFiles.push({
            type: 'asset',
            name: path.basename(filePath),
            fileName: fileName,
            source: await transform(source)!,
          });
        });
        await Promise.all(ps);
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
