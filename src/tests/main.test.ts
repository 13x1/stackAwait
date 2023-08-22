import KVIN from '@/kvin2';
import { describe, it, expect, assert } from 'vitest';
import { stackAwait, stackAwaitOptsDefaults, __debug__ } from '@/main.js';

describe('Types', () => {
    it('should compile', () => null);
    if (Math.random() > 0) return;

    assert(stackAwait(fetch, 'test') satisfies Response);
    assert(stackAwait({}, fetch, 'test', {method: 'POST'}) satisfies Response);
});


const ser = (arg: unknown) => stackAwaitOptsDefaults.serializer(() => null, [], arg);

function deser(str: string): unknown {
    return (KVIN.deserialize(str) as {
        vArgs: unknown
    }).vArgs;
}

describe('Serialization', () => {
    function test(gen: () => Array<unknown>, snap = true, mapper = (e: unknown) => e) {
        expect(ser(gen()), 'serialization').toBe(ser(gen()));
        expect(gen().map(mapper), 'equality').toEqual(gen().map(mapper));
        expect(gen().map(mapper), 're-serialized equality').toStrictEqual(
            (deser(ser(gen())) as Array<unknown>).map(mapper),
        );
        if (snap) expect(ser(gen())).toMatchSnapshot();
    }

    it('should serialize JSON primitives', () => {
        test(() => ['test', 1, true, {test: 'test'}, ['test', 1, true, {test: 'test'}]]);
    });

    it('should serialize undefined, null, NaN, Infinity, -Infinity', () => {
        test(() => [undefined, null, NaN, Infinity, -Infinity]);
    });

    it('should serialize Typed Arrays (Float64Array, Int64Array, etc.) and Maps & Sets', () => {
        test(() => [
            new Float64Array([1, 2, 3]),
            new Uint16Array([1, 2, 3]),
            new Map([['test', 'test']]),
            new Set(['test', '123']),
        ]);
    });

    it('should serialize Object graphs with cycles, Arrays with enumerable, non-numeric properties and sparse arrays', () => {
        test(() => {
            // Object graphs with cycles
            const obj = {test: 'test'};
            // eslint-disable-next-line
            (obj as any).obj = obj;
            // Arrays with enumerable, non-numeric properties and sparse arrays
            const arr = ['test', 1, true, {test: 'test'}];
            // eslint-disable-next-line
            (arr as any).test = 'test';
            arr[10] = 'test';
            return [obj, arr];
        });
    });

    it('should serialize Date, URL, Error, BigInt, RegExp and boxed primitives like String and Number', () => {
        const date = new Date('2023-07-23T19:33:45.093Z');
        // noinspection JSPrimitiveTypeWrapperUsage
        test(() => [
            date,
            new URL('https://example.com'),
            BigInt(123),
            /test/,
            new String('test'),
            new Number(123),
        ]);
        // errors tend to be a problem child bc stack traces can be different
        const err = new Error('test');
        test(() => [err], false);
    });

    it('should serialize functions', () => {
        test(
            () => {
                async function* test1() {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    yield 'test';
                }

                return [
                    test1,
                    async function* test2() {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        yield 'test';
                    },
                    async function* () {
                        yield 'test';
                    },
                    async () => 5,
                    () => {
                        return 5;
                    },
                ];
            },
            true,
            e => e.toString(),
        );
    });

    it('should fail to serialize closures', () => {
        test(
            () => {
                const n = Math.random();

                async function* test1() {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    yield n;
                }

                return [
                    test1,
                    async function* test2() {
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        yield n;
                    },
                    async function* () {
                        yield n;
                    },
                    async () => n,
                    () => {
                        return n;
                    },
                ];
            },
            true,
            e => e.toString(),
        );
    });

    it('should fail to serialize promises', () => {
        test(
            () => {
                const n = Math.random();
                const p = new Promise(resolve => resolve(n));
                return [p];
            },
            true,
            e => e.toString(),
        );
    });

    it('should fail to serialize objects like Response', () => {
        test(
            () => {
                return [new Response(Math.random().toString())];
            },
            true,
            e => e.toString(),
        );
    });
});

// 

describe('Argument parsing', () => {
    it('should work with options', () => {
        __debug__.return_args = true;
        const res = stackAwait({
            vArgs: 123,
            bThis: 456,
            asyncScope: new Map(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            serializer: null as any,
        }, async n => n, 42)

        expect(ser(res)).toBe(ser({
            opts: {
                vArgs: 123,
                bThis: 456,
                asyncScope: new Map(),
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                serializer: null as any,
            },
            func: (() => (async (n: number) => n))(),
            args: [42]
        }))
        __debug__.return_args = false;
    });
    it('should work with empty options', () => {
        __debug__.return_args = true;
        const res = stackAwait({

        }, async n => n, 42)

        expect(ser(res)).toBe(ser({
            opts: {

            },
            func: (() => (async (n: number) => n))(),
            args: [42]
        }))
        __debug__.return_args = false;
    });
    it('should work with no options', () => {
        __debug__.return_args = true;
        const res = stackAwait(async n => n, 42)

        expect(ser(res)).toBe(ser({
            opts: {},
            func: (() => (async (n: number) => n))(),
            args: [42]
        }))
        __debug__.return_args = false;
    });
    // parse with no options, some options and all options set
    it('should work with no options after parsing', () => {
        __debug__.return_proc_args = true;
        const res = stackAwait(async n => n, 42)
        expect(ser(res)).toBe(ser(stackAwaitOptsDefaults))
        __debug__.return_proc_args = false;
    })
    it('should work with some options after parsing', () => {
        __debug__.return_proc_args = true;
        const res = stackAwait({
            vArgs: 123,
            bThis: 456,
        }, async n => n, 42)
        expect(ser(res)).toBe(ser({
            ...stackAwaitOptsDefaults,
            vArgs: 123,
            bThis: 456,
        }))
        __debug__.return_proc_args = false;
    })
    it('should work with all options after parsing', () => {
        __debug__.return_proc_args = true;
        const res = stackAwait({
            vArgs: 123,
            bThis: 456,
            asyncScope: new Map(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            serializer: null as any,
        }, async n => n, 42)
        expect(ser(res)).toBe(ser({
            vArgs: 123,
            bThis: 456,
            asyncScope: new Map(),
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            serializer: null as any,
        }))
        __debug__.return_proc_args = false;
    })
});
