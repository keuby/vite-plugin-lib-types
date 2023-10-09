import type { Comment, Node, TSType } from '@babel/types';
import type { Transformer } from '../types';
import { type NodePath, transformAsync } from '@babel/core';
import MagicString from 'magic-string';

export interface RemoveTransformerOptions {
  annotationTags?: string[];
  removeEmptyImport?: boolean;
  removeTypeKeyword?: boolean;
}

export function createRemoveTransformer(options: RemoveTransformerOptions): Transformer {
  const {
    annotationTags = [],
    removeEmptyImport = false,
    removeTypeKeyword = false,
  } = options;
  const normalizedAnnotationTags = annotationTags.map((tag) => ({
    name: tag,
    regex: new RegExp(`@${tag}\\b`),
  }));

  const needTransform = () =>
    annotationTags.length > 0 || removeEmptyImport || removeTypeKeyword;
  const getIgnoredTag = (value: string): string | null => {
    for (const { name, regex } of normalizedAnnotationTags) {
      if (regex.test(value)) return name;
    }
    return null;
  };

  return async (code) => {
    if (!needTransform()) return code;

    const s = new MagicString(code);
    const removed = new Set<string>();
    const noop = () => false;

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

    const tryRemoveWithAnnotationTags =
      annotationTags.length === 0
        ? noop
        : (node: Node): boolean => {
            const comments = node.leadingComments ?? [];
            const removeTags = getRemoveTags(comments);

            if (removeTags.length > 0) {
              const start = comments[0].start;
              const end = node.end;
              if (start != null && end != null) {
                const id =
                  'id' in node && node.id?.type === 'Identifier'
                    ? node.id.name
                    : 'key' in node && node.key?.type === 'Identifier'
                    ? node.key.name
                    : null;
                if (id == null) {
                  s.remove(start, end);
                } else {
                  s.overwrite(start, end, `/* removed ${removeTags[0]}: ${id} */`);
                }
              }
              return true;
            }
            return false;
          };

    const tryRemoveEmptyImport = !removeEmptyImport
      ? noop
      : (node: Node): boolean => {
          if (node.type === 'ImportDeclaration' && node.specifiers.length === 0) {
            const { start, end } = node;
            if (start != null && end != null) {
              s.overwrite(start, end, '/* removed empty import */');
              return true;
            }
          }
          return false;
        };

    const tryRemoveNode = (node: Node) => {
      switch (true) {
        case tryRemoveWithAnnotationTags(node):
          return true;
        case tryRemoveEmptyImport(node):
          return true;
        default:
          switch (node.type) {
            case 'ClassDeclaration':
            case 'TSInterfaceDeclaration':
              node.body.body.forEach(tryRemoveNode);
              break;
            case 'TSEnumDeclaration':
            case 'TSTypeLiteral':
              node.members.forEach(tryRemoveNode);
              break;
            case 'VariableDeclaration':
              node.declarations.forEach((item) => {
                if (item.id.type === 'Identifier') {
                  const annotation = item.id.typeAnnotation;
                  if (annotation?.type === 'TSTypeAnnotation') {
                    tryRemoveTSType(annotation.typeAnnotation);
                  }
                }
              });
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
            ClassDeclaration: tryRemove,
            TSInterfaceDeclaration: tryRemove,
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
                      end += char === ',' ? 1 : 0;
                      s.remove(start, end);
                    }
                  }
                });
              }
            },
            ExportDefaultDeclaration: tryRemove,
            TSTypeAliasDeclaration: tryRemove,
            TSEnumDeclaration: tryRemove,
            VariableDeclaration: tryRemove,
            ImportDeclaration: tryRemove,
          },
        },
      ],
      sourceType: 'module',
    });

    if (removeTypeKeyword) {
      s.replaceAll(/export type/g, 'export')
        .replaceAll(
          /export\s*{([^}]+)}/g,
          (_, $1) => `export {${$1.replace(/type\s+/g, '')}}`,
        )
        .replaceAll(/import type/g, 'import')
        .replaceAll(
          /import\s*{([^}]+)}/g,
          (_, $1) => `export {${$1.replace(/type\s+/g, '')}}`,
        );
    }

    return s.hasChanged() ? s.toString() : code;
  };
}
