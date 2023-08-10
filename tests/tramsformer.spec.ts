import { describe, test, expect } from 'vitest';
import path from 'pathe';
import { createRemoveTransformer } from '../src/transformer';

describe('remove transformer: annotationTags', () => {
  const root = process.cwd();
  const ignoreTag = 'internal';

  async function transform(code: string) {
    const fn = createRemoveTransformer({
      annotationTags: [ignoreTag],
    });
    // @ts-ignore
    return await fn(code, { fileName: path.join(root, 'types.d.ts') });
  }

  test('class remove', async () => {
    const code = `
    /**
     * @${ignoreTag}
     */
    class A {}
    `;
    expect(await transform(code)).not.toContain(`@${ignoreTag}`);
  });

  test('class property remove', async () => {
    const code = `
    class A {
      /**
       * @${ignoreTag}
       */
      private a: string = 5;
    }
    `;
    expect(await transform(code)).not.toContain(`@${ignoreTag}`);
  });

  test('class method remove', async () => {
    const code = `
    class A {
      /**
       * @${ignoreTag}
       */
      private test(): void {}
    }
    `;
    expect(await transform(code)).not.toContain(`@${ignoreTag}`);
  });

  test('interface remove', async () => {
    const code = `
    /**
     * @${ignoreTag}
     */
    interface A {}
    `;
    expect(await transform(code)).not.toContain(`@${ignoreTag}`);
  });

  test('interface remove', async () => {
    const code = `
    /**
     * @${ignoreTag}
     */
    interface A {}
    `;
    expect(await transform(code)).not.toContain(`@${ignoreTag}`);
  });

  test('interface method remove', async () => {
    const code = `
    interface A {
      /**
       * @${ignoreTag}
       */
      test(): void;
    }
    `;
    expect(await transform(code)).not.toContain(`@${ignoreTag}`);
  });

  test('interface property remove', async () => {
    const code = `
    interface A {
      /**
       * @${ignoreTag}
       */
      a: string;
    }
    `;
    expect(await transform(code)).not.toContain(`@${ignoreTag}`);
  });

  test('type literal remove', async () => {
    const code = `
    type A = B & {
      /**
       * @${ignoreTag}
       */
      a: string;
      c: number
    } & Array<{
      /**
       * @${ignoreTag}
       */
      f: string;
    }>
    `;
    expect(await transform(code)).not.toContain(`@${ignoreTag}`);
  });

  test('enum define remove', async () => {
    const code = `
    /**
     * @${ignoreTag}
     */
    enum Test1 {}

    enum Test2 {
      /* @${ignoreTag} */
      a = 5,
      b = 6,
    }

    export { Test1, Test2 }
    `;
    const result = await transform(code);
    expect(result).not.toContain(`@${ignoreTag}`);
    expect(result).not.toContain('export { Test1');
  });

  test('var define remove', async () => {
    const code = `
    /**
     * @${ignoreTag}
     */
    const a = 5;

    let b: string;

    declare const c: {
      /**
       * @${ignoreTag}
       */
      d: string;
      f: number;
      e: {
        /**
         * @${ignoreTag}
         */
        g: boolean;
        h: number[];
      }
    }

    export { a, b, c }
    `;
    const result = await transform(code);
    expect(result).not.toContain(`@${ignoreTag}`);
    expect(result).not.toContain('export { a');
  });
});

describe('remove transformer: removeEmptyImport', () => {
  const root = process.cwd();

  async function transform(code: string) {
    const fn = createRemoveTransformer({
      removeEmptyImport: true,
    });
    // @ts-ignore
    return await fn(code, { fileName: path.join(root, 'types.d.ts') });
  }

  test('empty import', async () => {
    const code = `
    import {} from 'a';
    import { B } from 'b';
    import 'c';
    `;
    const result = await transform(code);
    expect(result).not.toContain(`'a'`);
    expect(result).not.toContain(`'c'`);
    expect(result).toContain(`'b'`);
  });
});
