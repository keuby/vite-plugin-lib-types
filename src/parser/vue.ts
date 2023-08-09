import path from 'pathe';
import type { Parser } from '../types';
import type { SFCScriptCompileOptions, SFCParseOptions } from 'vue/compiler-sfc';

const defaultComponentCode = `
import { defineComponent } from 'vue';
export default defineComponent({});
`.trimStart();

export interface VueParserOptions {
  parseOptions?: SFCParseOptions;
  scriptCompileOptions?: SFCScriptCompileOptions;
}

export function createVueParser(options: VueParserOptions = {}): Parser {
  return (filePath, rawCode) => {
    if (!filePath.endsWith('.vue')) return;

    const { parse, compileScript } = require('vue/compiler-sfc');
    const sfc = parse(rawCode, options.parseOptions);
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
        ...options.scriptCompileOptions,
      });
      code = compiled.content;
    } else {
      code = defaultComponentCode;
    }
    return { code, fileName: path.basename(filePath) + suffix };
  };
}
