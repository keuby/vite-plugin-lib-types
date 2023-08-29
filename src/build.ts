import path from 'pathe';
import { Project } from 'ts-morph';
import glob from 'fast-glob';
import fs from 'fs-extra';
import { resolve, readFile } from 'tsconfig';
import {
  rollup,
  type Plugin,
  type OutputOptions,
  type InputOption,
  type InputOptions,
} from 'rollup';
import { dts } from 'rollup-plugin-dts';
import { formatTsConfigPattern, getPkgJson, getPkgName, normalizeEntry } from './utils';
import type { UserOptions } from './types';
import { createVueParser } from './parser';

export async function createProject(options: UserOptions) {
  const {
    root = process.cwd(),
    parsers = [createVueParser()],
    outDir = 'dist',
    tempDir = path.join(outDir, '.temp'),
    tsconfig: {
      compilerOptions = {},
      include: inputInclude = [],
      exclude: inputExclude = [],
    } = {},
    tsconfigPath = await resolve(root),
  } = options;

  if (!tsconfigPath) {
    throw new Error('tsconfig not found');
  }

  const typesAbsoluteDir = path.resolve(root, tempDir);
  const tsconfig = await readFile(tsconfigPath);
  const include: string[] = tsconfig.include ?? ['**/*.{ts,tsx}'];
  const exclude: string[] = tsconfig.exclude ?? ['node_modules/**', 'dist/**'];

  const project = new Project({
    compilerOptions: {
      ...compilerOptions,
      rootDir: root,
      baseUrl: root,
      outDir: typesAbsoluteDir,
      declaration: true,
      preserveSymlinks: true,
    },
    tsConfigFilePath: tsconfigPath,
    skipAddingFilesFromTsConfig: true,
  });

  const globs = formatTsConfigPattern(root, include).concat(inputInclude);
  const ignore = formatTsConfigPattern(root, exclude).concat(inputExclude);

  const files = await glob(globs, {
    cwd: root,
    ignore: ignore,
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

export async function buildTypes(options: BuildTypesOptions) {
  const {
    root = process.cwd(),
    entry,
    tempDir = 'node_modules/.temp',
    tsconfig = {},
    respectExternal,
    tsconfigPath = await resolve(root),
  } = options;

  if (!tsconfigPath) {
    throw new Error('tsconfig not found');
  }

  const typesTempDir = path.resolve(root, tempDir);
  const normalizedEntries = normalizeEntry(entry, root, typesTempDir);

  const patchTypes = (): Plugin => {
    return {
      name: 'patch-types',
      async renderChunk(code, chunk, opts, meta) {
        if (options.transformers) {
          for (const fn of options.transformers!) {
            const parsedCode = await fn.apply(this, [
              code,
              chunk,
              opts,
              { root, ...meta },
            ]);
            if (typeof parsedCode === 'string') {
              code = parsedCode;
            }
          }
        }
        return code;
      },
    };
  };

  const bundle = await rollup({
    input: normalizedEntries,
    plugins: [
      dts({
        respectExternal,
        tsconfig: tsconfigPath,
        compilerOptions: tsconfig.compilerOptions,
      }),
      patchTypes(),
    ],
    external: options.external,
  });

  let fileName = options.fileName;

  if (!fileName && Object.keys(normalizedEntries).length === 1) {
    fileName = getPkgName(getPkgJson(root).name) + '.d.ts';
  }

  const result = await bundle.generate({
    entryFileNames: fileName,
    exports: options.exports,
  });

  return result.output;
}
