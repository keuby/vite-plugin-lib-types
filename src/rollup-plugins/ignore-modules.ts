import type { Plugin } from 'rollup';
import path from 'pathe';
import { createFilter, type FilterPattern } from '@rollup/pluginutils';
import { name } from '../../package.json';

const VIRTUAL_IGNORE_MODULE_ID = 'virtual:ignored-module.d.ts';

export function ignoreModules(
  root: string,
  options: {
    include: FilterPattern;
    exclude: FilterPattern;
  },
): Plugin {
  const filter = createFilter(options.include, options.exclude, {
    resolve: root,
  });
  return {
    name: `${name}:ignore-modules`,
    resolveId(source, importer, options) {
      if (options.isEntry) return;

      const sourcePath = path.isAbsolute(source)
        ? source
        : source.startsWith('.') && importer
        ? path.resolve(path.dirname(importer), source)
        : null;
      if (sourcePath && !filter(sourcePath)) {
        return VIRTUAL_IGNORE_MODULE_ID;
      }
    },
    load(id) {
      if (id === VIRTUAL_IGNORE_MODULE_ID) {
        return `export {}`;
      }
    },
  };
}
