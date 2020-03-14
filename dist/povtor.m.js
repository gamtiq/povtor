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
  var timeLimit = settings.timeLimit;

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

  if (typeof timeLimit !== 'number' || timeLimit < 0) {
    timeLimit = 0;
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

  var startTime = new Date().getTime();
  var retryResult = {
    attempt: index,
    error: actionResult,
    isError: false,
    promise: resultPromise,
    result: callResultList,
    settings: settings,
    startTime: startTime,
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

  function next(test) {
    var proceed = test;
    var result = {
      time: new Date().getTime()
    };
    var value;

    if (retryResult.isError) {
      value = result.error = retryResult.error;
    } else {
      value = result.value = retryResult.value;
    }

    retryResult.result.push(result);
    retryResult.valueWait = false;

    if (stopped || !attempts) {
      proceed = false;
    } else if (typeof proceed === 'function') {
      proceed = proceed(value, retryResult);
    }

    if (proceed && (!timeLimit || new Date().getTime() - startTime <= timeLimit)) {
      repeat();
    } else {
      end();
    }
  }

  function onActionEnd(value) {
    retryResult.value = value;
    retryResult.isError = false;
    next(settings.retryTest);
  }

  function onActionError(reason) {
    retryResult.error = reason;
    retryResult.isError = true;
    next(settings.retryOnError);
  }

  repeat();
  return retryResult;
}
function getPromiseField(obj) {
  return obj.promise;
}

export { retry, getPromiseField };
//# sourceMappingURL=povtor.m.js.map
