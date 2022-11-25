import type { CompilerOptions } from 'typescript';

export interface Options {
  enable?: boolean;
  tsconfig?: {
    compilerOptions?: CompilerOptions;
    include?: string[];
    exclude?: string[];
  };
  tsconfigPath?: string;
  apiExtractorConfigPath?: string;
  fileName?: string | ((entryName: string) => string);
}
