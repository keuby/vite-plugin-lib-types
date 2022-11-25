import fs from 'fs-extra';
import path from 'path';

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
