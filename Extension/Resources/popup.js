(function () {
  "use strict";

  var api = (typeof browser !== "undefined") ? browser
    : (typeof chrome !== "undefined") ? chrome : null;
  var utils = (typeof globalThis !== "undefined" && globalThis.YNCHKeywordUtils)
    ? globalThis.YNCHKeywordUtils : null;

  var STORAGE_KEY = "filterKeywords";
  var MAX_KEYWORD_LENGTH = 40;
  var IMPORT_MAX_BYTES = 256 * 1024;

  var keywords = [];
  var els = {};
  var fallbackMessages = {
    extension_name: "Y News きえるくん",
    popup_title: "キーワード非表示",
    keyword_count: "$COUNT$ 個",
    popup_description: "登録したキーワードが見出しに含まれるニュース一覧行を非表示にして削除します。",
    keyword_input_placeholder: "キーワードを入力",
    keyword_input_aria: "追加するキーワード",
    add_button: "追加",
    saved_keywords_aria: "登録済みキーワード",
    empty_keywords: "まだキーワードはありません。",
    keyword_actions_aria: "キーワード管理",
    import_button: "読み込み",
    export_button: "書き出し",
    reset_button: "リセット",
    remove_keyword_aria: "「$KEYWORD$」を削除",
    error_save_failed: "保存に失敗しました。",
    error_load_failed: "保存データを読み込めませんでした。",
    error_enter_keyword: "キーワードを入力してください。",
    error_duplicate_keyword: "同じキーワードは既に登録されています。",
    status_keyword_saved: "キーワードを保存しました。",
    status_keyword_removed: "キーワードを削除しました。",
    status_keywords_reset: "キーワードをすべて削除しました。",
    export_header_name: "# Y News きえるくん キーワードリスト",
    export_header_help: "# 1 行 1 キーワード。# で始まる行と空行は無視します。",
    share_text: "保存済みキーワードを書き出します。",
    status_shared: "$COUNT$ 件をtxtファイルとして共有しました。",
    status_share_cancelled: "共有をキャンセルしました。",
    status_downloaded: "$COUNT$ 件をtxtファイルとして保存しました。",
    status_copied: "$COUNT$ 件をコピーしました。共有が使えない環境ではテキストファイルへ貼り付けて保存できます。",
    error_export_failed: "書き出しに失敗しました。",
    error_no_importable_keywords: "追加できるキーワードがありませんでした。",
    error_no_keywords_found: "キーワードが見つかりませんでした。",
    status_imported: "$COUNT$ 件を読み込みました。",
    error_file_too_large: "ファイルが大きすぎます。",
    error_file_read_failed: "ファイルを読み込めませんでした。"
  };

  function msg(name, substitution) {
    try {
      if (api && api.i18n && api.i18n.getMessage) {
        var localized = api.i18n.getMessage(name, substitution);
        if (localized) return localized;
      }
    } catch (_) {}

    var fallback = fallbackMessages[name] || "";
    if (typeof substitution !== "undefined") {
      fallback = fallback.replace(/\$(COUNT|KEYWORD)\$/g, String(substitution));
    }
    return fallback;
  }

  function uiLanguage() {
    try {
      if (api && api.i18n && api.i18n.getUILanguage) {
        var language = api.i18n.getUILanguage();
        if (language) return language.replace(/_/g, "-");
      }
    } catch (_) {}
    return document.documentElement.lang || "ja";
  }

  function applyLocalization() {
    document.documentElement.lang = /^en\b/i.test(uiLanguage()) ? "en" : "ja";
    document.title = msg("extension_name");

    if (els.title) els.title.textContent = msg("popup_title");
    if (els.description) els.description.textContent = msg("popup_description");
    if (els.input) {
      els.input.placeholder = msg("keyword_input_placeholder");
      els.input.setAttribute("aria-label", msg("keyword_input_aria"));
    }
    if (els.addButton) els.addButton.textContent = msg("add_button");
    if (els.chips) els.chips.setAttribute("aria-label", msg("saved_keywords_aria"));
    if (els.empty) els.empty.textContent = msg("empty_keywords");
    if (els.actions) els.actions.setAttribute("aria-label", msg("keyword_actions_aria"));
    if (els.importButton) els.importButton.textContent = msg("import_button");
    if (els.exportButton) els.exportButton.textContent = msg("export_button");
    if (els.resetButton) els.resetButton.textContent = msg("reset_button");
  }

  function removeKeywordLabel(keyword) {
    if (document.documentElement.lang === "en") return "Remove \"" + keyword + "\"";
    return "「" + keyword + "」を削除";
  }

  function normalizeKeyword(value) {
    if (utils && typeof utils.normalizeKeyword === "function") {
      return utils.normalizeKeyword(value);
    }
    if (typeof value !== "string") return "";
    var text = value;
    try { text = text.normalize("NFKC"); } catch (_) {}
    return text.replace(/　/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  }

  function displayKeyword(value) {
    if (utils && typeof utils.displayKeyword === "function") {
      return utils.displayKeyword(value, MAX_KEYWORD_LENGTH);
    }
    if (typeof value !== "string") return "";
    var text = value.replace(/　/g, " ").replace(/\s+/g, " ").trim();
    return text.length > MAX_KEYWORD_LENGTH ? text.slice(0, MAX_KEYWORD_LENGTH) : text;
  }

  function makeEntry(value) {
    var display = displayKeyword(value);
    var normalized = normalizeKeyword(display);
    if (!display || !normalized) return null;
    return { d: display, n: normalized };
  }

  function sanitizeKeywords(value) {
    var list = Array.isArray(value) ? value : [];
    var out = [];
    var seen = Object.create(null);

    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      var entry = null;
      if (typeof item === "string") {
        entry = makeEntry(item);
      } else if (item && typeof item === "object") {
        entry = makeEntry(typeof item.d === "string" && item.d ? item.d : item.n);
      }
      if (!entry || seen[entry.n]) continue;
      seen[entry.n] = 1;
      out.push(entry);
    }
    return out;
  }

  function consumeLastError() {
    try { return api && api.runtime && api.runtime.lastError; }
    catch (_) { return null; }
  }

  function storageArea() {
    return api && api.storage && api.storage.local ? api.storage.local : null;
  }

  function storageGet(query, onOk, onFail) {
    var area = storageArea();
    if (!area || !area.get) {
      if (onFail) onFail();
      return;
    }
    var settled = false;
    function ok(value) {
      if (settled) return;
      settled = true;
      var err = consumeLastError();
      if (err) {
        if (onFail) onFail(err);
        return;
      }
      if (onOk) onOk(value || {});
    }
    function fail(err) {
      if (settled) return;
      settled = true;
      if (onFail) onFail(err);
    }
    try {
      var result = area.get(query, ok);
      if (result && typeof result.then === "function") result.then(ok, fail);
    } catch (err) {
      fail(err);
    }
  }

  function storageSet(patch, onOk, onFail) {
    var area = storageArea();
    if (!area || !area.set) {
      if (onFail) onFail();
      return;
    }
    var settled = false;
    function ok() {
      if (settled) return;
      settled = true;
      var err = consumeLastError();
      if (err) {
        if (onFail) onFail(err);
        return;
      }
      if (onOk) onOk();
    }
    function fail(err) {
      if (settled) return;
      settled = true;
      if (onFail) onFail(err);
    }
    try {
      var result = area.set(patch, ok);
      if (result && typeof result.then === "function") result.then(ok, fail);
    } catch (err) {
      fail(err);
    }
  }

  function storageRemove(key, onOk, onFail) {
    var area = storageArea();
    if (!area || !area.remove) {
      var patch = {};
      patch[key] = [];
      storageSet(patch, onOk, onFail);
      return;
    }
    var settled = false;
    function ok() {
      if (settled) return;
      settled = true;
      var err = consumeLastError();
      if (err) {
        if (onFail) onFail(err);
        return;
      }
      if (onOk) onOk();
    }
    function fail(err) {
      if (settled) return;
      settled = true;
      if (onFail) onFail(err);
    }
    try {
      var result = area.remove(key, ok);
      if (result && typeof result.then === "function") result.then(ok, fail);
    } catch (err) {
      fail(err);
    }
  }

  function showStatus(message, tone) {
    if (!els.status) return;
    if (!message) {
      els.status.textContent = "";
      els.status.hidden = true;
      els.status.removeAttribute("data-tone");
      return;
    }
    els.status.textContent = message;
    els.status.hidden = false;
    els.status.setAttribute("data-tone", tone || "error");
  }

  function render() {
    while (els.chips && els.chips.firstChild) {
      els.chips.removeChild(els.chips.firstChild);
    }

    for (var i = 0; i < keywords.length; i++) {
      var entry = keywords[i];
      var li = document.createElement("li");
      var label = document.createElement("span");
      var remove = document.createElement("button");

      li.className = "kw-chip";
      li.dataset.index = String(i);
      label.className = "kw-chip-text";
      label.textContent = entry.d;
      label.title = entry.d;
      remove.className = "kw-chip-del";
      remove.type = "button";
      remove.setAttribute("aria-label", removeKeywordLabel(entry.d));

      li.appendChild(label);
      li.appendChild(remove);
      els.chips.appendChild(li);
    }

    if (els.count) els.count.textContent = msg("keyword_count", String(keywords.length));
    if (els.empty) els.empty.hidden = keywords.length > 0;
    if (els.exportButton) els.exportButton.disabled = keywords.length === 0;
    if (els.resetButton) els.resetButton.disabled = keywords.length === 0;
  }

  function cloneKeywords() {
    return keywords.map(function (entry) {
      return { d: entry.d, n: entry.n };
    });
  }

  function save(message, rollbackKeywords) {
    var payload = sanitizeKeywords(keywords);
    function onOk() {
      keywords = payload;
      render();
      if (message) showStatus(message, "ok");
    }
    function onFail() {
      if (rollbackKeywords) {
        keywords = sanitizeKeywords(rollbackKeywords);
        render();
      }
      showStatus(msg("error_save_failed"));
    }

    if (!payload.length) {
      storageRemove(STORAGE_KEY, onOk, onFail);
      return;
    }

    var patch = {};
    patch[STORAGE_KEY] = payload;
    storageSet(patch, onOk, onFail);
  }

  function load() {
    var query = {};
    query[STORAGE_KEY] = [];
    storageGet(query, function (stored) {
      keywords = sanitizeKeywords(stored[STORAGE_KEY]);
      render();
    }, function () {
      showStatus(msg("error_load_failed"));
      render();
    });
  }

  function addKeyword(event) {
    if (event) event.preventDefault();
    var entry = makeEntry(els.input ? els.input.value : "");
    if (!entry) {
      showStatus(msg("error_enter_keyword"));
      return;
    }
    for (var i = 0; i < keywords.length; i++) {
      if (keywords[i].n === entry.n) {
        showStatus(msg("error_duplicate_keyword"));
        return;
      }
    }
    var previous = cloneKeywords();
    keywords.push(entry);
    if (els.input) els.input.value = "";
    render();
    save(msg("status_keyword_saved"), previous);
    try { els.input.focus(); } catch (_) {}
  }

  function removeKeyword(event) {
    var target = event && event.target;
    if (!target || !target.closest) return;
    var button = target.closest(".kw-chip-del");
    if (!button) return;
    var item = button.closest(".kw-chip");
    var index = item ? parseInt(item.dataset.index, 10) : -1;
    if (index < 0 || index >= keywords.length) return;
    var previous = cloneKeywords();
    keywords.splice(index, 1);
    render();
    save(msg("status_keyword_removed"), previous);
  }

  function resetKeywords() {
    if (!keywords.length) return;
    var previous = cloneKeywords();
    keywords = [];
    render();
    save(msg("status_keywords_reset"), previous);
  }

  async function exportKeywords() {
    if (!keywords.length) return;
    var lines = [
      msg("export_header_name"),
      msg("export_header_help")
    ].concat(keywords.map(function (entry) { return entry.d; }));
    var body = lines.join("\n") + "\n";
    var filename = "news-hidden-keywords-" + dateStamp() + ".txt";
    var count = keywords.length;

    try {
      if (typeof File === "function" && navigator.share) {
        var file = new File([body], filename, { type: "text/plain" });
        if (!navigator.canShare || navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: filename,
            text: msg("share_text")
          });
          showStatus(msg("status_shared", String(count)), "ok");
          return;
        }
      }
    } catch (err) {
      if (err && err.name === "AbortError") {
        showStatus(msg("status_share_cancelled"), "info");
        return;
      }
    }

    if (downloadExportText(body, filename, count)) return;
    copyExportText(body, count);
  }

  function downloadExportText(body, filename, count) {
    try {
      if (typeof Blob !== "function" || !globalThis.URL || !URL.createObjectURL) return false;
      var blob = new Blob([body], { type: "text/plain;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.hidden = true;
      document.body.appendChild(link);
      link.click();
      setTimeout(function () {
        try { URL.revokeObjectURL(url); } catch (_) {}
        try { link.remove(); } catch (_) {}
      }, 0);
      showStatus(msg("status_downloaded", String(count)), "ok");
      return true;
    } catch (_) {
      return false;
    }
  }

  function copyExportText(body, count) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(body).then(function () {
          showStatus(msg("status_copied", String(count)), "ok");
        }, function () {
          showStatus(msg("error_export_failed"));
        });
        return true;
      }
    } catch (_) {}
    showStatus(msg("error_export_failed"));
    return false;
  }

  function dateStamp() {
    var d = new Date();
    return d.getFullYear() +
      ("0" + (d.getMonth() + 1)).slice(-2) +
      ("0" + d.getDate()).slice(-2);
  }

  function importText(text) {
    if (typeof text !== "string") text = "";
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);

    var lines = text.split(/\r\n|\r|\n|\u2028|\u2029/);
    var seen = Object.create(null);
    for (var i = 0; i < keywords.length; i++) seen[keywords[i].n] = 1;

    var previous = cloneKeywords();
    var added = 0;
    var skipped = 0;
    for (var j = 0; j < lines.length; j++) {
      var raw = lines[j].replace(/　/g, " ").replace(/\s+/g, " ").trim();
      if (!raw || raw.charAt(0) === "#") continue;
      if (raw.length > MAX_KEYWORD_LENGTH) {
        skipped++;
        continue;
      }
      var entry = makeEntry(raw);
      if (!entry || seen[entry.n]) {
        skipped++;
        continue;
      }
      seen[entry.n] = 1;
      keywords.push(entry);
      added++;
    }

    render();
    if (!added) {
      showStatus(skipped ? msg("error_no_importable_keywords") : msg("error_no_keywords_found"));
      return;
    }
    save(msg("status_imported", String(added)), previous);
  }

  function readFile(file) {
    if (!file) return;
    if (typeof file.size === "number" && file.size > IMPORT_MAX_BYTES) {
      showStatus(msg("error_file_too_large"));
      return;
    }

    var reader = new FileReader();
    reader.onerror = function () { showStatus(msg("error_file_read_failed")); };
    reader.onload = function (event) {
      importText(event && event.target ? String(event.target.result || "") : "");
    };
    try {
      reader.readAsText(file, "utf-8");
    } catch (_) {
      showStatus(msg("error_file_read_failed"));
    }
  }

  function chooseFile() {
    if (!els.file) return;
    showStatus("");
    try { els.file.value = ""; } catch (_) {}
    els.file.click();
  }

  function fileChosen(event) {
    var input = event && event.target;
    if (!input || !input.files || !input.files.length) return;
    readFile(input.files[0]);
  }

  function init() {
    els.form = document.getElementById("kwForm");
    els.title = document.getElementById("filtersTitle");
    els.description = document.getElementById("filtersDescription");
    els.input = document.getElementById("kwInput");
    els.addButton = document.getElementById("kwAdd");
    els.chips = document.getElementById("kwChips");
    els.empty = document.getElementById("kwEmpty");
    els.count = document.getElementById("kwCount");
    els.status = document.getElementById("kwStatus");
    els.actions = document.getElementById("kwActions");
    els.importButton = document.getElementById("kwImport");
    els.exportButton = document.getElementById("kwExport");
    els.resetButton = document.getElementById("kwReset");
    els.file = document.getElementById("kwFile");

    if (els.form) els.form.addEventListener("submit", addKeyword);
    if (els.chips) els.chips.addEventListener("click", removeKeyword);
    if (els.input) els.input.addEventListener("input", function () { showStatus(""); });
    if (els.importButton) els.importButton.addEventListener("click", chooseFile);
    if (els.exportButton) els.exportButton.addEventListener("click", exportKeywords);
    if (els.resetButton) els.resetButton.addEventListener("click", resetKeywords);
    if (els.file) els.file.addEventListener("change", fileChosen);

    applyLocalization();
    load();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
