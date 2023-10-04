import path from 'pathe';
import type { Parser } from '../types';

const defaultComponentCode = `
import { defineComponent } from 'vue';
export default defineComponent({});
`.trimStart();

export function createVueParser(): Parser {
  return function (rawCode, { filePath }) {
    if (!filePath.endsWith('.vue')) return;

    const {
      parse,
      compileScript,
    }: typeof import('vue/compiler-sfc') = require('vue/compiler-sfc');

    const sfc = parse(rawCode, {
      filename: filePath,
      sourceMap: false,
    });
    const { script, scriptSetup } = sfc.descriptor;
    let suffix = '.ts';
    let code: string;
    if (script || scriptSetup) {
      if (script) {
        suffix = '.' + script.lang ?? 'ts';
      } else if (scriptSetup) {
        suffix = '.' + scriptSetup.lang ?? 'ts';
      }
      const compiled = compileScript(sfc.descriptor, {
        id: 'xxx',
        inlineTemplate: true,
        sourceMap: false,
      });
      code = compiled.content;
    } else {
      code = defaultComponentCode;
    }
    return { code, fileName: path.basename(filePath) + suffix };
  };
}
