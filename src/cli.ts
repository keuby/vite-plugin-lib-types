import type { Options } from './types';

import mri from 'mri';
import path from 'pathe';
import { build } from './build';
import fs from 'fs-extra';

async function main() {
  const args = mri(process.argv.splice(2));
  const entry = path.resolve(process.cwd(), args._[0] || './src/index.ts');
  const rootDir = args.root ?? process.cwd();
  const outDir = path.resolve(rootDir, args.outDir ?? 'dist');
  const result = await build(rootDir, entry, args as Options).catch((err) => {
    console.error(`Error building ${rootDir}: ${err}`);
    throw err;
  });
  await Promise.all(
    Object.values(result).map(({ fileName, filePath }) => {
      const distPath = path.resolve(outDir, fileName);
      return fs.copyFile(filePath, distPath);
    })
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
