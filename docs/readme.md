# StackAwait

StackAwait is a library that allows you to await promises in synchronous promises by deferring the execution to an asynchronous function in the call stack. It (ab)uses a few mechanisms in JavaScript, so please read this file carefully to understand the limitations and caveats.

> WIP! This library is still in development and not ready for production use.

## Problem

Promises/asynchronous execution is very useful, but it can't be used everywhere. For example:

```ts
function __main__() {}
async function myMainFunction() {}
async function handleRequest() {}
async function runSSR() {}
function SSRComponent() {}
function App() {}
function MyComponent() {} // We're here
```

This is a simplified call stack of a generic SSR request for an imaginary framework. All functions below `runSSR()` are synchronous functions, and let's assume that they _have_ to be synchronous to work with this imaginary framework.

If we changed `MyComponent()` to be async, we would either have to re-write the entire framework to support async/await (which can be very hard, for example [global state can be a problem](#async-scopes)!), or the functions above `MyComponent()` would only return a promise, which would result in this:

```html
<!-- <SSRComponent> -->
{HTML boilerplate here}
<!-- <App> -->
<div id="app">
    <!-- <MyComponent> -->
    [object Promise]
</div>
```

This is what StackAwait solves.

## How it works

### Caching promises

To illustrate it, here's an example implementation of `stackAwait()`:

```ts
const cache = new Map();
function stackAwait<T>(promise: Promise<T>): T {
    if (cache.has(promise)) return cache.get(promise);
    throw { err: 'Cache population not implemented yet!', promise };
}
```

### Populating the cache & getting there

To actually get data into our cache, we need to run async code somewhere. This is where the magic happens: We can catch the error from our example function, await the promise, and run the function again! This looks like this:

```ts
async function runAsyncStack(nextFunction: Function) {
    while (true) {
        try {
            return nextFunction();
        } catch (e) {
            cache.set(e.promise, await e.promise);
        }
    }
}
```

Our call stack now looks like this:

```ts
function __main__() {}
async function myMainFunction() {}
async function handleRequest() {}
async function runSSR() {}
async function runAsyncStack() {} // 3. ✅ Ca(t)ching and 1. ⬇️ Calling next fn
function SSRComponent() {} //· · · · ·  ⬆️ [uncaught err]    ⬇️ [fn call]
function App() {} // · · · · · · · · ·  ⬆️ [uncaught err]    ⬇️ [fn call]
function MyComponent() {} // · · · · ·  ⬆️ [uncaught err]    ⬇️ [fn call]
function stackAwait() {} //· · · · · 2. ⬆️ Throwing on cache miss
```

### Problems with this approach

This has the slight caveat that it doesn't work. Promises are not purely functional, so we can't just re-run the same code and expect the same promise out:

```ts
const p1 = new Promise(r => r('Hello world!'));
const p2 = new Promise(r => r('Hello world!'));
assert(p1 !== p2);
```

And the same thing happens with generated values:

```ts
const curryFactory = (fn: Function) => () => fn();
const functionToRun = () => 5;
assert(curryFactory(functionToRun)() !== curryFactory(functionToRun)());
assert((() => 5) !== (() => 5));
assert({} !== {});
```

To solve this issue, two things are needed:

### Pure functions

Instead of passing in promises, we can pass in a pure function and arguments. A pure function is a function that always returns the same value for the same arguments, which has no side effects ([examples](./pure-functions.md)). Then we cache the function and its arguments, and we solved half of the problem.

### Serialization

This comes with the caveat that many objects that look alike are not actually the same in JS. For example, if we put `[1, 2, 3]` as a key in the cache and then try to get `cache[[1, 2, 3]]` it will be undefined, because `[1, 2, 3] !== [1, 2, 3]`. To solve this, we need to serialize the arguments to a comparable representation. To do this, StackAwait uses [`kvin2`](../src/kvin2).

## Caveats

### Purity

Async functions and entry functions (the function you pass to `runAsyncStack`) should be pure, if possible. If they are not pure, outdated data might be returned by StackAwait.

Side effects in async functions are _mostly_ fine, because if they always get called with the same arguments they will only be run once and then be cached. Side effects in the entry function will get called multiple times if they are before the last await.

### Serialization

Both the functions and the arguments need to be serialized to get cached properly. This means only certain data types are supported:

-   JSON primitives (Strings, Numbers, Booleans, Objects, Arrays)
-   `undefined`, `null`, `NaN`, `Infinity`, `-Infinity`
-   Typed Arrays (Float64Array, Uint16Array, etc.) and Maps & Sets (_not_ WeakMaps/Sets)
-   Object graphs with cycles, Arrays with enumerable, non-numeric properties and sparse arrays
-   `Date`, `URL`, `Error`, `BigInt`, `RegExp` and boxed primitives like `String` and `Number`
-   Functions (but _not_ closures, only the function source code is serialized)

Notably, this does _not_ include Request/Response objects, Streams, Promises or other not serializable objects. StackAwait tries to serialize them as good as possible, but for example Response objects always serialize to `Response {}`. If you need those, you can either use [virtual args](#virtual-arguments) or abstract them away in a pure function like this:

```ts
const fetchFirstChunk = async (url: string) => {
    const res = await fetch(url);
    const readStream = response.body.getReader();
    const { value } = await readStream.read();
    return value;
};
```

For example, this would not work:

```ts
let res1 = stackAwait(fetch, '/file1');
let text1 = stackAwait(res => res.text(), res1);
// Cache key: [res => res.text(), Response {}]
let res2 = stackAwait(fetch, '/file2');
let text2 = stackAwait(res => res.text(), res2);
// Cache hit! [res => res.text(), Response {}] => "[File 1 content]"
```

The response object is not fully serialized, so the cache key is the same, leading to the same result.

[//]: # 'TODO: Write warning for idiots [like me] using await res'

Note that _only_ the input and the function need to be serialized, and not the output. What happens inside the function and what comes out is up to you.

If you want to modify the serializer, you can use the `serializer` option in `stackAwait`. By default, it uses [`kvin2`](../src/kvin2).

#### Virtual arguments

Even this might still be ambiguous, for example SvelteKit automatically provides you "personalized" `fetch()` functions that store some additional data with a closure. If that happens, you can pass in more arguments in the options with the `vArgs` property. Those will only get used to determine the cache key, and will not be passed to the function, hence the name "virtual arguments". Virtual arguments, much like real arguments, get serialized to be used as a cache key.

This can also be used to make not serializable objects work:

```ts
let res = stackAwait(fetch, '/file1');
let text = stackAwait({ vArgs: '/file1', bThis: res }, res.text);
```

#### `this` & binding arguments

You may have noticed that in the last example we passed in `res.text` instead of something like `res => res.text()`. This usually would not work, but StackAwait binds `this` to the `bThis` option.

### Async scopes

By default, StackAwait stores the cache for promises in a global object, and wipes that after `runAsyncStack` has finished running the entry function. This means only functions in that call stack can access the cache, because there can be no other code running before a synchronous function returns. This, however, is _not_ the case when async functions are involved. Because the cache gets wiped immediately after the entry function returns (without awaiting any returned promises), an async function will not be able to access the cache.

The best option is to move the `runAsyncStack` call to the lowest async point in the stack. For example:

```ts
function __main__() {}
async function myMainFunction() {}
async function handleRequest() {}
async function runSSR() {} // You could call runAsyncStack here, but you need async scoping here
async function SSRComponent() {}
async function App() {} // If you call it here, you can use sync scoping without extra work
function MyComponent() {}
function stackAwait() {}
```

If that is not an option for you, you can use the `asyncScope` option in `runAsyncStack` and `stackAwait`. For example, you could use the SvelteKit `$page` store for the cache. This is not recommended though, because it can lead to memory and/or data leaks if you make a mistake when clearing the cache manually.

### Promise rejection handling

StackAwait gracefully handles promise rejections, but not exactly in the same way as `await` does. If a promise rejects, StackAwait will _not_ throw, but give you the error as a value. You can then use the `isRejection()` helper to check if the value is an error. For example:

```ts
const result = stackAwait(async () => {
    throw new Error('This is an error!');
});
if (isRejection(result)) {
    console.error('The promise rejected!', result.msg);
}
```

If you want the vanilla JS `await` behavior, pass in `rejections: "throw"` in the options of `stackAwait`. Be sure to properly use try/catch as described in the next section when using this though.

### 1st party error catching

This abuses try/catch, so naturally if you use try/catch yourself, you will get the throws from StackAwait. This can be avoided by using the `enforceStackThrows()` helper, which automatically re-throws all errors that are not from StackAwait. For example:

```ts
try {
    stackAwait(async n => n, 5);
    somethingThatThrows();
} catch (e) {
    enforceStackThrows(e);
    console.error('somethingThatThrows() indeed threw an error!');
}
```

### Error pass-through

`runAsyncStack` will use try/catch to get relevant data from `stackAwait`, but will pass unknown errors through. For example, this will still throw an exception:

```ts
await runStackAwait(() => {
    throw new Error('This is an error!');
});
```

### 3rd party error catching/injecting

Unfortunately, StackAwait will not work properly if a 3rd-party library is in the call stack that catches errors before `runAsyncStack` can catch them. In this case you can only patch the 3rd party library. For example, you can use [`patch-package`](https://github.com/ds300/patch-package) to do this.

### (Infinite) Loops

Unfortunately, [checking if a program is running in an infinite loop is hard](https://en.wikipedia.org/wiki/Halting_problem) and [there's no library that detects infinite loops yet](https://stackoverflow.com/questions/52049907/how-to-write-a-program-to-detect-infinite-loop-in-another-program#comment91050529_52049907). Even more unfortunately, you can run into infinite loops with StackAwait:

```ts
const result = stackAwait(fetch, 'https://example.com/' + Math.random());
// Cache miss! Caching 'https://example.com/0.4535510684563555' and re-running...
// Cache miss! Caching 'https://example.com/0.23251553423971472' and re-running...
// Cache miss! Caching 'https://example.com/0.18363134592003694' and re-running...
// Cache miss! ...
```

To avoid this, you can use the `maxIterations` option in `runAsyncStack`. It is 500 by default.

Note that this does _not_ handle infinite loops in promises. If you want to avoid those, consider using [`Promise.race`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/race).
