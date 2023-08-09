import path from 'pathe';
import { Project } from 'ts-morph';
import glob from 'fast-glob';
import fs from 'fs-extra';
import { resolve, readFile } from 'tsconfig';
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor';
import {
  formatTsConfigPattern,
  getPkgJson,
  getPkgName,
  isPlainObject,
  isString,
} from './utils';
import { name as packageName } from '../package.json';
import type { UserOptions } from './types';

export async function createProject(options: UserOptions) {
  const {
    root = process.cwd(),
    parsers = [],
    tempDir = '.temp',
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
      const parseResult = await parser(filePath, code, { root });
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
}

export async function buildTypes(options: BuildTypesOptions) {
  const {
    root = process.cwd(),
    entry,
    tempDir = '.temp',
    tsconfigPath = await resolve(root),
    apiExtractorConfigPath = 'api-extractor.json',
  } = options;

  if (!tsconfigPath) {
    throw new Error('tsconfig not found');
  }

  const typesTempDir = path.resolve(root, tempDir);
  const typesDistDir = path.resolve(root, 'node_modules/.temp');

  let normalizedEntries: { [name: string]: string };

  if (isPlainObject(entry)) {
    normalizedEntries = entry as { [name: string]: string };
  } else {
    const entryFiles = Array.isArray(entry) ? entry : [entry];
    normalizedEntries = Object.fromEntries(
      entryFiles.map((entryFile) => {
        const ext = path.extname(entryFile);
        const entryName = path.basename(entryFile).replace(ext, '');
        return [entryName, entryFile];
      }),
    );
  }

  const localJsonPath = path.resolve(root, apiExtractorConfigPath);
  const jsonPath = fs.existsSync(localJsonPath)
    ? localJsonPath
    : require.resolve(`${packageName}/api-extractor.json`);

  let fileName = options.fileName;

  if (!fileName) {
    fileName =
      Object.keys(normalizedEntries).length === 1
        ? getPkgName(getPkgJson(root).name) + '.d.ts'
        : (v: string) => v + '.d.ts';
  }

  const promises = Object.entries(normalizedEntries).map(
    async ([entryName, entryFile]) => {
      const entryFileName = path.basename(entryFile);
      const isTsFile = !!entryFile.match(/\.(ts|tsx)$/);
      const relEntryFileDir = path.dirname(path.relative(root, entryFile));
      const dtsPath = path.join(
        relEntryFileDir,
        isTsFile
          ? entryFileName.replace(path.extname(entryFile), '.d.ts')
          : entryFileName + '.d.ts',
      );

      const distFilePath = path.resolve(
        typesDistDir,
        isString(fileName) ? fileName : fileName!(entryName),
      );
      const configObject = ExtractorConfig.loadFile(jsonPath);
      configObject.projectFolder = root;
      configObject.dtsRollup!.untrimmedFilePath = distFilePath;
      configObject.mainEntryPointFilePath = path.resolve(typesTempDir, dtsPath);
      const extractorConfig = ExtractorConfig.prepare({
        configObject: configObject,
        configObjectFullPath: jsonPath,
        packageJsonFullPath: path.resolve(root, 'package.json'),
      });
      const { errorCount } = Extractor.invoke(extractorConfig);
      if (errorCount > 0) {
        throw new Error(`API extractor found ${errorCount} errors`);
      }
      return [
        entryName,
        {
          fileName: path.relative(typesDistDir, distFilePath),
          filePath: distFilePath,
        },
      ] as const;
    },
  );
  return Object.fromEntries(await Promise.all(promises));
}
