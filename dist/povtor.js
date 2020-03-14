'use strict';

function retry(settings) {
  var actionResult, resultReject, resultResolve, timeoutId;
  var resultPromise = new Promise(function (resolve, reject) {
    resultResolve = resolve;
    resultReject = reject;
  });
  var callResultList = [];
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

  function stopRetry() {
    if (!stopped) {
      if (timeoutId) {
        clearTimeout(timeoutId);
        retryResult.wait = false;
      }

      stopped = retryResult.stopped = true;

      if (!retryResult.valueWait) {
        resultResolve(retryResult.value);
      }
    }

    return resultPromise;
  }

  var retryResult = {
    attempt: index,
    error: actionResult,
    isError: false,
    promise: resultPromise,
    result: callResultList,
    settings: settings,
    stop: stopRetry,
    stopped: false,
    value: actionResult,
    valueWait: false,
    wait: false
  };

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

  function end() {
    if (retryResult.isError) {
      resultReject(retryResult.error);
    } else {
      resultResolve(retryResult.value);
    }
  }

  function repeat() {
    var timeout;

    if (index) {
      timeout = retryAttempts ? retryAttempts.shift() : retryTimeout;

      if (typeof timeout === 'function') {
        timeout = timeout(retryResult);

        if (timeout === false) {
          return end();
        }
      }
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
    retryResult.result.push({
      value: value,
      time: new Date().getTime()
    });
    retryResult.isError = false;
    retryResult.valueWait = false;
    var retryTest;

    if (!stopped) {
      retryTest = settings.retryTest;

      if (!attempts) {
        retryTest = false;
      } else if (typeof retryTest === 'function') {
        retryTest = retryTest(value, retryResult);
      }
    }

    if (retryTest) {
      repeat();
    } else {
      end();
    }
  }

  function onActionError(reason) {
    retryResult.error = reason;
    retryResult.result.push({
      error: reason,
      time: new Date().getTime()
    });
    retryResult.isError = true;
    retryResult.valueWait = false;
    var retryOnError = settings.retryOnError;

    if (stopped || !attempts) {
      retryOnError = false;
    } else if (typeof retryOnError === 'function') {
      retryOnError = retryOnError(reason, retryResult);
    }

    if (retryOnError) {
      repeat();
    } else {
      end();
    }
  }

  repeat();
  return retryResult;
}
function getPromiseField(obj) {
  return obj.promise;
}

exports.retry = retry;
exports.getPromiseField = getPromiseField;
//# sourceMappingURL=povtor.js.map
