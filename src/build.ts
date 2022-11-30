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
import pkg from '../package.json';
import type { Options } from './types';

export async function build(
  root: string,
  entry: string | string[] | { [entryAlias: string]: string },
  options: Options
) {
  const {
    tsconfig: {
      compilerOptions = {},
      include: inputInclude = [],
      exclude: inputExclude = [],
    } = {},
    apiExtractorConfigPath = 'api-extractor.json',
    tsconfigPath = await resolve(root),
  } = options;

  if (!tsconfigPath) {
    throw new Error('tsconfig not found');
  }

  const typesTempDir = path.join(root, '.temp');
  const typesDistDir = path.join(root, 'node_modules/.temp');
  const tsconfig = await readFile(tsconfigPath);
  const include: string[] = tsconfig.include ?? ['**/*.{ts,tsx}'];
  const exclude: string[] = tsconfig.exclude ?? ['node_modules/**', 'dist/**'];

  const project = new Project({
    compilerOptions: {
      ...compilerOptions,
      rootDir: root,
      baseUrl: root,
      outDir: typesTempDir,
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

  await Promise.all(
    files.map(async (file) => {
      if (file.endsWith('.vue')) {
        const { parse, compileScript } = await import('@vue/compiler-sfc');
        const sfc = parse(await fs.readFile(file, 'utf-8'));
        const { script, scriptSetup } = sfc.descriptor;
        if (script || scriptSetup) {
          let isTS = false;
          let isTSX = false;
          if (script) {
            if (script.lang === 'ts') isTS = true;
            if (script.lang === 'tsx') isTSX = true;
          } else if (scriptSetup) {
            if (scriptSetup.lang === 'ts') isTS = true;
            if (scriptSetup.lang === 'tsx') isTSX = true;
          }
          const compiled = compileScript(sfc.descriptor, {
            id: 'xxx',
            inlineTemplate: true,
          });

          project.createSourceFile(
            file + (isTS ? '.ts' : isTSX ? '.tsx' : '.js'),
            compiled.content
          );
        }
      } else {
        project.addSourceFileAtPath(file);
      }
    })
  );

  const diagnostics = project.getPreEmitDiagnostics();
  if (diagnostics.length > 0) {
    console.log(project.formatDiagnosticsWithColorAndContext(diagnostics));
    throw new Error('typings compile error');
  }

  if (fs.existsSync(typesTempDir)) {
    await fs.emptyDir(typesTempDir);
  } else {
    await fs.mkdir(typesTempDir, { recursive: true });
  }

  await project.emit({ emitOnlyDtsFiles: true });

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
      })
    );
  }

  const localJsonPath = path.resolve(root, apiExtractorConfigPath);
  const jsonPath = fs.existsSync(localJsonPath)
    ? localJsonPath
    : require.resolve(`${pkg.name}/api-extractor.json`);

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
          : entryFileName + '.d.ts'
      );

      const distFilePath = path.join(
        typesDistDir,
        isString(fileName) ? fileName : fileName(entryName)
      );
      const configObject = ExtractorConfig.loadFile(jsonPath);
      configObject.projectFolder = root;
      configObject.dtsRollup.untrimmedFilePath = distFilePath;
      configObject.mainEntryPointFilePath = path.join(typesTempDir, dtsPath);
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
    }
  );

  try {
    return Object.fromEntries(await Promise.all(promises));
  } finally {
    fs.rm(typesTempDir, { recursive: true });
  }
}
