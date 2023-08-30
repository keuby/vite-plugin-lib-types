import type { Plugin } from 'rollup';
import type { UserOptions } from '../types';
import { name } from '../../package.json';

export function patchTypes(root: string, options: UserOptions): Plugin {
  return {
    name: `${name}:patch-types`,
    async renderChunk(code, chunk, opts, meta) {
      if (options.transformers) {
        for (const fn of options.transformers!) {
          const parsedCode = await fn.apply(this, [code, chunk, opts, { root, ...meta }]);
          if (typeof parsedCode === 'string') {
            code = parsedCode;
          }
        }
      }
      return code;
    },
  };
}
