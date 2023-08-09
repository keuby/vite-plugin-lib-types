import mri from 'mri';
import path from 'pathe';
import { createProject, buildTypes } from './build';
import fs from 'fs-extra';

async function main() {
  const args = mri(process.argv.splice(2));
  const entry = path.resolve(process.cwd(), args._[0] || './src/index.ts');
  const rootDir = args.root ?? process.cwd();
  const outDir = path.resolve(rootDir, args.outDir ?? 'dist');
  const tempDir = path.resolve(rootDir, args.tempDir ?? outDir, '.temp');
  const options = Object.assign(
    {
      entry: entry,
      root: process.cwd(),
    },
    args,
    { outDir, tempDir },
  );
  try {
    const project = await createProject(options);
    await project.emit({ emitOnlyDtsFiles: true });
    const buildResult = await buildTypes(options);
    // await Promise.all(
    //   Object.values(buildResult).map(async ({ fileName, filePath }) => {
    //     const distPath = path.resolve(outDir, fileName);
    //     const distDir = path.dirname(distPath);
    //     if (!fs.existsSync(distDir)) {
    //       await fs.mkdir(distDir, { recursive: true });
    //     }
    //     return fs.copyFile(filePath, distPath);
    //   }),
    // );
  } finally {
    await fs.rm(tempDir, { recursive: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
