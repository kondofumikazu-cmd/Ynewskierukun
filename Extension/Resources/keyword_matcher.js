(function () {
  "use strict";

  function escapeRegExp(value) {
    return String(value).replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
  }

  function uniqueKeywords(values) {
    var out = [];
    var seen = Object.create(null);
    if (!Array.isArray(values)) return out;
    for (var i = 0; i < values.length; i++) {
      var value = typeof values[i] === "string" ? values[i] : "";
      if (!value || seen[value]) continue;
      seen[value] = 1;
      out.push(value);
    }
    return out;
  }

  function create(values) {
    var keywords = uniqueKeywords(values);
    var regex = null;
    if (keywords.length) {
      try {
        var pattern = keywords
          .slice()
          .sort(function (a, b) { return b.length - a.length; })
          .map(escapeRegExp)
          .join("|");
        regex = new RegExp(pattern);
      } catch (_) {
        regex = null;
      }
    }

    return Object.freeze({
      size: keywords.length,
      keywords: keywords.slice(),
      matches: function (text) {
        if (!text || !keywords.length) return false;
        if (regex) return regex.test(text);
        for (var i = 0; i < keywords.length; i++) {
          if (text.indexOf(keywords[i]) >= 0) return true;
        }
        return false;
      }
    });
  }

  globalThis.YNCHKeywordMatcher = Object.freeze({
    create: create,
    escapeRegExp: escapeRegExp
  });
}());
