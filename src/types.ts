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

export interface UserOptions {
  root?: string;
  enable?: boolean;
  tsconfig?: {
    compilerOptions?: CompilerOptions;
    include?: string[];
    exclude?: string[];
  };
  outDir?: string;
  tempDir?: string;
  tsconfigPath?: string;
  apiExtractorConfigPath?: string;
  fileName?: string | ((entryName: string) => string);
  parsers?: Parser[];
  transformers?: Transformer[];
}
