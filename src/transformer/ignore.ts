import type { Transformer } from '../types';
import MagicString from 'magic-string';
import { parse } from '@babel/core';
import { walk } from 'estree-walker';
import type {
  Node,
  VariableDeclaration,
  VariableDeclarator,
  TSTypeAliasDeclaration,
  TSInterfaceDeclaration,
  TSDeclareFunction,
  TSEnumDeclaration,
  ClassDeclaration,
} from '@babel/types';

export interface IgnoreTransformerOptions {
  ignoreTags?: string[];
  ignoreCheck?: boolean;
}

export function createIgnoreTransformer(options: IgnoreTransformerOptions): Transformer {
  const { ignoreTags = [], ignoreCheck } = options;
  const normalizedIgnoreTags = ignoreTags.map((tag) => ({
    name: tag,
    regex: new RegExp(`@${tag}\\b`),
  }));

  const needTransform = () => ignoreTags.length > 0;
  const getIgnoredTag = (value: string): string | null => {
    for (const { name, regex } of normalizedIgnoreTags) {
      if (regex.test(value)) return name;
    }
    return null;
  };

  return (code) => {
    if (!needTransform()) return code;

    const s = new MagicString(code);
    const ast = parse(code, {
      filename: 'types.d.ts',
      plugins: ['typescript'],
      sourceType: 'module',
    });

    function processDeclaration(
      node:
        | VariableDeclarator
        | TSTypeAliasDeclaration
        | TSInterfaceDeclaration
        | TSDeclareFunction
        | TSInterfaceDeclaration
        | TSEnumDeclaration
        | ClassDeclaration,
      parentDecl?: VariableDeclaration,
    ) {
      if (!node.id) return;
      // @ts-ignore
      const name = node.id.name;
      if (!removeIgnoredTag(parentDecl || node)) {
        if (isExported.has(name)) {
          s.prependLeft((parentDecl || node).start!, `export `);
        }
        if (node.type === 'TSInterfaceDeclaration' || node.type === 'ClassDeclaration') {
          node.body.body.forEach(removeIgnoredTag);
        } else if (node.type === 'TSTypeAliasDeclaration') {
          // @ts-ignore
          walk(node.typeAnnotation, {
            enter(node) {
              // @ts-ignore
              if (removeIgnoredTag(node)) this.skip();
            },
          });
        }
      }
    }

    function removeIgnoredTag(node: Node) {
      let ignoredTag: string | null;
      if (
        node.leadingComments &&
        node.leadingComments.some((c) => {
          return c.type === 'CommentBlock' && (ignoredTag = getIgnoredTag(c.value));
        })
      ) {
        const n: any = node;
        let id;
        if (n.id && n.id.type === 'Identifier') {
          id = n.id.name;
        } else if (n.key && n.key.type === 'Identifier') {
          id = n.key.name;
        }
        if (id) {
          s.overwrite(
            node.leadingComments[0].start!,
            node.end!,
            `/* removed ${ignoredTag!}: ${id} */`,
          );
        } else {
          s.remove(node.leadingComments[0].start!, node.end!);
        }
        return true;
      }
      return false;
    }

    const isExported = new Set();
    const shouldRemoveExport = new Set();

    const programBody = ast?.program?.body ?? [];
    // pass 0: check all exported types
    for (const node of programBody) {
      if (node.type === 'ExportNamedDeclaration' && !node.source) {
        for (let i = 0; i < node.specifiers.length; i++) {
          const spec = node.specifiers[i];
          if (spec.type === 'ExportSpecifier') {
            isExported.add(spec.local.name);
          }
        }
      }
    }

    // pass 1: remove internals + add exports
    for (const node of programBody) {
      if (node.type === 'VariableDeclaration') {
        processDeclaration(node.declarations[0], node);
        if (node.declarations.length > 1) {
          throw new Error(
            `unhandled declare const with more than one declarators:\n${code.slice(
              node.start!,
              node.end!,
            )}`,
          );
        }
      } else if (
        node.type === 'TSTypeAliasDeclaration' ||
        node.type === 'TSInterfaceDeclaration' ||
        node.type === 'TSDeclareFunction' ||
        node.type === 'TSEnumDeclaration' ||
        node.type === 'ClassDeclaration'
      ) {
        processDeclaration(node);
      } else {
        removeIgnoredTag(node);
      }
    }

    // pass 2: remove exports
    for (const node of programBody) {
      if (node.type === 'ExportNamedDeclaration' && !node.source) {
        let removed = 0;
        for (let i = 0; i < node.specifiers.length; i++) {
          const spec = node.specifiers[i];
          if (
            spec.type === 'ExportSpecifier' &&
            shouldRemoveExport.has(spec.local.name)
          ) {
            // @ts-ignore
            const exported = spec.exported.name;
            if (exported !== spec.local.name) {
              continue;
            }
            const next = node.specifiers[i + 1];
            if (next) {
              s.remove(spec.start!, next.start!);
            } else {
              const prev = node.specifiers[i - 1];
              s.remove(prev ? prev.end! : spec.start!, spec.end!);
            }
            removed++;
          }
        }
        if (removed === node.specifiers.length) {
          s.remove(node.start!, node.end!);
        }
      }
    }
    code = s.toString();

    if (!ignoreCheck) {
      const unhandledTags: string[] = ignoreTags?.filter((tag) => code.includes(tag));
      if (unhandledTags.length > 0) {
        throw new Error(`unhandled ${unhandledTags.join(',')} declarations detected`);
      }
    }

    return code;
  };
}
