# povtor <a name="start"></a>

[![NPM version](https://badge.fury.io/js/povtor.png)](http://badge.fury.io/js/povtor)

Repeat function call depending on the previous call result and specified conditions.

```js
retry({
    action: axios,
    actionParams: [{url: '/api/some/endpoint'}],
    retryAttempts: [2000, 5000],
    retryTest: (response) => response.data.error,
    retryOnError: true
})
.promise.then((response) => console.log(response.data));
```

### Features

* Repeats calling of any function whether it returns a promise or a usual value (`action` setting).
* Use returned promise to get function's last result or last error when retry process is finished.
* Specify context (`actionContext` setting) and parameters (`actionParams` setting) for function call.
* Retry function call when it throws or returns rejected promise (use `retryOnError` setting) and/or
  when it returns normal value or fulfilled promise (use `retryTest` setting).
* Use a function as value for `retryOnError`/`retryTest` setting to specify condition when to retry action call.
* Specify quantity and timeouts of retry attempts (use `retryAttempts`, `retryQty` and/or `retryTimeout` settings).
* Limit overall time of process of retry by `timeLimit` setting.
* Control the process of calls repeating and stop it when it is necessary.
* Access values and errors that are produced by function during the process.
* Does not have dependencies except for [ES 2015 Promise API](https://developer.mozilla.org/docs/Web/JavaScript/Reference/Global_Objects/Promise).
* Small size.

## Table of contents

* [Installation](#install)
* [Usage](#usage)
* [Examples](#examples)
* [API](#api)
* [Related projects](#related)
* [Contributing](#contributing)
* [License](#license)

## Installation <a name="install"></a> [&#x2191;](#start)

### Node

    npm install povtor

### [Bower](https://bower.io)

    bower install povtor

### AMD/UMD, &lt;script&gt;

Use `dist/povtor.umd.js` (minified version).

## Usage <a name="usage"></a> [&#x2191;](#start)

### ECMAScript 6+

```js
import {retry, getPromiseField} from 'povtor';
```

### Node

```js
const retry = require('povtor').retry;
const getPromiseField = require('povtor').getPromiseField;
```

### AMD/UMD

```js
define(['path/to/dist/povtor.umd.js'], function(povtor) {
    const retry = povtor.retry;
    const getPromiseField = povtor.getPromiseField;
});
```

### Bower, &lt;script&gt;

```html
<!-- Use bower_components/povtor/dist/povtor.umd.js if the library was installed by Bower -->
<script type="text/javascript" src="path/to/dist/povtor.umd.js"></script>
<script type="text/javascript">
    // povtor is available via povtor field of window object
    const retry = povtor.retry;
    const getPromiseField = povtor.getPromiseField;
</script>
```

## Examples <a name="examples"></a> [&#x2191;](#start)

```js
// Request data from API endpoint and repeat request after 3, then 5, then 7 seconds
// when request is not successful, response data has error flag or value of state field is not 3.
let control = retry({
    action: axios,
    actionParams: [{url: '/api/some/endpoint'}],
    retryAttempts: [3000, 5000, 7000],
    retryTest: (response) => response.data.error || response.data.state !== 3,
    retryOnError: true
});

// control.promise will be resolved when a request is completed successfully and retryTest returns false
// or when all repeats will be made.
control.promise.then((response) => console.log(response.data));

getPromiseField(control);   // Get value of control.promise

// Read file contents every second until it contains specific value.
control = retry({
    action: jsonfile.readFileSync,
    actionParams: ['/path/to/data.json', {'throws': false}],
    retryTimeout: 1000,
    retryTest: (data) => ! data || ! data.result
});

// control.promise will be resolved when the file contains specified value.
control.promise.then((data) => console.log(data.result));
...
control.stop();   // Stop repeating of action
```

See tests for additional examples.

## API <a name="api"></a> [&#x2191;](#start)

#### retry(settings: RetrySettings): RetryResult

Call specified function and repeat calls depending on settings.

**`settings: RetrySettings`** - an object that can contain the following fields:

* `action` - a function that should be called. Can return a promise or a value.
* `actionContext` - an object that should be used as `this` when calling the action function.
* `actionParams` - an array of parameters that should be passed into the action function.
* `delay` - an amount of milliseconds before first call of the action function.
  When the value is not specified or is negative, the action function will be called immediately first time.
* `retryAttempts` - an array specifying amount and timeouts between repeated calls of the action function.
  Each item can be a number or a function (see `retryTimeout` setting for details).
  Has priority over `retryQty` and `retryTimeout` settings.
* `retryQty` - maximum number of repeated calls of the action function. A negative value means no restriction.
  Default value is `-1`.
* `retryTimeout` - a timeout between repeated calls of the action function, or a function that returns such timeout.
  A negative or non-number value means the repeat call will be made without delay (this is applied by default).
  If specified function returns `false` then retry process will be finished and result promise
  will be fulfilled or rejected depending on result of the last action's call.
* `retryOnError` - a boolean value or a function returning boolean value that specifies whether the action function
  should be called again when the action function throws an error or returned promise is rejected.
  When not specified the call of the action function will not be repeated on an error.
* `retryTest` - a boolean value or a function returning boolean value that specifies whether the action function
  should be called again after a made call. When not specified the action call will not be repeated.
* `timeLimit` - time in milliseconds specifying how long retry process can last starting from call of `retry` function.

The only required field is `action`.

`retry` function returns `RetryResult` - an object that can be used to observe and control the process of calls repeating.
**`RetryResult`** contains the following fields:

* `promise` - promise that can be used to observe the process and to get the final value of the action function
  or the last error.
* `attempt` - number of calls of the action function that have already made.
* `error` - last error or value of promise rejection.
* `isError` - whether the last call of the action function is ended with error.
* `result` - contains result of each call of the action function.
* `settings` - settings that were passed to `retry` function.
* `startTime` - time in milliseconds when `retry` function was called.
* `stop` - function that can be used to stop the process of calls repeating. Returns value of `promise` field.
* `stopped` - a boolean value that indicates whether the process of calls repeating is stopped.
* `value` - a value of last successfull call of the action function. When the action function returns a promise,
  the value will be result of the promise fulfillment.
* `valueWait` - a boolean value that indicates whether the action function is producing a result.
  Useful only when the action function returns a promise. Is set to `true` when the promise is pending.
* `wait` - a boolean value that indicates waiting of the next call of the action function.
  Is set to `true` during a timeout between calls.

#### getPromiseField(obj)

Return value of `promise` field of the passed object.

See `doc` folder for details.

## Related projects <a name="related"></a> [&#x2191;](#start)

* [eva](https://github.com/gamtiq/eva)
* [wrapme](https://github.com/gamtiq/wrapme)

## Contributing <a name="contributing"></a> [&#x2191;](#start)
In lieu of a formal styleguide, take care to maintain the existing coding style.
Add unit tests for any new or changed functionality.
Lint and test your code.

## License <a name="license"></a> [&#x2191;](#start)
Copyright (c) 2018-2020 Denis Sikuler
Licensed under the MIT license.
