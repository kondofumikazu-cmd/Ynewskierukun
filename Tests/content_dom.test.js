const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");

class ClassList {
  constructor(owner, initial) {
    this.owner = owner;
    this.values = new Set(String(initial || "").split(/\s+/).filter(Boolean));
  }

  add(value) {
    this.values.add(value);
    this.sync();
  }

  remove(value) {
    this.values.delete(value);
    this.sync();
  }

  contains(value) {
    return this.values.has(value);
  }

  toggle(value, force) {
    const enabled = typeof force === "boolean" ? force : !this.values.has(value);
    if (enabled) this.values.add(value);
    else this.values.delete(value);
    this.sync();
    return enabled;
  }

  sync() {
    const value = Array.from(this.values).join(" ");
    if (value) this.owner.attributes.class = value;
    else delete this.owner.attributes.class;
  }
}

class Element {
  constructor(tagName, attributes, text) {
    this.nodeType = 1;
    this.tagName = String(tagName || "div").toUpperCase();
    this.localName = this.tagName.toLowerCase();
    this.attributes = Object.assign({}, attributes || {});
    this.children = [];
    this.parentElement = null;
    this._text = text || "";
    this.classList = new ClassList(this, this.attributes.class);
  }

  appendChild(child) {
    child.parentElement = this;
    this.children.push(child);
    return child;
  }

  get id() {
    return this.attributes.id || "";
  }

  get textContent() {
    return this._text + this.children.map((child) => child.textContent).join("");
  }

  set textContent(value) {
    this._text = String(value || "");
    this.children = [];
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name === "class") this.classList = new ClassList(this, value);
  }

  getAttribute(name) {
    return Object.prototype.hasOwnProperty.call(this.attributes, name)
      ? this.attributes[name]
      : null;
  }

  removeAttribute(name) {
    delete this.attributes[name];
    if (name === "class") this.classList = new ClassList(this, "");
  }

  matches(selector) {
    return matchesSelector(this, selector);
  }

  closest(selector) {
    let node = this;
    while (node) {
      if (node.matches && node.matches(selector)) return node;
      node = node.parentElement;
    }
    return null;
  }

  contains(target) {
    let node = target;
    while (node) {
      if (node === this) return true;
      node = node.parentElement;
    }
    return false;
  }

  querySelectorAll(selector) {
    const out = [];
    const visit = (node) => {
      for (const child of node.children) {
        if (child.matches(selector)) out.push(child);
        visit(child);
      }
    };
    visit(this);
    return out;
  }

  addEventListener() {}
}

class Document {
  constructor() {
    this.nodeType = 9;
    this.hidden = false;
    this.readyState = "complete";
    this.listeners = Object.create(null);
    this.documentElement = new Element("html");
    this.body = new Element("body");
    this.documentElement.appendChild(this.body);
  }

  querySelectorAll(selector) {
    const out = [];
    if (this.documentElement.matches(selector)) out.push(this.documentElement);
    return out.concat(this.documentElement.querySelectorAll(selector));
  }

  addEventListener(type, callback) {
    if (!this.listeners[type]) this.listeners[type] = [];
    this.listeners[type].push(callback);
  }
}

function splitSelectors(selector) {
  return String(selector || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function matchesSelector(element, selector) {
  return splitSelectors(selector).some((item) => matchesSingleSelector(element, item));
}

function matchesSingleSelector(element, selector) {
  if (!selector) return false;
  if (selector[0] === "#") return element.id === selector.slice(1);
  if (selector[0] === ".") return element.classList.contains(selector.slice(1));
  if (selector[0] === "[") {
    const match = selector.match(/^\[([^=\]^*]+)(?:([\^*]?=)['"]?([^'"\]]+)['"]?)?\]$/);
    if (!match) return false;
    const value = element.getAttribute(match[1]);
    if (value === null) return false;
    if (!match[2]) return true;
    if (match[2] === "=") return value === match[3];
    if (match[2] === "^=") return value.startsWith(match[3]);
    if (match[2] === "*=") return value.includes(match[3]);
    return false;
  }
  return element.localName === selector.toLowerCase();
}

function loadScript(context, relativePath) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  vm.runInContext(source, context, { filename: relativePath });
}

function readFixture(name) {
  return fs.readFileSync(path.join(root, "Tests/fixtures", name), "utf8");
}

function parseAttributes(raw) {
  const out = {};
  const pattern = /([a-zA-Z0-9_-]+)="([^"]*)"/g;
  let match = null;
  while ((match = pattern.exec(raw))) out[match[1]] = match[2];
  return out;
}

function buildFixtureDocument(html) {
  const document = new Document();
  const sectionMatch = html.match(/<section\s+([^>]*)>([\s\S]*?)<\/section>/i);
  assert(sectionMatch, "fixture should contain a section");
  const section = document.body.appendChild(new Element("section", parseAttributes(sectionMatch[1])));
  const cards = [];
  const articlePattern = /<article\s+([^>]*)>\s*<a\s+([^>]*)>([^<]*)<\/a>\s*<\/article>/gi;
  let match = null;
  while ((match = articlePattern.exec(sectionMatch[2]))) {
    const card = section.appendChild(new Element("article", parseAttributes(match[1])));
    const link = card.appendChild(new Element("a", parseAttributes(match[2]), match[3]));
    cards.push({ card, link });
  }
  assert(cards.length > 0, "fixture should contain cards");
  return { document, cards };
}

function runScenario(options) {
  const fixture = buildFixtureDocument(readFixture(options.fixture));
  const document = fixture.document;
  const storageListeners = [];
  const windowListeners = Object.create(null);
  const scheduledTimers = [];
  const observers = [];
  let storedKeywords = options.initialKeywords;
  const storage = new Map();
  const context = {
    console,
    document,
    sessionStorage: {
      getItem(key) {
        return storage.has(key) ? storage.get(key) : null;
      },
      setItem(key, value) {
        storage.set(key, String(value));
      }
    },
    location: { hostname: "www.yahoo.co.jp", href: "https://www.yahoo.co.jp/" },
    navigator: { platform: "MacIntel", userAgent: "Macintosh", maxTouchPoints: 0 },
    history: {
      pushState() {},
      replaceState() {}
    },
    addEventListener(type, callback) {
      if (!windowListeners[type]) windowListeners[type] = [];
      windowListeners[type].push(callback);
    },
    setTimeout(callback) {
      const timer = { callback, cleared: false };
      scheduledTimers.push(timer);
      return timer;
    },
    clearTimeout(timer) {
      if (timer) timer.cleared = true;
    },
    browser: {
      runtime: {},
      storage: {
        local: {
          get(query, callback) {
            const key = Object.keys(query)[0];
            callback({ [key]: storedKeywords });
          }
        },
        onChanged: {
          addListener(callback) {
            storageListeners.push(callback);
          }
        }
      }
    },
    MutationObserver: class {
      constructor(callback) {
        this.callback = callback;
        this.disconnected = false;
        observers.push(this);
      }
      observe(target, observerOptions) {
        this.target = target;
        this.options = observerOptions;
      }
      disconnect() {
        this.disconnected = true;
      }
    }
  };
  context.globalThis = context;
  context.window = context;
  context.YNCH_CONFIG = options.config;

  vm.createContext(context);
  loadScript(context, "Extension/Resources/keyword_utils.js");
  loadScript(context, "Extension/Resources/keyword_matcher.js");
  loadScript(context, "Extension/Resources/content_lifecycle.js");
  loadScript(context, "Extension/Resources/comment_recovery_budget.js");
  loadScript(context, "Extension/Resources/content.js");

  for (const item of fixture.cards) {
    const expected = item.card.getAttribute("data-expected-hidden") === "true";
    assert.strictEqual(item.card.getAttribute("data-keyword-hidden") === "true", expected, options.fixture);
    assert.strictEqual(item.card.getAttribute("data-keyword-checked"), "true", options.fixture);
  }

  if (options.updatedKeywords) {
    storedKeywords = options.updatedKeywords;
    for (const listener of storageListeners) {
      listener({ filterKeywords: { newValue: storedKeywords } }, "local");
    }
    assert.strictEqual(fixture.cards[0].card.getAttribute("data-keyword-hidden"), null);
    assert.strictEqual(fixture.cards[1].card.getAttribute("data-keyword-hidden"), "true");
  }

  assert.ok(scheduledTimers.length > 0);
  assert.ok(observers.length > 0);
  for (const listener of windowListeners.pagehide || []) {
    listener({ persisted: false });
  }
  assert.strictEqual(context.YNCHContentLifecycle.isDisposed(), true);
  assert.strictEqual(scheduledTimers.every((timer) => timer.cleared), true);
  assert.strictEqual(observers.every((observer) => observer.disconnected), true);
}

runScenario({
  fixture: "yahoo_top.html",
  initialKeywords: [{ d: "Alpha", n: "alpha" }],
  updatedKeywords: [{ d: "Beta", n: "beta" }],
  config: {
    supportedHosts: ["www.yahoo.co.jp"],
    keywordScopes: ["#newsFeed"],
    keywordCards: [".news-card"],
    keywordArticleLinks: ["a"],
    keywordHeadlines: [".news-title"],
    keywordPendingScopes: ["#newsFeed"]
  }
});

runScenario({
  fixture: "yahoo_article.html",
  initialKeywords: [{ d: "Gamma", n: "gamma" }],
  config: {
    supportedHosts: ["www.yahoo.co.jp"],
    keywordScopes: ["#uamods-recommend"],
    keywordCards: [".related-card"],
    keywordArticleLinks: ["a"],
    keywordHeadlines: [".related-title"],
    keywordPendingScopes: ["#uamods-recommend"]
  }
});

runScenario({
  fixture: "yahoo_mobile.html",
  initialKeywords: [{ d: "Mobile Alpha", n: "mobile alpha" }],
  config: {
    supportedHosts: ["www.yahoo.co.jp"],
    keywordScopes: ["#Topics"],
    keywordCards: [".topic-card"],
    keywordArticleLinks: ["a"],
    keywordHeadlines: [".topic-title"],
    keywordPendingScopes: ["#Topics"]
  }
});

console.log("content_dom.test.js passed");
