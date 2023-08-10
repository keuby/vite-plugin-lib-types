import fs from 'fs-extra';
import path from 'pathe';
import type { Transformer } from '../types';

export interface DeclareTransformerOptions {
  files?: string[];
  imports?: string[];
  addEmptyExport?: boolean;
}

export function createDeclareTransformer(
  options: string | string[] | DeclareTransformerOptions,
): Transformer {
  const fileList: string[] = [];
  const importList: string[] = [];
  let addEmptyExport = false;
  if (Array.isArray(options)) {
    fileList.push(...options);
  } else if (typeof options === 'string') {
    fileList.push(options);
  } else {
    const { files = [], imports = [] } = options;
    fileList.push(...files);
    importList.push(...imports);
    addEmptyExport = options.addEmptyExport ?? false;
  }

  return async (dtsCode, ...restArgs) => {
    const root = restArgs[2].root;
    const declareList = (
      await Promise.all(
        fileList.map(async (file) => {
          const filePath = path.resolve(root, file);
          const code = await fs.readFile(filePath, 'utf-8');
          const regex = /declare\s+module\s+(['"])(.*?)\1\s*{([\s\S]*?})\s*}/g;
          let matches: RegExpExecArray | null = null;
          const declareList: string[] = [];
          while ((matches = regex.exec(code)) !== null) {
            declareList.push(matches[0]);
          }
          return declareList;
        }),
      )
    ).flat();
    if (importList.length > 0) {
      dtsCode = importList.join('\n') + '\n' + dtsCode;
    }
    if (declareList.length > 0) {
      dtsCode = dtsCode + '\n' + declareList.join('\n');
    }
    if (addEmptyExport) {
      dtsCode = dtsCode = '\n' + 'export {}\n';
    }
    return dtsCode;
  };
}
