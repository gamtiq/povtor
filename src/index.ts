export type RetryAction = (...args: unknown[]) => Promise<unknown> | unknown;

export type RetryTest = (value: unknown) => boolean;

export interface RetrySettings {
    action: RetryAction;
    actionContext?: unknown;
    actionParams?: unknown[];
    delay?: number;
    retryAttempts?: number[];
    retryQty?: number;
    retryTimeout?: number;
    retryOnError?: boolean | RetryTest;
    retryTest?: boolean | RetryTest;
}

export interface WithPromiseField {
    promise: Promise<unknown>;
}

export interface RetryResult extends WithPromiseField {
    attempt: number;
    error: unknown;
    stop: () => Promise<unknown>;
    stopped: boolean;
    value: unknown;
    valueWait: boolean;
    wait: boolean;
}

export function retry(settings: RetrySettings): RetryResult {
    let actionResult, resultReject, resultResolve, timeoutId;
    // eslint-disable-next-line func-names, prefer-arrow-callback
    const resultPromise = new Promise(function(resolve, reject) {
        resultResolve = resolve;
        resultReject = reject;
    });

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
        promise: resultPromise,
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

    function repeat(): void {
        let timeout;
        if (index) {
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
            timeout = retryAttempts
                ? retryAttempts.shift()
                : retryTimeout;
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
        retryResult.valueWait = false;
        let retryTest: unknown;
        if (! stopped) {
            retryTest = settings.retryTest;
            if (! attempts) {
                retryTest = false;
            }
            else if (typeof retryTest === 'function') {
                retryTest = retryTest(value);
            }
        }
        if (retryTest) {
            repeat();
        }
        else {
            resultResolve(value);
        }
    }

    function onActionError(reason: unknown): void {
        retryResult.error = reason;
        retryResult.valueWait = false;
        let { retryOnError } = settings;
        if (stopped || ! attempts) {
            retryOnError = false;
        }
        else if (typeof retryOnError === 'function') {
            retryOnError = retryOnError(reason);
        }
        if (retryOnError) {
            repeat();
        }
        else {
            resultReject(reason);
        }
    }

    repeat();

    return retryResult;
}

export function getPromiseField(obj: WithPromiseField): Promise<unknown> {
    return obj.promise;
}
