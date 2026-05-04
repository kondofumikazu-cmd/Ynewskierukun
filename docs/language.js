(function () {
  "use strict";

  function preferredLanguage() {
    var hash = window.location.hash.replace("#", "").toLowerCase();
    if (hash === "en" || hash === "ja") return hash;
    var query = new URLSearchParams(window.location.search).get("lang");
    if (query === "en" || query === "ja") return query;
    return "ja";
  }

  function setLanguage(lang) {
    var panels = document.querySelectorAll("[data-lang]");
    var buttons = document.querySelectorAll("[data-set-lang]");

    document.documentElement.lang = lang;

    panels.forEach(function (panel) {
      panel.hidden = panel.getAttribute("data-lang") !== lang;
    });

    buttons.forEach(function (button) {
      var active = button.getAttribute("data-set-lang") === lang;
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });

    if (window.history && window.history.replaceState) {
      window.history.replaceState(null, "", "#" + lang);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    document.querySelectorAll("[data-set-lang]").forEach(function (button) {
      button.addEventListener("click", function () {
        setLanguage(button.getAttribute("data-set-lang"));
      });
    });

    setLanguage(preferredLanguage());
  });
})();
