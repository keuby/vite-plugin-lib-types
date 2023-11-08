import type {
  NormalizedOutputOptions,
  NullValue,
  PluginContext,
  PreRenderedChunk,
  RenderedChunk,
} from 'rollup';
import type { Options } from 'rollup-plugin-dts';

export type MaybePromise<T> = T | Promise<T>;

export type Transformer = (
  this: PluginContext,
  code: string,
  chunk: RenderedChunk,
  options: NormalizedOutputOptions,
  meta: { chunks: Record<string, RenderedChunk>; root: string },
) => MaybePromise<string | NullValue>;

export interface UserOptions extends Pick<Options, 'respectExternal'> {
  tsconfigPath?: string;
  outDir?: string;
  tempDir?: string;
  pluginHook?: 'configResolved' | 'renderStart';
  noEmit?: boolean;
  fileName?: string | ((chunk: PreRenderedChunk) => string);
  transformers?: Transformer[];
}
