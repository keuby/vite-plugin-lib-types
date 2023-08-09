import type { PackageData } from 'vite';
import fs from 'fs-extra';
import path from 'pathe';

export function formatTsConfigPattern(root: string, pattern: string[]): string[] {
  return pattern.map((item) => {
    try {
      const filePath = path.resolve(root, item);
      const stat = fs.statSync(filePath);
      return stat.isDirectory() ? path.join(item, '**/*.{ts,tsx}') : item;
    } catch {
      return item;
    }
  });
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
