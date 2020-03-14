export type RetryAction = (...args: unknown[]) => Promise<unknown> | unknown;

export type GetRetryTimeout = (result?: RetryResult) => unknown;
export type RetryTimeout = number | GetRetryTimeout;

export type RetryTest = (value?: unknown, result?: RetryResult) => boolean;

/** Settings of {@link retry} function. */
export interface RetrySettings {
    /** A function that should be called. */
    action: RetryAction;
    /** An object that should be used as `this` when calling the action function. */
    actionContext?: unknown;
    /** An array of parameters that should be passed into the action function. */
    actionParams?: unknown[];
    /**
     * An amount of milliseconds before first call of the action function.
     * When the value is not specified or is negative, the action function will be called immediately first time.
     */
    delay?: number;
    /**
     * An array specifying amount and timeouts between repeated calls of the action function.
     * Each item can be a number or a function (see `retryTimeout` setting for details).
     * Has priority over `retryQty` and `retryTimeout` settings.
     */
    retryAttempts?: RetryTimeout[];
    /**
     * Maximum number of repeated calls of the action function. A negative value means no restriction.
     * Default value is `-1`.
     */
    retryQty?: number;
    /**
     * A timeout between repeated calls of the action function, or a function that returns such timeout.
     * A negative or non-number value means the repeat call will be made without delay (this is applied by default).
     * If specified function returns `false` then retry process will be finished and result promise
     * will be fulfilled or rejected depending on result of the last action's call.
     */
    retryTimeout?: RetryTimeout;
    /**
     * A boolean value or a function returning boolean value that specifies whether the action function
     * should be called again when the action function throws an error or returned promise is rejected.
     * When not specified the call of the action function will not be repeated on an error.
     */
    retryOnError?: boolean | RetryTest;
    /**
     * A boolean value or a function returning boolean value that specifies whether the action function
     * should be called again after a made call. When not specified the action call will not be repeated.
     */
    retryTest?: boolean | RetryTest;
    [field: string]: unknown;
}

export interface ValueResult {
    /** Time in milliseconds when value was saved. */
    time: number;
    /** Result of action's call or value of promise fulfillment. */
    value: unknown;
}

export interface ErrorResult {
    /** Error of action's call or value of promise rejection. */
    error: unknown;
    /** Time in milliseconds when error was saved. */
    time: number;
}

export type ActionCallResult = ValueResult | ErrorResult;

export interface WithPromiseField {
    promise: Promise<unknown>;
}

export interface RetryResult extends WithPromiseField {
    /** Number of calls of the action function that have already made. */
    attempt: number;
    /** Last error or value of promise rejection. */
    error: unknown;
    /** Whether the last call of the action function is ended with error. */
    isError: boolean;
    /** Contains result of each call of the action function. */
    result: ActionCallResult[];
    /** Settings that were passed to `retry` function. */
    settings: RetrySettings;
    /** Function that can be used to stop the process of calls repeating. Returns value of `promise` field. */
    stop: () => Promise<unknown>;
    /** A boolean value that indicates whether the process of calls repeating is stopped. */
    stopped: boolean;
    /**
     * A value of last successfull call of the action function. When the action function returns a promise,
     * the value will be result of the promise fulfillment.
     */
    value: unknown;
    /**
     * A boolean value that indicates whether the action function is producing a result.
     * Useful only when the action function returns a promise. Is set to `true` when the promise is pending.
     */
    valueWait: boolean;
    /**
     * A boolean value that indicates waiting of the next call of the action function.
     * Is set to `true` during a timeout between calls.
     */
    wait: boolean;
}

/**
 * Call specified function and repeat calls depending on settings.
 *
 * @param settings
 *      Operation settings.
 */
export function retry(settings: RetrySettings): RetryResult {
    let actionResult, resultReject, resultResolve, timeoutId;
    // eslint-disable-next-line func-names, prefer-arrow-callback
    const resultPromise = new Promise(function(resolve, reject) {
        resultResolve = resolve;
        resultReject = reject;
    });
    const callResultList: ActionCallResult[] = [];

    const { retryTimeout } = settings;
    let index = 0;
    let stopped = false;

    let attempts: number;
    let { retryAttempts } = settings;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, @typescript-eslint/prefer-optional-chain
    if (retryAttempts && retryAttempts.length) {
        attempts = retryAttempts.length + 1;
    }
    else {
        retryAttempts = null;
        const { retryQty } = settings;
        if (typeof retryQty === 'number' && retryQty >= 0) {
            attempts = retryQty + 1;
        }
        else {
            attempts = -1;
        }
    }

    function stopRetry(): Promise<unknown> {
        if (! stopped) {
            /* eslint-disable @typescript-eslint/no-use-before-define */
            if (timeoutId) {
                clearTimeout(timeoutId);
                retryResult.wait = false;
            }
            stopped = retryResult.stopped = true;
            if (! retryResult.valueWait) {
                resultResolve(retryResult.value);
            }
            /* eslint-enable @typescript-eslint/no-use-before-define */
        }

        return resultPromise;
    }

    const retryResult: RetryResult = {
        attempt: index,
        error: actionResult,
        isError: false,
        promise: resultPromise,
        result: callResultList,
        settings,
        stop: stopRetry,
        stopped: false,
        value: actionResult,
        valueWait: false,
        wait: false
    };

    function retryAction(): void {
        retryResult.attempt = ++index;
        retryResult.wait = false;
        retryResult.valueWait = true;
        try {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            actionResult = settings.action.apply(settings.actionContext || null, settings.actionParams || []);
            if (actionResult && typeof actionResult === 'object' && typeof actionResult.then === 'function') {
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                actionResult.then(onActionEnd, onActionError);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-use-before-define
                onActionEnd(actionResult);
            }
        }
        catch (e) {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            onActionError(e);
        }
    }

    function end(): void {
        if (retryResult.isError) {
            resultReject(retryResult.error);
        }
        else {
            resultResolve(retryResult.value);
        }
    }

    // eslint-disable-next-line consistent-return
    function repeat(): void {
        let timeout;
        if (index) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            timeout = retryAttempts
                ? retryAttempts.shift()
                : retryTimeout;
            if (typeof timeout === 'function') {
                timeout = timeout(retryResult);
                if (timeout === false) {
                    return end();
                }
            }
        }
        else {
            timeout = settings.delay;
        }
        if (attempts > 0) {
            attempts--;
        }
        if (typeof timeout !== 'number' || timeout < 0) {
            retryAction();
        }
        else {
            retryResult.wait = true;
            timeoutId = setTimeout(retryAction, timeout);
        }
    }

    function onActionEnd(value: unknown): void {
        retryResult.value = value;
        retryResult.result.push({
            value,
            time: new Date().getTime()
        });
        retryResult.isError = false;
        retryResult.valueWait = false;
        let retryTest: unknown;
        if (! stopped) {
            retryTest = settings.retryTest;
            if (! attempts) {
                retryTest = false;
            }
            else if (typeof retryTest === 'function') {
                retryTest = retryTest(value, retryResult);
            }
        }
        if (retryTest) {
            repeat();
        }
        else {
            end();
        }
    }

    function onActionError(reason: unknown): void {
        retryResult.error = reason;
        retryResult.result.push({
            error: reason,
            time: new Date().getTime()
        });
        retryResult.isError = true;
        retryResult.valueWait = false;
        let { retryOnError } = settings;
        if (stopped || ! attempts) {
            retryOnError = false;
        }
        else if (typeof retryOnError === 'function') {
            retryOnError = retryOnError(reason, retryResult);
        }
        if (retryOnError) {
            repeat();
        }
        else {
            end();
        }
    }

    repeat();

    return retryResult;
}

/**
 * Return value of `promise` field of the passed object.
 *
 * @param obj
 *      Object whose field should be returned.
 * @return
 *      Value of `promise` field of the passed object.
 * @author Denis Sikuler
 */
export function getPromiseField(obj: WithPromiseField): Promise<unknown> {
    return obj.promise;
}
