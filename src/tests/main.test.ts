import KVIN from '@/kvin2';
import { describe, it, expect, assert } from 'vitest';
import {
    stackAwait,
    stackAwaitOptsDefaults,
    __debug__,
    PromiseMap,
    isRejection,
    enforceStackThrows,
    runAsyncStack,
} from '@/main.js';

describe('Types', () => {
    it('should compile', () => null);
    if (Math.random() > 0) return;

    assert(stackAwait(fetch, 'test') satisfies Response);
    assert(stackAwait({}, fetch, 'test', {method: 'POST'}) satisfies Response);
});


// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ser = (arg: unknown) => stackAwaitOptsDefaults.serializer(arg as any);
const deser = (str: string) => KVIN.deserialize(str)

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
    // this test tends to be the problem child occasionally when
    // the order of the object keys differs (i <3 JS)
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
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            serializer: null as any,
            vArgs: 123,
            asyncScope: new Map(),
            bThis: 456,
            rejections: "value",
        }))
        __debug__.return_proc_args = false;
    })
});

describe("stackAwait()", () => {
    it("should throw on illegal invocations", () => {
        __debug__.disable_logging = true
        expect(() => stackAwait(fetch, 'test')).toThrow();
    })
    it("should add promises to the cache", async () => {
        let cache = new Map;
        let err: unknown
        try {
            stackAwait({
                asyncScope: cache,
                serializer: () => "key"
            }, async n => n + 1, 2)
        } catch (e) {
            err = e;
        }
        expect(err).toBe(__debug__.stackAwaitError)
        let res = cache.get("key")
        expect(await res.promise).toBe(3)
        expect(res.state).toBe("pending")
    })
    it("should return when it finds a still pending promise", async () => {
        let cache: PromiseMap = new Map;
        cache.set("key", {
            state: 'pending',
            promise: new Promise(() => {})
        })
        let firstSnap = ser(cache)
        let err: unknown
        try {
            stackAwait({
                asyncScope: cache,
                serializer: () => "key"
            }, async n => n + 1, 2)
        } catch (e) {
            err = e;
        }
        expect(err).toBe(__debug__.stackAwaitError)
        expect(ser(cache)).toBe(firstSnap)
    })
    it("should return/throw rejected promises", async () => {
        let cache: PromiseMap = new Map;
        let testErr = new Error("test")
        cache.set("key", {
            state: 'rejected',
            reason: testErr,
            promise: new Promise(() => {})
        })
        let err: unknown
        try {
            stackAwait({
                asyncScope: cache,
                serializer: () => "key",
                rejections: "throw"
            }, async n => n + 1, 2)
        } catch (e) {
            err = e
        }
        expect(err).toBe(testErr)
        expect(isRejection(err)).toBe(true)
        let res = stackAwait({
            asyncScope: cache,
            serializer: () => "key",
        }, async n => n + 1, 2)
        expect(res).toBe(testErr)
        expect(isRejection(res)).toBe(true)
    })
    it("should cache resolved promises", async () => {
        let cache: PromiseMap = new Map;
        cache.set("key", {
            state: 'fulfilled',
            value: 3,
            promise: new Promise(() => {})
        })
        expect(stackAwait({
            asyncScope: cache,
            serializer: () => "key",
        }, async n => n + 1, 2)).toBe(3)
    })
})
describe("Helpers", () => {
    it("should correctly display the error", () => {
        let cache: PromiseMap = new Map;
        let err: unknown
        try {
            stackAwait({
                asyncScope: cache,
            }, (async () => 1))
        } catch (e) {
            err = e;
        }
        expect(err.toString()).toBe(__debug__.errDesc)
    })
    it("should enforce stack throws", () => {
        expect(() => enforceStackThrows(__debug__.stackAwaitError)).toThrow()
        expect(() => enforceStackThrows(new Error("test"))).not.toThrow()
    })
})
describe("runAsyncStack()", () => {
    it("should generally work", async () => {
        let obj = {
            val: 0,
            async increment(n: number) {
                this.val += n
            }
        }
        await runAsyncStack({
            bThis: obj,
        }, obj.increment, 1)
        expect(obj.val).toBe(1)
        let res = await runAsyncStack(input => {
            stackAwait(() => obj.increment(input))
            return obj.val
        }, 1)
        expect(res).toBe(2)
    })
    const ms = (n: number) => new Promise(resolve => setTimeout(resolve, n))
    it("should detect improper async usage", async () => {
        await expect(async () => await runAsyncStack(async () => {
            await ms(10)
            return stackAwait(async () => 42)
        })).rejects.toThrow(/Illegal invocation/)
    })
    it("should work with async scopes", async () => {
        let cache: PromiseMap = new Map;
        let res = await runAsyncStack({asyncScope: cache}, async () => {
            await ms(10)
            return stackAwait({asyncScope: cache}, async () => 42);
        });
        expect(res).toBe(42)
    })
    it("should have an iteration limit", async () => {
        await expect(async () => await runAsyncStack(() => {
            stackAwait(async n => n, Math.random());
        })).rejects.toThrow(/Maximum iterations/)
    })
    it("should handle rejected promises", async () => {
        await runAsyncStack(() => {
            let res = stackAwait(() => fetch("-"))
            expect(isRejection(res)).toBe(true)
        })
    })
})