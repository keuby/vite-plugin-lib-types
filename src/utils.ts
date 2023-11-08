import type { PackageData } from 'vite';
import fs from 'fs-extra';
import path from 'pathe';
import { resolve, readFile } from 'tsconfig';
import type { UserOptions } from './types';

export function deduplicate<T>(arr: T[]) {
  return Array.from(new Set(arr));
}

export function formatTsConfigPattern(
  root: string,
  pattern: string[],
): Promise<string[]> {
  return Promise.all(
    pattern.map(async (item) => {
      try {
        const filePath = path.resolve(root, item);
        const stat = fs.statSync(filePath);
        return stat.isDirectory() ? path.join(item, '**/*.{ts,tsx}') : item;
      } catch {
        return item;
      }
    }),
  );
}

export async function resolveTsConfig(root: string, options: UserOptions) {
  const { tsconfigPath = await resolve(root) } = options;

  if (!tsconfigPath) {
    throw new Error('tsconfig not found');
  }

  const tsconfig = await readFile(tsconfigPath);

  const [include, exclude, extraInclude = [], extraExclude = []] = await Promise.all([
    formatTsConfigPattern(root, tsconfig.include ?? ['**/*.{ts,tsx}']),
    formatTsConfigPattern(root, tsconfig.exclude ?? ['node_modules/**', 'dist/**']),
  ]);
  return {
    path: tsconfigPath,
    include: deduplicate(include.concat(extraInclude)),
    exclude: deduplicate(exclude.concat(extraExclude)),
  };
}

export function isPlainObject(val: unknown): val is Record<string, unknown> {
  return Object.prototype.toString.call(val) === '[object Object]';
}

export function isString(val: unknown): val is string {
  return typeof val === 'string';
}

interface LookupFileOptions {
  pathOnly?: boolean;
  rootDir?: string;
}

export function lookupFile(
  dir: string,
  formats: string[],
  options?: LookupFileOptions,
): string | undefined {
  for (const format of formats) {
    const fullPath = path.join(dir, format);
    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      return options?.pathOnly ? fullPath : fs.readFileSync(fullPath, 'utf-8');
    }
  }
  const parentDir = path.dirname(dir);
  if (
    parentDir !== dir &&
    (!options?.rootDir || parentDir.startsWith(options?.rootDir))
  ) {
    return lookupFile(parentDir, formats, options);
  }
}

export function getPkgJson(root: string): PackageData['data'] {
  return JSON.parse(lookupFile(root, ['package.json']) || '{}');
}

export function getPkgName(name: string) {
  return name?.startsWith('@') ? name.split('/')[1] : name;
}

export function normalizeEntry(
  entry: string | string[] | { [entryAlias: string]: string },
  root: string,
  typesRoot: string,
): { [entryAlias: string]: string } {
  const normalizedEntry: { [entryAlias: string]: string } = {};
  if (isPlainObject(entry)) {
    for (const key in entry) {
      normalizedEntry[key] = path.resolve(root, entry[key]);
    }
  } else {
    const nameCountRecord: Record<string, number> = {};
    const entryFiles = Array.isArray(entry) ? entry : [entry];
    for (const entryFile of entryFiles) {
      const ext = path.extname(entryFile);
      const entryName = path.basename(entryFile).replace(ext, '');
      const count =
        nameCountRecord[entryName] == null
          ? (nameCountRecord[entryName] = 1)
          : ++nameCountRecord[entryName];
      const key = count === 1 ? entryName : entryName + count;
      normalizedEntry[key] = path.resolve(root, entryFile);
    }
  }

  for (const key in normalizedEntry) {
    const entryFile = normalizedEntry[key];
    const isScriptFile = !!entryFile.match(/\.([tj]sx?)$/);
    const relEntryFileDir = path.dirname(path.relative(root, entryFile));
    const relFilePath = path.join(
      relEntryFileDir,
      path.basename(entryFile, isScriptFile ? path.extname(entryFile) : '') + '.d.ts',
    );
    normalizedEntry[key] = path.join(typesRoot, relFilePath);
  }
  return normalizedEntry;
}
