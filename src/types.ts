import type {
  PreRenderedChunk,
  NullValue,
  PluginContext,
  RenderedChunk,
  NormalizedOutputOptions,
} from 'rollup';
import type { Options } from 'rollup-plugin-dts';
import type { Project } from 'ts-morph';
import type { CompilerOptions } from 'typescript';

export type MaybePromise<T> = T | Promise<T>;

export type Parser = (
  this: Project,
  code: string,
  options: { root: string; filePath: string },
) => MaybePromise<string | { code: string; fileName?: string } | NullValue>;
export type Transformer = (
  this: PluginContext,
  code: string,
  chunk: RenderedChunk,
  options: NormalizedOutputOptions,
  meta: { chunks: Record<string, RenderedChunk>; root: string },
) => MaybePromise<string | NullValue>;

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
