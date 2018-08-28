export type RetryAction = (...args: any[]) => Promise<any> | any;

export type RetryTest = (value: any) => boolean;

export interface RetrySettings {
    action: RetryAction;
    actionContext?: any;
    actionParams?: any[];
    delay?: number;
    retryAttempts?: number[];
    retryQty?: number;
    retryTimeout?: number;
    retryOnError?: boolean | RetryTest;
    retryTest?: boolean | RetryTest;
}

export interface WithPromiseField {
    promise: Promise<any>;
}

export interface RetryResult extends WithPromiseField {
    attempt: number;
    error: any;
    stop: () => Promise<any>;
    stopped: boolean;
    value: any;
    valueWait: boolean;
    wait: boolean;
}

export function retry(settings: RetrySettings): RetryResult {
    let actionResult, resultReject, resultResolve, timeoutId;
    const resultPromise = new Promise(function(resolve, reject) {
        resultResolve = resolve;
        resultReject = reject;
    });

    const { retryTimeout } = settings;
    let index = 0;
    let stopped = false;

    let attempts: number;
    let { retryAttempts } = settings;
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

    function retryAction() {
        retryResult.attempt = ++index;
        retryResult.wait = false;
        retryResult.valueWait = true;
        try {
            actionResult = settings.action.apply(settings.actionContext || null, settings.actionParams || []);
            if (actionResult && typeof actionResult === 'object' && typeof actionResult.then === 'function') {
                actionResult.then(onActionEnd, onActionError);
            }
            else {
                onActionEnd(actionResult);
            }
        }
        catch (e) {
            onActionError(e);
        }
    }

    function repeat() {
        let timeout;
        if (index) {
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

    function onActionEnd(value: any) {
        retryResult.value = value;
        retryResult.valueWait = false;
        let retryTest: any;
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

    function onActionError(reason: any) {
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

    function stopRetry() {
        if (! stopped) {
            if (timeoutId) {
                clearTimeout(timeoutId);
                retryResult.wait = false;
            }
            stopped = retryResult.stopped = true;
            if (! retryResult.valueWait) {
                resultResolve(retryResult.value);
            }
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

    repeat();

    return retryResult;
}

export function getPromiseField(obj: WithPromiseField): Promise<any> {
    return obj.promise;
}
