import { sync } from 'cross-spawn';
import path from 'pathe';
import type { InputOptions, OutputOptions } from 'rollup';
import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';
import { ignoreModules, patchTypes } from './rollup-plugins';
import type { UserOptions } from './types';
import {
  getPkgJson,
  getPkgName,
  isPlainObject,
  normalizeEntry,
  resolveTsConfig,
} from './utils';

export async function compileTypes(root: string, options: UserOptions) {
  const { outDir = 'dist', tempDir = path.join(outDir, '.temp') } = options;

  const typesOutDir = !options.noEmit ? path.resolve(root, tempDir) : null;

  const tsconfig = await resolveTsConfig(root, options);
  const hasVue = tsconfig.include.some((item) => item.includes('.vue'));

  const tscPath = hasVue
    ? require.resolve('vue-tsc/bin/tsc')
    : require.resolve('typescript/lib/tsc');

  const args: string[] = ['node'];

  if (typesOutDir) {
    args.push('--outDir', typesOutDir);
    args.push('--rootDir', root);
    args.push('--declaration');
    args.push('--emitDeclarationOnly');
  } else {
    args.push('--noEmit');
  }

  args.push('--project', tsconfig.path);

  const { error } = sync('node', args, {
    stdio: 'inherit',
    cwd: root,
    env: process.env,
  });

  if (error) {
    throw error;
  }

  return typesOutDir;
}

export interface BuildTypesOptions extends UserOptions {
  entry: string | string[] | { [entryAlias: string]: string };
  external?: InputOptions['external'];
  exports?: OutputOptions['exports'];
}

export async function buildTypes(root: string, options: BuildTypesOptions) {
  const { entry, tempDir = 'node_modules/.temp', respectExternal } = options;

  const tsconfig = await resolveTsConfig(root, options);

  const typesTempDir = path.resolve(root, tempDir);
  const normalizedEntries = normalizeEntry(entry, root, typesTempDir);

  const bundle = await rollup({
    input: normalizedEntries,
    plugins: [
      dts({
        respectExternal,
        tsconfig: tsconfig.path,
      }),
      patchTypes(root, options),
      ignoreModules(typesTempDir, tsconfig),
    ],
    external: options.external,
  });

  let fileName = options.fileName;

  if (!fileName && !isPlainObject(entry) && Object.keys(normalizedEntries).length === 1) {
    fileName = getPkgName(getPkgJson(root).name) + '.d.ts';
  }

  const result = await bundle.generate({
    entryFileNames: fileName,
    exports: options.exports,
  });

  return result.output;
}
