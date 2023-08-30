import type { OutputOptions, InputOptions } from 'rollup';
import path from 'pathe';
import { Project } from 'ts-morph';
import glob from 'fast-glob';
import fs from 'fs-extra';
import { rollup } from 'rollup';
import { dts } from 'rollup-plugin-dts';
import {
  resolveTsConfig,
  getPkgJson,
  getPkgName,
  normalizeEntry,
  isPlainObject,
} from './utils';
import type { UserOptions } from './types';
import { createVueParser } from './parser';
import { patchTypes, ignoreModules } from './rollup-plugins';

export async function createProject(root: string, options: UserOptions) {
  const {
    parsers = [createVueParser()],
    outDir = 'dist',
    tempDir = path.join(outDir, '.temp'),
  } = options;

  const typesAbsoluteDir = path.resolve(root, tempDir);

  const tsconfig = await resolveTsConfig(root, options);

  const project = new Project({
    compilerOptions: {
      ...tsconfig.compilerOptions,
      rootDir: root,
      baseUrl: root,
      outDir: typesAbsoluteDir,
      declaration: true,
      preserveSymlinks: true,
    },
    tsConfigFilePath: tsconfig.path,
    skipAddingFilesFromTsConfig: true,
  });

  const files = await glob(tsconfig.include, {
    cwd: root,
    ignore: tsconfig.exclude,
    absolute: true,
    onlyFiles: true,
  });

  const parseFile = async (filePath: string, code: string) => {
    for (const parser of parsers) {
      const parseResult = await parser.apply(project, [code, { root, filePath }]);
      if (parseResult != null) {
        return parseResult;
      }
    }
    return null;
  };

  await Promise.all(
    files.map(async (file) => {
      const rawCode = await fs.readFile(file, 'utf-8');
      const parsedResult = await parseFile(file, rawCode);
      if (parsedResult == null) {
        project.addSourceFileAtPath(file);
      } else if (typeof parsedResult === 'string') {
        project.createSourceFile(file, parsedResult);
      } else if (typeof parsedResult === 'object') {
        const { code, fileName } = parsedResult;
        project.createSourceFile(
          fileName ? path.join(path.dirname(file), fileName) : file,
          code,
        );
      }
    }),
  );

  const diagnostics = project.getPreEmitDiagnostics();
  if (diagnostics.length > 0) {
    console.log(project.formatDiagnosticsWithColorAndContext(diagnostics));
    throw new Error('typings compile error');
  }

  return project;
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
        compilerOptions: tsconfig.compilerOptions,
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
