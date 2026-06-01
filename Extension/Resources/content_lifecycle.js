(function () {
  "use strict";

  var timers = new Set();
  var observers = new Set();
  var disposed = false;

  function runLater(callback, delay) {
    if (disposed || typeof callback !== "function") return null;
    var timer = globalThis.setTimeout(function () {
      timers.delete(timer);
      if (!disposed) callback();
    }, delay);
    timers.add(timer);
    return timer;
  }

  function cancelTimer(timer) {
    if (!timer) return;
    timers.delete(timer);
    try { globalThis.clearTimeout(timer); } catch (_) {}
  }

  function trackObserver(observer) {
    if (observer) observers.add(observer);
    return observer;
  }

  function forgetObserver(observer) {
    if (observer) observers.delete(observer);
  }

  function clearAllTimers() {
    for (var timer of Array.from(timers)) cancelTimer(timer);
  }

  function disconnectObservers() {
    for (var observer of Array.from(observers)) {
      forgetObserver(observer);
      try { observer.disconnect(); } catch (_) {}
    }
  }

  function dispose() {
    disposed = true;
    clearAllTimers();
    disconnectObservers();
  }

  globalThis.YNCHContentLifecycle = Object.freeze({
    setTimeout: runLater,
    clearTimeout: cancelTimer,
    clearAllTimers: clearAllTimers,
    trackObserver: trackObserver,
    forgetObserver: forgetObserver,
    disconnectObservers: disconnectObservers,
    dispose: dispose,
    isDisposed: function () { return disposed; }
  });
}());
