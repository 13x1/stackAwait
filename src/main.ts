import KVIN from '@/kvin2';

type AU = Array<unknown>;

type PromiseResult<T> = {
    state: "fulfilled",
    value: T,
    promise: Promise<T>
} | {
    state: "rejected",
    reason: Error,
    promise: Promise<T>
} | {
    state: "pending",
    promise: Promise<T>
}

interface FunctionalCallData {
    fn: (...args: AU) => unknown;
    args: AU;
    vArgs: unknown;
    bThis: unknown;
}

export type PromiseMap = Map<string, PromiseResult<unknown>>

interface StackAwaitOpts<This = undefined> {
    /**
     * Serialize an async function call to a string.
     */
    serializer: (data: FunctionalCallData) => string;
    /**
     * The virtual arguments to the function.
     */
    vArgs: unknown;
    /**
     * The async scope object to use.
     * Pass `false` or `undefined` to disable.
     */
    asyncScope: undefined | false | PromiseMap
    /**
     * Bind (`this`) argument
     */
    bThis: This,
    /**
     * Whether to throw or return the rejection as a value with a
     * marker to be used with {@link isRejection}. Default is `value`,
     * because try/catch is annoying to use given that we abuse it ourselves.
     */
    rejections: "value" | "throw"
}

export const stackAwaitOptsDefaults: StackAwaitOpts = {
    serializer: data => KVIN.stringify(data),
    vArgs: undefined,
    asyncScope: undefined,
    bThis: undefined,
    rejections: "value"
};

let nullCache = new Map();
let currentGlobalCache: PromiseMap = nullCache

function logAndThrow(m: unknown) {
    if (!__debug__.disable_logging) console.error(m)
    throw m
}

export function stackAwait<Args extends AU, Return, This = undefined>(
    opts: Partial<StackAwaitOpts<This>>,
    fn: (this: This, ...args: Args) => Promise<Return>,
    ...args: Args
): Return;
export function stackAwait<Args extends AU, Return>(
    fn: (...args: Args) => Promise<Return>,
    ...args: Args
): Return;
export function stackAwait(...args: unknown[]) {
    const o = typeof args[0] === 'object' ? args.shift() : {};
    const fn = args.shift() as (...args: unknown[]) => Promise<unknown>;
    if (__debug__.return_args) return {opts: o, func: fn, args};
    const options = Object.assign({}, stackAwaitOptsDefaults, o);
    if (__debug__.return_proc_args) return options;

    const cache: PromiseMap = options.asyncScope || currentGlobalCache
    if (cache === nullCache) logAndThrow(new Error("Illegal invocation: Not called inside runAsyncStack() or custom scope"))

    let serialized = options.serializer({
        fn, args, vArgs: options.vArgs, bThis: options.bThis
    })

    // magic happens here
    let cacheHit = cache.get(serialized)
    if (!cacheHit) {
        cache.set(serialized, {
            state: 'pending',
            promise: fn.apply(options.bThis, args)
        })
        throw stackAwaitError
    } else if (cacheHit.state === 'pending') {
        // usually this shouldn't happen, but still
        throw stackAwaitError
    } else if (cacheHit.state === 'rejected') {
        if (options.rejections === "throw") throw genRejection(cacheHit.reason)
        return genRejection(cacheHit.reason)
    } else if (cacheHit.state === "fulfilled") {
        return cacheHit.value
    }
}

interface RunAsyncStackOpts<This = undefined> {
    /**
     * The maximum amount iterations to run before giving up.
     * @see Halting problem
     */
    maxIterations: number;
    /**
     * The async scope object to use.
     * Pass `false` or `undefined` to disable.
     */
    asyncScope: undefined | false | PromiseMap,
    /**
     * Bind (`this`) argument
     */
    bThis: This,
}

export const runAsyncStackOptsDefaults: RunAsyncStackOpts = {
    maxIterations: 500,
    asyncScope: undefined,
    bThis: undefined,
}

export async function runAsyncStack<Args extends AU, Return, This = undefined>(
    opts: Partial<RunAsyncStackOpts<This>>,
    fn: (this: This, ...args: Args) => Return,
    ...args: Args
): Promise<Return>;
export async function runAsyncStack<Args extends AU, Return>(
    fn: (...args: Args) => Return,
    ...args: Args
): Promise<Return>;
export async function runAsyncStack(...args: unknown[]) {
    const o = typeof args[0] === 'object' ? args.shift() : {};
    const fn = args.shift() as (...args: unknown[]) => unknown;
    const options = Object.assign({}, runAsyncStackOptsDefaults, o);
    const localCache = options.asyncScope || new Map()
    for (let att = 0; att < options.maxIterations; att++) {
        let returnValue = null
        let error = null
        let caught = false
        const prevCache = currentGlobalCache
        currentGlobalCache = localCache
        // collect promise
        try {
            returnValue = fn.apply(options.bThis, args)
        } catch (e) {
            caught = true
            error = e
        }
        currentGlobalCache = prevCache
        if (returnValue instanceof Promise) {
            try {
                returnValue = await returnValue
            } catch (e) {
                caught = true
                error = e
            }
        }
        if (caught && error !== stackAwaitError) {
            throw error
        }
        if (caught) {
            // resolve cache
            for (let [_, entry] of localCache) {
                if (entry.state === "pending") {
                    try {
                        entry.state = "fulfilled"
                        entry.value = await entry.promise
                    } catch (e) {
                        entry.state = "rejected"
                        entry.reason = e
                    }
                }
            }
            continue
        }
        return returnValue
    }
    throw new Error("Maximum iterations reached!")
}

let rejectionSymbol = Symbol("Promise rejection")

export function isRejection(r: unknown): r is Error {
    return (r as any)[rejectionSymbol] !== undefined
}

function genRejection(e: Error) {
    (e as any)[rejectionSymbol] = true
    if (!isRejection(e)) return {value: e, [rejectionSymbol]: true}
    return e
}

let errDesc = "StackAwait error. If you caught this, please see the docs.";
let stackAwaitErrorSymbol = Symbol(errDesc)

let stackAwaitError = {
    [stackAwaitErrorSymbol]: true,
    toString: () => errDesc
}

export function enforceStackThrows(e: unknown) {
    // let err = (e as any)[stackAwaitErrorSymbol]
    if (e === stackAwaitError) throw e
}

export const __debug__ = {
    return_args: false,
    return_proc_args: false,
    disable_logging: false,
    stackAwaitError, errDesc
}