(function () {
  "use strict";

  function normalizeKeyword(value) {
    if (typeof value !== "string" || !value) return "";
    var text = value;
    try {
      text = text.normalize("NFKC");
    } catch (_) {}
    return text.replace(/　/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function displayKeyword(value, maxLength) {
    if (typeof value !== "string") return "";
    var limit = typeof maxLength === "number" && maxLength > 0 ? maxLength : 40;
    var text = value.replace(/　/g, " ").replace(/\s+/g, " ").trim();
    return text.length > limit ? text.slice(0, limit) : text;
  }

  globalThis.YNCHKeywordUtils = Object.freeze({
    normalizeKeyword: normalizeKeyword,
    displayKeyword: displayKeyword
  });
}());
