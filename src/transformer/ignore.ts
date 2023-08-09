import type { Comment, Node, TSType } from '@babel/types';
import type { Transformer } from '../types';
import { type NodePath, transformAsync } from '@babel/core';
import MagicString from 'magic-string';

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

  return async (code) => {
    if (!needTransform()) return code;

    const s = new MagicString(code);

    const removed = new Set<string>();

    const removeWithComma = (start: number, end: number) => {};

    const getRemoveTags = (comments: Comment[]): string[] => {
      const ignoreTagNames: string[] = [];
      for (const comment of comments) {
        const name = getIgnoredTag(comment.value);
        if (name) ignoreTagNames.push(name);
      }
      return ignoreTagNames;
    };

    const tryRemoveTSType = (annotation: TSType) => {
      switch (annotation.type) {
        case 'TSTypeLiteral':
          annotation.members.forEach(tryRemoveNode);
          break;
        case 'TSIntersectionType':
        case 'TSUnionType':
          annotation.types.forEach(tryRemoveNode);
          break;
        case 'TSArrayType':
          tryRemoveTSType(annotation.elementType);
          break;
        case 'TSParenthesizedType':
          tryRemoveTSType(annotation.typeAnnotation);
          break;
        case 'TSTypeReference':
          if (annotation.typeParameters) {
            annotation.typeParameters.params.forEach(tryRemoveNode);
          }
          break;
      }
    };

    const tryRemoveNode = (node: Node) => {
      const comments = node.leadingComments ?? [];
      const removeTags = getRemoveTags(comments);
      if (removeTags.length > 0) {
        const start = comments[0].start!;
        const end = node.end!;
        const id =
          'id' in node && node.id?.type === 'Identifier'
            ? node.id.name
            : 'key' in node && node.key?.type === 'Identifier'
            ? node.key.name
            : '';
        id
          ? s.overwrite(start, end, `/* removed internal: ${id} */`)
          : s.remove(start, end);
        return true;
      } else {
        switch (node.type) {
          case 'ClassDeclaration':
          case 'TSInterfaceDeclaration':
            node.body.body.forEach(tryRemoveNode);
            break;
          case 'TSEnumDeclaration':
          case 'TSTypeLiteral':
            node.members.forEach(tryRemoveNode);
            break;
          case 'ExportNamedDeclaration':
            if (node.declaration != null) {
              tryRemoveNode(node.declaration);
            }
            break;
          case 'TSTypeAliasDeclaration':
            tryRemoveTSType(node.typeAnnotation);
            if (node.typeParameters) {
              node.typeParameters.params.forEach((param) => {
                param.constraint && tryRemoveTSType(param.constraint);
              });
            }
            break;
          case 'TSTypeReference':
            if (node.typeParameters) {
              node.typeParameters.params.forEach(tryRemoveTSType);
            }
            break;
          case 'TSPropertySignature': {
            const annotation = node.typeAnnotation?.typeAnnotation;
            if (annotation) tryRemoveTSType(annotation);
            break;
          }
        }
        return false;
      }
    };

    const tryRemove = (path: NodePath) => {
      if (tryRemoveNode(path.node) && path.parent.type === 'Program') {
        switch (path.node.type) {
          case 'VariableDeclaration':
            path.node.declarations.forEach((item) => {
              if (item.id.type === 'Identifier') {
                removed.add(item.id.name);
              }
            });
            break;
          case 'ClassDeclaration':
          case 'TSInterfaceDeclaration':
          case 'TSEnumDeclaration':
          case 'TSTypeAliasDeclaration':
            removed.add(path.node.id.name);
            break;
        }
      }
    };

    await transformAsync(code, {
      filename: 'types.d.ts',
      presets: ['@babel/preset-typescript'],

      plugins: [
        {
          visitor: {
            ClassDeclaration: (path) => {
              if (tryRemoveNode(path.node) && path.parent.type === 'Program') {
                removed.add(path.node.id.name);
              }
            },
            TSInterfaceDeclaration: (path) => {
              if (tryRemoveNode(path.node) && path.parent.type === 'Program') {
                removed.add(path.node.id.name);
              }
            },
            ExportNamedDeclaration: (path) => {
              if (path.node.declaration) {
                tryRemove(path);
              } else if (path.node.specifiers.length > 0) {
                path.node.specifiers.forEach((specifier) => {
                  if (specifier.type === 'ExportSpecifier') {
                    if (removed.has(specifier.local.name)) {
                      const start = specifier.start!;
                      let end = specifier.end!,
                        char: string;
                      while ((char = s.original[end + 1]) && char.match(/\s/)) end++;
                      end += char === ',' ? 0 : -1;
                      s.remove(start, end);
                    }
                  }
                });
              }
            },
            ExportDefaultDeclaration: tryRemove,
            TSTypeAliasDeclaration: tryRemove,
          },
        },
      ],
      sourceType: 'module',
    });

    code = s.toString();

    if (!ignoreCheck) {
      const unhandledTags: string[] = normalizedIgnoreTags
        .filter((tag) => tag.regex.test(code))
        .map((tag) => tag.name);
      if (unhandledTags.length > 0) {
        throw new Error(`unhandled ${unhandledTags.join(',')} declarations detected`);
      }
    }

    return code;
  };
}
