import { describe, test, expect } from 'vitest';
import {} from 'typescript';
import { createIgnoreTransformer } from '../src/transformer';

describe('ignore transformer', () => {
  const root = process.cwd();
  const ignoreTag = 'internal';

  async function transform(code: string) {
    const fn = createIgnoreTransformer({
      ignoreTags: [ignoreTag],
      ignoreCheck: true,
    });
    return await fn(code, { root });
  }

  test('class ignore', async () => {
    const code = `
    /**
     * @${ignoreTag}
     */
    class A {}
    `;
    expect(await transform(code)).not.toContain(`@${ignoreTag}`);
  });

  test('class property ignore', async () => {
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

  test('class method ignore', async () => {
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

  test('interface ignore', async () => {
    const code = `
    /**
     * @${ignoreTag}
     */
    interface A {}
    `;
    expect(await transform(code)).not.toContain(`@${ignoreTag}`);
  });

  test('interface ignore', async () => {
    const code = `
    /**
     * @${ignoreTag}
     */
    interface A {}
    `;
    expect(await transform(code)).not.toContain(`@${ignoreTag}`);
  });

  test('interface method', async () => {
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

  test('interface property', async () => {
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

  test('type literal', async () => {
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
});
