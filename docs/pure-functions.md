This is a pure function:

```jsx
function add(a, b) {
    return a + b;
}
add(1, 2) === 3
add(1, 2) === 3 // ✅ pure
```

It's easier to explain what a pure function is by explaining what a non-pure function is:

```jsx
function add(a, b) {
    console.log(a + b); // Side effect here
    return a + b;
}
add(1, 2) === 3
[console]% 3 // ❌ not pure: side effect
```

Side effects, like writing to the console or writing (not reading!) to a database, lead to nasty bugs when called
multiple times with the same input. Another example of this is (global) state:

```jsx
let views = 0; // Global state variable here
function getViews() {
    return views++; // Global state change here
}
getViews() === 0
getViews() === 1 // ❌ not pure: same input, different output
```

On the other hand, if your function has internal state (or even global state but resetting it when no other code is
using it at the same time, like in synchronous JS), it can still be pure as long as you don't see the side effects from
outside the function:

```jsx
let globals;
function render() {
    globals = {components: 0};
    return (<div>
        <Component />
        <Component />
        {globals.components} components
    </div>)
}
render() === `<div>
    <div>Component 1</div>
    <div>Component 2</div>
    2 components
</div>`

render() === `<div>
    <div>Component 1</div>
    <div>Component 2</div>
    2 components
</div>` // ✅ pure: same input, same output
        // and no side effects visible from outside

// This is not a pure function, but
// render() is, because it resets the
// global object on each call.
function Component() {
    return (<div>Component {++globals.components}</div>)
}
```