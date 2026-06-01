(function () {
  "use strict";

  function create(options) {
    var storage = options && options.storage;
    var key = options && options.key ? String(options.key) : "ynchBlankTabRecovery:count";
    var max = options && Number(options.max) > 0 ? Number(options.max) : 1;

    return Object.freeze({
      consume: function () {
        try {
          var current = Number(storage && storage.getItem ? storage.getItem(key) || 0 : 0);
          if (current >= max) return false;
          if (storage && storage.setItem) storage.setItem(key, String(current + 1));
        } catch (_) {}
        return true;
      }
    });
  }

  globalThis.YNCHCommentRecoveryBudget = Object.freeze({
    create: create
  });
}());
