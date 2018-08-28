'use strict';

function retry(settings) {
    var actionResult, resultReject, resultResolve, timeoutId;
    var resultPromise = new Promise(function (resolve, reject) {
        resultResolve = resolve;
        resultReject = reject;
    });
    var retryTimeout = settings.retryTimeout;
    var index = 0;
    var stopped = false;
    var attempts;
    var retryAttempts = settings.retryAttempts;
    if (retryAttempts && retryAttempts.length) {
        attempts = retryAttempts.length + 1;
    } else {
        retryAttempts = null;
        var retryQty = settings.retryQty;
        if (typeof retryQty === 'number' && retryQty >= 0) {
            attempts = retryQty + 1;
        } else {
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
            } else {
                onActionEnd(actionResult);
            }
        } catch (e) {
            onActionError(e);
        }
    }
    
    function repeat() {
        var timeout;
        if (index) {
            timeout = retryAttempts ? retryAttempts.shift() : retryTimeout;
        } else {
            timeout = settings.delay;
        }
        if (attempts > 0) {
            attempts--;
        }
        if (typeof timeout !== 'number' || timeout < 0) {
            retryAction();
        } else {
            retryResult.wait = true;
            timeoutId = setTimeout(retryAction, timeout);
        }
    }
    
    function onActionEnd(value) {
        retryResult.value = value;
        retryResult.valueWait = false;
        var retryTest;
        if (!stopped) {
            retryTest = settings.retryTest;
            if (!attempts) {
                retryTest = false;
            } else if (typeof retryTest === 'function') {
                retryTest = retryTest(value);
            }
        }
        if (retryTest) {
            repeat();
        } else {
            resultResolve(value);
        }
    }
    
    function onActionError(reason) {
        retryResult.error = reason;
        retryResult.valueWait = false;
        var retryOnError = settings.retryOnError;
        if (stopped || !attempts) {
            retryOnError = false;
        } else if (typeof retryOnError === 'function') {
            retryOnError = retryOnError(reason);
        }
        if (retryOnError) {
            repeat();
        } else {
            resultReject(reason);
        }
    }
    
    function stopRetry() {
        if (!stopped) {
            if (timeoutId) {
                clearTimeout(timeoutId);
                retryResult.wait = false;
            }
            stopped = (retryResult.stopped = true);
            if (!retryResult.valueWait) {
                resultResolve(retryResult.value);
            }
        }
        return resultPromise;
    }
    
    var retryResult = {
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

function getPromiseField(obj) {
    return obj.promise;
}

exports.retry = retry;
exports.getPromiseField = getPromiseField;
//# sourceMappingURL=povtor.js.map
