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

interface StackAwaitOpts<This = undefined> {
    /**
     * Serialize an async function call to a string.
     * @param {(...a: AU) => unknown} fn The function (needs to be serialized too!)
     * @param {AU} args The arguments to the function
     * @param vArgs The virtual arguments to the function
     * @returns {string}
     */
    serializer: (fn: (...a: AU) => unknown, args: AU, vArgs: unknown) => string;
    /**
     * The virtual arguments to the function.
     */
    vArgs: unknown;
    /**
     * The async scope object to use.
     * Pass `false` or `undefined` to disable.
     */
    asyncScope:
        | undefined
        | false
        | Map<string, PromiseResult<unknown>>;
    /**
     * Bind (`this`) argument
     */
    bThis: This
}

export const stackAwaitOptsDefaults: StackAwaitOpts = {
    serializer: (fn, args, vArgs) => KVIN.stringify({fn, args, vArgs}),
    vArgs: undefined,
    asyncScope: undefined,
    bThis: undefined
};

type Opts<T> = Partial<StackAwaitOpts<T>>;

export function stackAwait<Args extends AU, Return, This = undefined>(
    opts: Opts<This>,
    fn: (this: This, ...args: Args) => Promise<Return>,
    ...args: Args
): Return;
export function stackAwait<Args extends AU, Return>(
    fn: (...args: Args) => Promise<Return>,
    ...args: Args
): Return;
export function stackAwait(...args: unknown[]) {
    const opts = typeof args[0] === 'object' ? args.shift() : {};
    const func = args.shift() as (...args: unknown[]) => Promise<unknown>;
    if (__debug__.return_args) return {opts, func, args};

    const options = Object.assign({}, stackAwaitOptsDefaults, opts);

    if (__debug__.return_proc_args) return options;


    return null
}

let cache = new Map<string, PromiseResult<unknown>>();

export const __debug__ = {
    return_args: false,
    return_proc_args: false,
}
