import type { PreRenderedChunk } from 'rollup';
import type { Options } from 'rollup-plugin-dts';
import type { CompilerOptions } from 'typescript';

export type MaybePromise<T> = T | Promise<T>;

export type Parser = (
  path: string,
  code: string,
  options: { root: string },
) => MaybePromise<string | { code: string; fileName?: string } | undefined | null | void>;
export type Transformer = (
  dtsCode: string,
  options: { root: string },
) => MaybePromise<string | undefined | null | void>;

export interface UserOptions extends Pick<Options, 'respectExternal'> {
  root?: string;
  tsconfig?: {
    compilerOptions?: CompilerOptions;
    include?: string[];
    exclude?: string[];
  };
  tsconfigPath?: string;
  outDir?: string;
  tempDir?: string;
  fileName?: string | ((chunk: PreRenderedChunk) => string);
  parsers?: Parser[];
  transformers?: Transformer[];
}
