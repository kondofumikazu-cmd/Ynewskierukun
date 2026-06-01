/* =========================================================================
 * Y News きえるくん拡張 - コンテンツスクリプト
 *
 * 固定セレクタ非表示: static_rules.css / network_rules.json
 *
 * キーワード非表示対象:
 *   ニュース一覧・関連記事・おすすめ欄などの一覧カード
 *
 * 動作対象: yahoo.co.jp / www.yahoo.co.jp / m.yahoo.co.jp / news.yahoo.co.jp
 * ========================================================================= */

(() => {
    "use strict";

    if (window.top !== window.self) return;

    const ruleConfig = (typeof globalThis !== "undefined" && globalThis.YNCH_CONFIG)
        ? globalThis.YNCH_CONFIG
        : {};
    const keywordUtils = (typeof globalThis !== "undefined" && globalThis.YNCHKeywordUtils)
        ? globalThis.YNCHKeywordUtils
        : null;
    const keywordMatcherApi = (typeof globalThis !== "undefined" && globalThis.YNCHKeywordMatcher)
        ? globalThis.YNCHKeywordMatcher
        : null;
    const lifecycle = (typeof globalThis !== "undefined" && globalThis.YNCHContentLifecycle)
        ? globalThis.YNCHContentLifecycle
        : null;
    const recoveryBudgetApi = (typeof globalThis !== "undefined" && globalThis.YNCHCommentRecoveryBudget)
        ? globalThis.YNCHCommentRecoveryBudget
        : null;

    function configArray(name) {
        const value = ruleConfig[name];
        if (!Array.isArray(value)) return [];
        return value.filter((item) => typeof item === "string" && item);
    }

    function selectorList(name) {
        return configArray(name).join(",");
    }

    const SUPPORTED_HOSTS = new Set(configArray("supportedHosts"));
    if (!SUPPORTED_HOSTS.has(location.hostname)) return;
    const IS_NEWS_HOST = location.hostname === "news.yahoo.co.jp";

    const extensionApi = typeof browser !== "undefined"
        ? browser
        : (typeof chrome !== "undefined" ? chrome : null);

    const KEYWORD_STORAGE_KEY = "filterKeywords";
    const MACOS_PLATFORM_CLASS = "ynch-platform-macos";
    const COMMENT_PANEL_SELECTOR = "#swipeFrame #tab-panel-comment-timeline";
    const COMMENT_TAB_HIDDEN_CLASS = "ynch-comment-tab-hidden";
    const COMMENT_TAB_SYNC_DELAY_MS = 80;
    const COMMENT_TAB_REDIRECT_DELAYS_MS = [0, 160, 420];
    const COMMENT_TAB_SWIPE_MIN_X = 45;
    const COMMENT_TAB_SWIPE_MAX_Y = 90;
    const COMMENT_TAB_BLANK_RECOVERY_MS = 700;
    const COMMENT_TAB_BLANK_CONFIRM_MS = 450;
    const COMMENT_TAB_FORCE_LOAD_MS = 180;
    const COMMENT_TAB_RECOVERY_COOLDOWN_MS = 8000;
    const COMMENT_TAB_OBSERVER_REFRESH_DELAY_MS = 300;
    const COMMENT_TAB_RECOVERY_STORAGE_PREFIX = "ynchBlankTabRecovery:";
    const COMMENT_TAB_RECOVERY_COUNT_KEY = COMMENT_TAB_RECOVERY_STORAGE_PREFIX + "count";
    const COMMENT_TAB_MAX_RECOVERIES_PER_TAB = 1;
    const COMMENT_TAB_MUTATION_ROOT_SELECTOR = "#swipeFrame,[role='tablist'],#Topics";
    const COMMENT_TAB_MUTATION_NODE_SELECTOR = "#swipeFrame,[role='tablist'],[role='tab'],#Topics,[id^='tab-panel-'],#tab-panel-comment-timeline";
    const NEWS_TAB_SCAN_SELECTOR = "[role='tab'],[role='tablist'] a,[role='tablist'] button,[role='tablist'] li";
    const NEWS_TAB_FALLBACK_SELECTOR = "[role='tab'],a,button,li";
    const NEWS_TAB_POINT_SCAN_LIMIT = 100;
    const NEWS_TAB_CACHE_MS = 1000;
    const NEWS_TAB_LABELS = [
        "主要",
        "エンタメ",
        "スポーツ",
        "経済",
        "国内",
        "IT",
        "地域",
        "国際",
        "科学",
        "ライフ",
    ];
    const NEWS_TAB_PATHS = {
        "主要": "/",
        "エンタメ": "/categories/entertainment",
        "スポーツ": "/categories/sports",
        "経済": "/categories/business",
        "国内": "/categories/domestic",
        "IT": "/categories/it",
        "地域": "/categories/local",
        "国際": "/categories/world",
        "科学": "/categories/science",
        "ライフ": "/categories/life",
    };
    const KEYWORD_HIDE_CLASS = "ynch-keyword-hidden";
    const KEYWORD_HIDE_ATTR = "data-keyword-hidden";
    const KEYWORD_CHECKED_ATTR = "data-keyword-checked";
    const KEYWORD_GENERATION_ATTR = "data-keyword-generation";
    const KEYWORD_ACTIVE_CLASS = "ynch-keyword-filter-active";
    const KEYWORD_PENDING_CLASS = "ynch-keyword-filter-pending";
    const KEYWORD_READY_CLASS = "ynch-keyword-filter-ready";
    const KEYWORD_SCOPE_SELECTOR = selectorList("keywordScopes");
    const KEYWORD_CARD_SELECTOR = selectorList("keywordCards");
    const KEYWORD_ARTICLE_LINK_SELECTOR = selectorList("keywordArticleLinks");
    const KEYWORD_HEADLINE_SELECTOR = selectorList("keywordHeadlines");
    const KEYWORD_MUTATION_CANDIDATE_SELECTOR = [
        KEYWORD_SCOPE_SELECTOR,
        KEYWORD_CARD_SELECTOR,
        KEYWORD_ARTICLE_LINK_SELECTOR,
        KEYWORD_HEADLINE_SELECTOR,
    ].join(",");
    const KEYWORD_TEXT_MAX = 900;
    const KEYWORD_REFRESH_DELAY_MS = 1000;
    const KEYWORD_MUTATION_DEBOUNCE_MS = 80;
    const KEYWORD_PENDING_RELEASE_DELAY_MS = 250;
    const KEYWORD_PENDING_MAX_MS = 5000;
    const KEYWORD_NAVIGATION_RECHECK_DELAYS_MS = [0, 150, 500, 1200];

    let keywordObservers = [];
    let keywordDocumentObserver = null;
    let observerRefreshTimer = null;
    let keywordPendingTimer = null;
    let keywordPendingReleaseTimer = null;
    let keywordFilterTimer = null;
    let keywordScheduled = false;
    let pendingKeywordRoots = new Set();
    const keywordTextCache = new WeakMap();
    let navigationCheckTimer = null;
    let navigationFilterTimers = [];
    let commentTabObserver = null;
    let commentTabRootObservers = [];
    let commentTabObserverRefreshTimer = null;
    let commentTabSyncTimer = null;
    let commentTabSkipTimers = [];
    let commentBlankRecoveryTimer = null;
    let commentBlankConfirmTimer = null;
    let commentForceLoadTimer = null;
    let lastNonCommentTab = "major";
    let commentSwipeStartX = null;
    let commentSwipeStartY = null;
    let commentRedirectTarget = "";
    let commentRecoveryHref = "";
    const newsTabCache = new Map();
    let newsTabCacheExpiresAt = 0;
    let lastSeenUrl = location.href;
    let keywords = [];
    let keywordsLoaded = false;
    let keywordGeneration = 0;
    let keywordMatcher = createKeywordMatcher([]);
    const commentRecoveryBudget = createCommentRecoveryBudget();

    function scheduleTimer(callback, delay) {
        if (lifecycle && typeof lifecycle.setTimeout === "function") {
            return lifecycle.setTimeout(callback, delay);
        }
        return globalThis.setTimeout(callback, delay);
    }

    function cancelTimer(timer) {
        if (!timer) return;
        if (lifecycle && typeof lifecycle.clearTimeout === "function") {
            lifecycle.clearTimeout(timer);
            return;
        }
        globalThis.clearTimeout(timer);
    }

    function trackObserver(observer) {
        if (lifecycle && typeof lifecycle.trackObserver === "function") {
            lifecycle.trackObserver(observer);
        }
        return observer;
    }

    function forgetObserver(observer) {
        if (lifecycle && typeof lifecycle.forgetObserver === "function") {
            lifecycle.forgetObserver(observer);
        }
    }

    function createKeywordMatcher(values) {
        if (keywordMatcherApi && typeof keywordMatcherApi.create === "function") {
            return keywordMatcherApi.create(values);
        }
        const list = Array.isArray(values) ? values.slice() : [];
        return {
            size: list.length,
            keywords: list,
            matches(text) {
                if (!text) return false;
                for (const keyword of list) {
                    if (keyword && text.includes(keyword)) return true;
                }
                return false;
            },
        };
    }

    function createCommentRecoveryBudget() {
        if (recoveryBudgetApi && typeof recoveryBudgetApi.create === "function") {
            return recoveryBudgetApi.create({
                storage: typeof sessionStorage !== "undefined" ? sessionStorage : null,
                key: COMMENT_TAB_RECOVERY_COUNT_KEY,
                max: COMMENT_TAB_MAX_RECOVERIES_PER_TAB,
            });
        }
        return {
            consume() {
                try {
                    const current = Number(sessionStorage.getItem(COMMENT_TAB_RECOVERY_COUNT_KEY) || 0);
                    if (current >= COMMENT_TAB_MAX_RECOVERIES_PER_TAB) return false;
                    sessionStorage.setItem(COMMENT_TAB_RECOVERY_COUNT_KEY, String(current + 1));
                } catch (_) {}
                return true;
            },
        };
    }

    function normalizeText(value) {
        if (keywordUtils && typeof keywordUtils.normalizeKeyword === "function") {
            return keywordUtils.normalizeKeyword(value);
        }
        if (typeof value !== "string" || !value) return "";
        let text = value;
        try {
            text = text.normalize("NFKC");
        } catch (_) {}
        return text.replace(/　/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
    }

    function normalizeTabText(value) {
        if (typeof value !== "string" || !value) return "";
        let text = value;
        try {
            text = text.normalize("NFKC");
        } catch (_) {}
        return text.replace(/\s+/g, "").trim().toLowerCase();
    }

    function ingestKeywords(stored) {
        const next = [];
        const seen = new Set();
        if (Array.isArray(stored)) {
            for (const item of stored) {
                let normalized = "";
                if (typeof item === "string") {
                    normalized = normalizeText(item);
                } else if (item && typeof item === "object") {
                    normalized = normalizeText(
                        typeof item.n === "string" && item.n ? item.n : item.d
                    );
                }
                if (!normalized || seen.has(normalized)) continue;
                seen.add(normalized);
                next.push(normalized);
            }
        }
        keywords = next;
        keywordMatcher = createKeywordMatcher(keywords);
        keywordGeneration += 1;
        syncKeywordActiveClass();
    }

    function syncKeywordActiveClass() {
        try {
            document.documentElement.classList.toggle(KEYWORD_ACTIVE_CLASS, keywords.length > 0);
        } catch (_) {}
    }

    function consumeLastError() {
        try {
            return extensionApi && extensionApi.runtime && extensionApi.runtime.lastError;
        } catch (_) {
            return null;
        }
    }

    function isMacOSPlatform() {
        const platform = String(navigator.platform || "").toLowerCase();
        const userAgent = String(navigator.userAgent || "").toLowerCase();
        const maxTouchPoints = Number(navigator.maxTouchPoints || 0);
        const looksLikeMac = platform.includes("mac") || userAgent.includes("macintosh") || userAgent.includes("mac os x");
        return looksLikeMac && !(maxTouchPoints > 1 && (platform === "macintel" || userAgent.includes("macintosh")));
    }

    function syncPlatformClass() {
        if (!isMacOSPlatform()) return;
        try {
            document.documentElement.classList.add(MACOS_PLATFORM_CLASS);
        } catch (_) {}
    }

    function storageGet(query, onSuccess) {
        const area = extensionApi && extensionApi.storage && extensionApi.storage.local;
        if (!area || !area.get) return false;
        let settled = false;
        function finish(value) {
            if (settled) return;
            settled = true;
            if (consumeLastError()) return;
            onSuccess(value || {});
        }
        function fail() {
            finish({});
        }
        try {
            const result = area.get(query, finish);
            if (result && typeof result.then === "function") result.then(finish, fail);
        } catch (_) {
            return false;
        }
        return true;
    }

    function matchesKeyword(text) {
        return Boolean(keywordMatcher && keywordMatcher.matches(text));
    }

    function getElementRoot(root) {
        return root && root.nodeType === 1 ? root : document;
    }

    function isRootConnected(root) {
        if (root === document) return true;
        return !!(root && root.nodeType === 1 && document.documentElement && document.documentElement.contains(root));
    }

    function queueKeywordRoot(root) {
        const next = getElementRoot(root);
        if (next === document || next === document.documentElement || next === document.body) {
            pendingKeywordRoots.clear();
            pendingKeywordRoots.add(document);
            return;
        }
        if (!isRootConnected(next)) return;

        for (const item of Array.from(pendingKeywordRoots)) {
            if (item === document || item === document.documentElement || item === document.body) return;
            try {
                if (item.contains && item.contains(next)) return;
            } catch (_) {}
            try {
                if (next.contains && next.contains(item)) pendingKeywordRoots.delete(item);
            } catch (_) {}
        }
        pendingKeywordRoots.add(next);
    }

    function clearQueuedKeywordFilter() {
        if (keywordFilterTimer) {
            cancelTimer(keywordFilterTimer);
            keywordFilterTimer = null;
        }
        keywordScheduled = false;
        pendingKeywordRoots.clear();
    }

    function collectHeadlineText(card) {
        if (!card || card.nodeType !== 1) return "";
        let combined = "";

        function appendText(node) {
            if (!node) return;
            const raw = node.textContent || "";
            if (!raw) return;
            combined += " " + raw;
        }

        try {
            if (card.matches && card.matches(KEYWORD_HEADLINE_SELECTOR)) {
                appendText(card);
            }
        } catch (_) {}

        let nodes = null;
        try {
            nodes = card.querySelectorAll(KEYWORD_HEADLINE_SELECTOR);
        } catch (_) {}

        if (nodes && nodes.length) {
            for (const node of nodes) {
                if (combined.length >= KEYWORD_TEXT_MAX) break;
                appendText(node);
            }
        }

        if (!combined) combined = card.textContent || "";
        return combined.slice(0, KEYWORD_TEXT_MAX);
    }

    function collectNormalizedHeadlineText(card) {
        if (!card || card.nodeType !== 1) return "";
        const cached = keywordTextCache.get(card);
        const source = collectHeadlineText(card);
        if (cached && cached.source === source) return cached.normalized;
        const normalized = normalizeText(source);
        keywordTextCache.set(card, { source, normalized });
        return normalized;
    }

    function findKeywordCards(root) {
        const cards = [];
        const seen = new Set();
        const scope = root && root.nodeType === 1 ? root : document;

        function addCard(card) {
            if (!card || card.nodeType !== 1 || seen.has(card)) return;
            seen.add(card);
            cards.push(card);
        }

        try {
            if (scope.matches && scope.matches(KEYWORD_CARD_SELECTOR) && !isKeywordScopeContainer(scope)) {
                addCard(scope);
                return cards;
            }
        } catch (_) {}

        const scopes = findKeywordScopes(scope);
        const searchScopes = scopes.length ? scopes : [scope];
        for (const listScope of searchScopes) {
            let nodes = null;
            try {
                nodes = listScope.querySelectorAll(KEYWORD_CARD_SELECTOR);
            } catch (_) {}
            if (nodes && nodes.length) {
                for (const node of nodes) addCard(node);
            }

            let anchors = null;
            try {
                anchors = listScope.querySelectorAll(KEYWORD_ARTICLE_LINK_SELECTOR);
            } catch (_) {}
            if (!anchors) continue;
            for (const anchor of anchors) addCard(findArticleCard(anchor, listScope));
        }
        return cards;
    }

    function findKeywordScopes(root) {
        const scopes = [];
        const seen = new Set();
        const scope = root && root.nodeType === 1 ? root : document;

        function addScope(node) {
            if (!node || node.nodeType !== 1 || seen.has(node)) return;
            for (const item of Array.from(seen)) {
                try {
                    if (item.contains && item.contains(node)) return;
                } catch (_) {}
                try {
                    if (node.contains && node.contains(item)) {
                        seen.delete(item);
                        const index = scopes.indexOf(item);
                        if (index >= 0) scopes.splice(index, 1);
                    }
                } catch (_) {}
            }
            seen.add(node);
            scopes.push(node);
        }

        try {
            if (scope.matches && scope.matches(KEYWORD_SCOPE_SELECTOR)) addScope(scope);
        } catch (_) {}

        try {
            if (scope.closest) addScope(scope.closest(KEYWORD_SCOPE_SELECTOR));
        } catch (_) {}

        let nodes = null;
        try {
            nodes = scope.querySelectorAll(KEYWORD_SCOPE_SELECTOR);
        } catch (_) {}

        if (nodes && nodes.length) {
            for (const node of nodes) addScope(node);
        }

        return scopes;
    }

    function isKeywordScopeContainer(node) {
        if (!node || node.nodeType !== 1) return false;
        try {
            return node.matches(KEYWORD_SCOPE_SELECTOR);
        } catch (_) {
            return false;
        }
    }

    function containsKeywordScope(node) {
        if (!node || node.nodeType !== 1) return false;
        if (isKeywordScopeContainer(node)) return true;
        try {
            return !!node.querySelector(KEYWORD_SCOPE_SELECTOR);
        } catch (_) {
            return false;
        }
    }

    function isKeywordMutationCandidate(node) {
        const element = node && node.nodeType === 1
            ? node
            : (node && node.parentElement ? node.parentElement : null);
        if (!element) return false;

        try {
            if (
                element.matches(KEYWORD_SCOPE_SELECTOR)
                || element.matches(KEYWORD_CARD_SELECTOR)
                || element.matches(KEYWORD_ARTICLE_LINK_SELECTOR)
                || element.matches(KEYWORD_HEADLINE_SELECTOR)
            ) {
                return true;
            }
        } catch (_) {}

        try {
            if (element.closest(KEYWORD_SCOPE_SELECTOR)) return true;
        } catch (_) {}

        try {
            return Boolean(element.querySelector(KEYWORD_MUTATION_CANDIDATE_SELECTOR));
        } catch (_) {
            return false;
        }
    }

    function findArticleCard(anchor, scope) {
        if (!anchor || anchor.nodeType !== 1 || !scope || !scope.contains(anchor)) return null;

        try {
            const direct = anchor.closest(KEYWORD_CARD_SELECTOR);
            if (direct && direct !== scope && scope.contains(direct) && !isKeywordScopeContainer(direct)) {
                return direct;
            }
        } catch (_) {}

        let node = anchor;
        let best = anchor;
        for (let depth = 0; node && node !== scope && depth < 8; depth += 1) {
            try {
                if (node.matches && node.matches("li,article,[data-ual-view-type='list']")) {
                    best = node;
                }
            } catch (_) {}

            const parent = node.parentElement;
            if (!parent) break;
            if (parent === scope) {
                if (!isKeywordScopeContainer(node)) best = node;
                break;
            }
            try {
                if (parent.matches && parent.matches("ul,ol,.newsFeed_list")) {
                    if (!isKeywordScopeContainer(node)) best = node;
                    break;
                }
            } catch (_) {}
            node = parent;
        }

        return best && best !== scope ? best : null;
    }

    function findContainingKeywordCard(node) {
        const element = node && node.nodeType === 1
            ? node
            : (node && node.parentElement ? node.parentElement : null);
        if (!element) return null;

        try {
            const direct = element.closest(KEYWORD_CARD_SELECTOR);
            if (direct && !isKeywordScopeContainer(direct)) return direct;
        } catch (_) {}

        try {
            const scope = element.closest(KEYWORD_SCOPE_SELECTOR);
            const anchor = element.closest(KEYWORD_ARTICLE_LINK_SELECTOR);
            if (scope && anchor) return findArticleCard(anchor, scope);
        } catch (_) {}

        return null;
    }

    function findKeywordMutationRoot(node) {
        const element = node && node.nodeType === 1
            ? node
            : (node && node.parentElement ? node.parentElement : null);
        if (!element) return document;

        const card = findContainingKeywordCard(element);
        if (card) return card;

        try {
            const scope = element.closest(KEYWORD_SCOPE_SELECTOR);
            if (scope) return scope;
        } catch (_) {}

        return element;
    }

    function markKeywordCardUnchecked(card) {
        if (!card || card.nodeType !== 1) return;
        keywordTextCache.delete(card);
        try {
            card.removeAttribute(KEYWORD_GENERATION_ATTR);
        } catch (_) {}
        // Keep already rendered cards visible while Yahoo updates their DOM.
        // Re-removing this attribute makes normal articles blink until the
        // next keyword pass marks them checked again.
    }

    function markKeywordSubtreeUnchecked(root) {
        const element = root && root.nodeType === 1
            ? root
            : (root && root.parentElement ? root.parentElement : null);
        if (!element) return;

        const card = findContainingKeywordCard(root);
        if (card) {
            markKeywordCardUnchecked(card);
            return;
        }

        const cards = findKeywordCards(element);
        for (const item of cards) markKeywordCardUnchecked(item);
    }

    function clearKeywordElementState() {
        let nodes = null;
        try {
            nodes = document.querySelectorAll(
                "[" + KEYWORD_HIDE_ATTR + "='true'],." + KEYWORD_HIDE_CLASS + ",[" + KEYWORD_CHECKED_ATTR + "],[" + KEYWORD_GENERATION_ATTR + "]"
            );
        } catch (_) {}
        if (!nodes) return;
        for (const node of nodes) {
            try {
                node.removeAttribute(KEYWORD_HIDE_ATTR);
                node.removeAttribute(KEYWORD_CHECKED_ATTR);
                node.removeAttribute(KEYWORD_GENERATION_ATTR);
                node.classList.remove(KEYWORD_HIDE_CLASS);
            } catch (_) {}
        }
    }

    function runKeywordFilter(root) {
        if (!isRootConnected(getElementRoot(root))) return;
        if (!keywords.length) {
            clearKeywordElementState();
            releaseKeywordPendingWhenReady();
            return;
        }

        const cards = findKeywordCards(root);
        const generation = String(keywordGeneration);
        for (const card of cards) {
            try {
                if (
                    card.getAttribute(KEYWORD_CHECKED_ATTR) === "true"
                    && card.getAttribute(KEYWORD_GENERATION_ATTR) === generation
                ) {
                    continue;
                }
            } catch (_) {}
            const headline = collectNormalizedHeadlineText(card);
            try {
                if (matchesKeyword(headline)) {
                    hideKeywordCard(card, generation);
                } else {
                    showKeywordCard(card, generation);
                }
            } catch (_) {}
        }
        releaseKeywordPendingWhenReady();
    }

    function hideKeywordCard(card, generation) {
        if (!card || card.nodeType !== 1) return;
        try {
            card.setAttribute(KEYWORD_HIDE_ATTR, "true");
            card.setAttribute(KEYWORD_CHECKED_ATTR, "true");
            card.setAttribute(KEYWORD_GENERATION_ATTR, generation);
        } catch (_) {}
        try {
            card.classList.add(KEYWORD_HIDE_CLASS);
        } catch (_) {}
    }

    function showKeywordCard(card, generation) {
        if (!card || card.nodeType !== 1) return;
        try {
            card.removeAttribute(KEYWORD_HIDE_ATTR);
            card.setAttribute(KEYWORD_CHECKED_ATTR, "true");
            card.setAttribute(KEYWORD_GENERATION_ATTR, generation);
            card.classList.remove(KEYWORD_HIDE_CLASS);
        } catch (_) {}
    }

    function beginKeywordPending() {
        try {
            document.documentElement.classList.remove(KEYWORD_READY_CLASS);
            document.documentElement.classList.add(KEYWORD_PENDING_CLASS);
        } catch (_) {}
        if (keywordPendingTimer) cancelTimer(keywordPendingTimer);
        keywordPendingTimer = scheduleTimer(() => {
            keywordPendingTimer = null;
            endKeywordPending();
        }, KEYWORD_PENDING_MAX_MS);
    }

    function endKeywordPending() {
        if (keywordPendingTimer) {
            cancelTimer(keywordPendingTimer);
            keywordPendingTimer = null;
        }
        if (keywordPendingReleaseTimer) {
            cancelTimer(keywordPendingReleaseTimer);
            keywordPendingReleaseTimer = null;
        }
        try {
            document.documentElement.classList.remove(KEYWORD_PENDING_CLASS);
            document.documentElement.classList.add(KEYWORD_READY_CLASS);
        } catch (_) {}
    }

    function releaseKeywordPendingWhenReady() {
        if (!keywordsLoaded) return;
        if (!keywords.length) {
            endKeywordPending();
            return;
        }
        if (document.readyState === "loading") return;
        if (keywordPendingReleaseTimer) return;
        keywordPendingReleaseTimer = scheduleTimer(endKeywordPending, KEYWORD_PENDING_RELEASE_DELAY_MS);
    }

    function isKeywordFilterPending() {
        try {
            const root = document.documentElement;
            return Boolean(root && root.classList.contains(KEYWORD_PENDING_CLASS));
        } catch (_) {
            return false;
        }
    }

    function scheduleKeywordFilter(root) {
        if (!keywords.length || document.hidden) return;
        queueKeywordRoot(root);
        if (!pendingKeywordRoots.size) return;
        if (keywordScheduled) return;
        keywordScheduled = true;
        keywordFilterTimer = scheduleTimer(() => {
            keywordFilterTimer = null;
            const roots = Array.from(pendingKeywordRoots);
            pendingKeywordRoots.clear();
            keywordScheduled = false;
            for (const item of roots) runKeywordFilter(item);
            releaseKeywordPendingWhenReady();
        }, KEYWORD_MUTATION_DEBOUNCE_MS);
    }

    function clearNavigationFilterTimers() {
        for (const timer of navigationFilterTimers) {
            try {
                cancelTimer(timer);
            } catch (_) {}
        }
        navigationFilterTimers = [];
    }

    function runNavigationRefresh() {
        clearQueuedKeywordFilter();
        invalidateNewsTabCache();
        if (IS_NEWS_HOST) scheduleCommentTabSync();
        if (!keywords.length) {
            clearKeywordElementState();
            refreshKeywordObservers();
            releaseKeywordPendingWhenReady();
            return;
        }
        keywordGeneration += 1;
        runKeywordFilter(document);
        refreshKeywordObservers();
        scheduleObserverRefresh();
        releaseKeywordPendingWhenReady();
    }

    function scheduleNavigationRefresh() {
        clearNavigationFilterTimers();
        if (keywords.length) beginKeywordPending();
        for (const delay of KEYWORD_NAVIGATION_RECHECK_DELAYS_MS) {
            navigationFilterTimers.push(scheduleTimer(runNavigationRefresh, delay));
        }
    }

    function queueNavigationRefresh() {
        if (navigationCheckTimer) return;
        navigationCheckTimer = scheduleTimer(() => {
            navigationCheckTimer = null;
            lastSeenUrl = location.href;
            scheduleNavigationRefresh();
        }, 0);
    }

    function installNavigationHooks() {
        try {
            const historyApi = window.history;
            if (historyApi) {
                for (const method of ["pushState", "replaceState"]) {
                    const original = historyApi[method];
                    if (typeof original !== "function") continue;
                    historyApi[method] = function () {
                        const result = original.apply(this, arguments);
                        if (lastSeenUrl !== location.href) queueNavigationRefresh();
                        return result;
                    };
                }
            }
        } catch (_) {}

        try {
            window.addEventListener("popstate", queueNavigationRefresh, true);
            window.addEventListener("hashchange", queueNavigationRefresh, true);
            window.addEventListener("pageshow", queueNavigationRefresh, true);
            document.addEventListener("click", (event) => {
                const target = getElementFromNode(event && event.target);
                if (!target || !target.closest) return;
                const link = target.closest("a[href]");
                if (!link) return;
                try {
                    const url = new URL(link.href, location.href);
                    if (!SUPPORTED_HOSTS.has(url.hostname)) return;
                    if (url.href === location.href) return;
                } catch (_) {
                    return;
                }
                queueNavigationRefresh();
            }, true);
            document.addEventListener("visibilitychange", () => {
                if (document.hidden) return;
                if (lastSeenUrl !== location.href) {
                    queueNavigationRefresh();
                    return;
                }
                if (IS_NEWS_HOST) scheduleCommentTabSync();
                if (keywords.length) scheduleKeywordFilter(document);
            }, true);
        } catch (_) {}
    }

    function installCommentPanelGuards() {
        const blockHiddenCommentClick = (event) => {
            const target = getElementFromNode(event && event.target);
            if (!target || !target.closest) return;
            try {
                if (!target.closest(COMMENT_PANEL_SELECTOR)) return;
            } catch (_) {
                return;
            }
            event.preventDefault();
            event.stopImmediatePropagation();
        };

        try {
            document.addEventListener("click", blockHiddenCommentClick, true);
            document.addEventListener("auxclick", blockHiddenCommentClick, true);
        } catch (_) {}
    }

    function getTabControlLabel(control) {
        if (!control || control.nodeType !== 1) return "";
        const label = control.getAttribute("aria-label") || control.textContent || "";
        return normalizeTabText(label);
    }

    function isLikelyNewsTabControl(control) {
        if (!control || control.nodeType !== 1) return false;
        try {
            if (control.matches("[role='tab']") || control.closest("[role='tablist']")) return true;
        } catch (_) {}

        const container = control.parentElement;
        if (!container) return false;
        const text = normalizeTabText(container.textContent || "");
        if (text.includes("主要") && text.includes("エンタメ")) return true;

        const grandparent = container.parentElement;
        const wideText = normalizeTabText(grandparent ? grandparent.textContent || "" : "");
        return wideText.includes("主要") && wideText.includes("エンタメ") && wideText.includes("ヤフコメ");
    }

    function tabStateNode(control) {
        let node = control;
        for (let depth = 0; node && node.nodeType === 1 && depth < 4; depth += 1) {
            const label = normalizeTabText(node.textContent || "");
            if (label.includes("主要") && label.includes("エンタメ")) {
                node = node.parentElement;
                continue;
            }
            try {
                if (
                    node.matches("[aria-selected='true'],[aria-current='page'],[aria-current='true'],[data-selected='true']")
                    || /\b(active|current|selected|is-active|is-current)\b/i.test(node.className || "")
                ) {
                    return node;
                }
            } catch (_) {}
            node = node.parentElement;
        }
        return null;
    }

    function isNewsSwipeArea(target) {
        if (!target || target.nodeType !== 1) return false;
        try {
            return Boolean(target.closest("#swipeFrame,[role='tablist'],#Topics,[id^='tab-panel-']"));
        } catch (_) {
            return false;
        }
    }

    function isCommentTabEventTarget(event) {
        const target = getElementFromNode(event && event.target);
        if (!target) return false;
        if (isNewsSwipeArea(target)) return true;
        try {
            return Boolean(target.closest("[role='tab'],[role='tablist']"));
        } catch (_) {
            return false;
        }
    }

    function invalidateNewsTabCache() {
        newsTabCache.clear();
        newsTabCacheExpiresAt = 0;
    }

    function getCachedNewsTab(expected) {
        if (!expected) return undefined;
        if (newsTabCacheExpiresAt && Date.now() > newsTabCacheExpiresAt) {
            invalidateNewsTabCache();
            return undefined;
        }
        if (!newsTabCache.has(expected)) return undefined;
        const cached = newsTabCache.get(expected);
        if (!cached) return null;
        if (isRootConnected(cached)) return cached;
        newsTabCache.delete(expected);
        return undefined;
    }

    function cacheNewsTab(expected, control) {
        if (!expected) return;
        newsTabCache.set(expected, control || null);
        newsTabCacheExpiresAt = Date.now() + NEWS_TAB_CACHE_MS;
    }

    function findCommentTabHideNode(control) {
        let node = control;
        let match = control;
        for (let depth = 0; node && node.nodeType === 1 && depth < 4; depth += 1) {
            const label = normalizeTabText(node.textContent || "");
            if (label && label.includes("ヤフコメ") && !label.includes("主要") && !label.includes("エンタメ")) {
                match = node;
            }
            node = node.parentElement;
        }
        return match;
    }

    function findNewsTab(label) {
        const expected = normalizeTabText(label);
        const cached = getCachedNewsTab(expected);
        if (cached !== undefined) return cached;

        const findInSelector = (selector) => {
            let candidates = null;
            try {
                candidates = document.querySelectorAll(selector);
            } catch (_) {}
            if (!candidates) return null;

            for (const control of candidates) {
                if (!control || control.nodeType !== 1) continue;
                const text = getTabControlLabel(control);
                if (!text || !text.includes(expected)) continue;
                if (!isLikelyNewsTabControl(control)) continue;
                return control;
            }
            return null;
        };

        let control = findInSelector(NEWS_TAB_SCAN_SELECTOR);
        if (!control) control = findInSelector(NEWS_TAB_FALLBACK_SELECTOR);
        cacheNewsTab(expected, control);
        return control;
    }

    function findTabHref(control) {
        if (!control || control.nodeType !== 1) return "";
        let link = null;
        try {
            link = control.matches("a[href]") ? control : control.querySelector("a[href]");
        } catch (_) {}
        if (!link) {
            try {
                link = control.closest("a[href]");
            } catch (_) {}
        }
        if (!link || !link.href) return "";
        try {
            const url = new URL(link.href, location.href);
            return SUPPORTED_HOSTS.has(url.hostname) ? url.href : "";
        } catch (_) {
            return "";
        }
    }

    function getSingleNewsTabLabel(text) {
        if (!text || text.includes("ヤフコメ")) return "";
        let matched = "";
        for (const label of NEWS_TAB_LABELS) {
            const expected = normalizeTabText(label);
            if (!expected || !text.includes(expected)) continue;
            if (matched) return "";
            matched = expected;
        }
        return matched;
    }

    function getNewsTabIntent(control) {
        if (!control || control.nodeType !== 1) return null;
        const label = getTabControlLabel(control);
        const matched = getSingleNewsTabLabel(label);
        if (!matched) return null;
        if (!isLikelyNewsTabControl(control)) {
            let parentControl = null;
            try {
                parentControl = control.closest("[role='tab'],a,button,li");
            } catch (_) {}
            if (!parentControl || !isLikelyNewsTabControl(parentControl)) return null;
        }
        if (matched === "主要") return { label: "主要", key: "major" };
        if (matched === "エンタメ") return { label: "エンタメ", key: "entertainment" };
        return { label: matched, key: matched };
    }

    function fallbackNewsTabHref(intent) {
        if (!intent || !intent.label) return "";
        const path = NEWS_TAB_PATHS[intent.label];
        if (!path) return "";
        try {
            return new URL(path, "https://news.yahoo.co.jp").href;
        } catch (_) {
            return "";
        }
    }

    function findNewsTabHref(control) {
        return findTabHref(control) || fallbackNewsTabHref(getNewsTabIntent(control));
    }

    function getEventPoint(event) {
        if (!event) return null;
        if (typeof event.clientX === "number" && typeof event.clientY === "number") {
            return { x: event.clientX, y: event.clientY };
        }
        const touch = event.changedTouches && event.changedTouches[0]
            ? event.changedTouches[0]
            : (event.touches && event.touches[0] ? event.touches[0] : null);
        if (touch && typeof touch.clientX === "number" && typeof touch.clientY === "number") {
            return { x: touch.clientX, y: touch.clientY };
        }
        return null;
    }

    function findNewsTabControlAtPoint(event) {
        const point = getEventPoint(event);
        if (!point) return null;
        const seen = new Set();
        const inspect = (node) => {
            let current = node;
            for (let depth = 0; current && current.nodeType === 1 && depth < 6; depth += 1) {
                if (seen.has(current)) return null;
                seen.add(current);
                if (getNewsTabIntent(current)) return current;
                current = current.parentElement;
            }
            return null;
        };

        try {
            const pointed = document.elementsFromPoint(point.x, point.y);
            for (const node of pointed) {
                const match = inspect(node);
                if (match) return match;
            }
        } catch (_) {}

        const findByRect = (selector, limit) => {
            let candidates = null;
            try {
                candidates = document.querySelectorAll(selector);
            } catch (_) {}
            if (!candidates) return null;

            let checked = 0;
            for (const control of candidates) {
                checked += 1;
                if (limit && checked > limit) break;
                if (!getNewsTabIntent(control)) continue;
                let rect = null;
                try {
                    rect = control.getBoundingClientRect();
                } catch (_) {}
                if (
                    rect
                    && point.x >= rect.left
                    && point.x <= rect.right
                    && point.y >= rect.top
                    && point.y <= rect.bottom
                ) {
                    return control;
                }
            }
            return null;
        };

        return findByRect(NEWS_TAB_SCAN_SELECTOR)
            || findByRect(NEWS_TAB_FALLBACK_SELECTOR, NEWS_TAB_POINT_SCAN_LIMIT);
    }

    function findNewsTabControlFromTarget(event) {
        const target = getElementFromNode(event && event.target);
        if (!target) return null;

        let node = target;
        for (let depth = 0; node && node.nodeType === 1 && depth < 6; depth += 1) {
            if (getNewsTabIntent(node)) return node;
            node = node.parentElement;
        }

        try {
            return target.closest("[role='tab'],a,button,li");
        } catch (_) {
            return null;
        }
    }

    function findEventNewsTabControl(event) {
        const targetControl = findNewsTabControlFromTarget(event);
        if (targetControl && getNewsTabIntent(targetControl)) return targetControl;

        const pointedControl = findNewsTabControlAtPoint(event);
        if (pointedControl) return pointedControl;

        return targetControl;
    }

    function findSelectedNewsTabLabel() {
        const pairs = [
            ["comment", "ヤフコメ"],
            ["major", "主要"],
            ["entertainment", "エンタメ"],
        ];
        for (const pair of pairs) {
            const control = findNewsTab(pair[1]);
            if (control && tabStateNode(control)) return pair[0];
        }
        return "";
    }

    function isCommentPanelCentered() {
        let panel = null;
        try {
            panel = document.querySelector(COMMENT_PANEL_SELECTOR);
        } catch (_) {}
        if (!panel) return false;
        let rect = null;
        try {
            rect = panel.getBoundingClientRect();
        } catch (_) {}
        if (!rect || rect.width < 20 || rect.height < 20) return false;

        const width = window.innerWidth || document.documentElement.clientWidth || 0;
        const height = window.innerHeight || document.documentElement.clientHeight || 0;
        if (!width || !height) return false;
        return rect.left < width * 0.55
            && rect.right > width * 0.45
            && rect.top < height - 80
            && rect.bottom > 80;
    }

    function clickNewsTab(label) {
        const control = findNewsTab(label);
        if (!control) return false;
        if (getNewsTabIntent(control) && navigateToNewsTabHref(control)) {
            return true;
        }
        let clickTarget = control;
        try {
            if (!control.matches("a,button,[role='tab']")) {
                clickTarget = control.querySelector("a,button,[role='tab']") || control;
            }
        } catch (_) {}
        try {
            clickTarget.click();
            return true;
        } catch (_) {
            return false;
        }
    }

    function navigateToNewsTabHref(control) {
        const href = findNewsTabHref(control);
        if (href) commentRecoveryHref = href;
        if (!href || href === location.href) return false;
        try {
            location.assign(href);
            return true;
        } catch (_) {
            return false;
        }
    }

    function isActuallyVisible(node) {
        if (!node || node.nodeType !== 1) return false;
        let rect = null;
        try {
            rect = node.getBoundingClientRect();
        } catch (_) {}
        if (!rect || rect.width < 20 || rect.height < 20) return false;
        const height = window.innerHeight || document.documentElement.clientHeight || 0;
        if (height && (rect.bottom < 120 || rect.top > height - 80)) return false;

        let current = node;
        for (let depth = 0; current && current.nodeType === 1 && depth < 8; depth += 1) {
            let style = null;
            try {
                style = window.getComputedStyle(current);
            } catch (_) {}
            if (style) {
                if (style.display === "none" || style.visibility === "hidden") return false;
                if (Number(style.opacity) === 0) return false;
            }
            current = current.parentElement;
        }
        return true;
    }

    function hasVisibleNewsContent() {
        let nodes = null;
        try {
            nodes = document.querySelectorAll([
                "#newsFeed [data-ual-view-type='list']",
                "#newsFeed li",
                "#Topics article",
                "[id^='tab-panel-'] [data-ual-view-type='list']",
                "[id^='tab-panel-'] article",
                "[id^='tab-panel-'] li",
                "#topicsList article",
                "#topicsList li",
                "a[href*='/articles/']",
                "a[href*='/pickup/']",
            ].join(","));
        } catch (_) {}
        if (!nodes) return false;
        for (const node of nodes) {
            if (isActuallyVisible(node)) return true;
        }
        return false;
    }

    function hasKeywordFilteredNewsContent() {
        let nodes = null;
        try {
            nodes = document.querySelectorAll(
                "[" + KEYWORD_HIDE_ATTR + "='true'],." + KEYWORD_HIDE_CLASS
            );
        } catch (_) {}
        if (!nodes) return false;
        for (const node of nodes) {
            if (!node || node.nodeType !== 1) continue;
            try {
                if (node.matches(KEYWORD_CARD_SELECTOR)) return true;
            } catch (_) {}
            try {
                if (node.querySelector(KEYWORD_ARTICLE_LINK_SELECTOR)) return true;
            } catch (_) {}
        }
        return false;
    }

    function hasRecoverableNewsContent() {
        return hasVisibleNewsContent() || hasKeywordFilteredNewsContent();
    }

    function runBlankNewsTabRecovery(hrefOverride) {
        if (document.hidden) return;
        const selected = findSelectedNewsTabLabel();
        if (!selected && !commentRedirectTarget && !commentRecoveryHref && !hrefOverride) return;

        const recoveryKey = COMMENT_TAB_RECOVERY_STORAGE_PREFIX
            + location.href
            + ":"
            + (selected || commentRedirectTarget || hrefOverride || "unknown");
        try {
            const now = Date.now();
            const lastRecovery = Number(sessionStorage.getItem(recoveryKey) || 0);
            if (lastRecovery && now - lastRecovery < COMMENT_TAB_RECOVERY_COOLDOWN_MS) {
                if (!commentBlankRecoveryTimer) {
                    commentBlankRecoveryTimer = scheduleTimer(
                        recoverBlankNewsTab,
                        COMMENT_TAB_RECOVERY_COOLDOWN_MS - (now - lastRecovery) + 100
                    );
                }
                return;
            }
            sessionStorage.setItem(recoveryKey, String(now));
        } catch (_) {}

        const href = hrefOverride || commentRecoveryHref;
        commentRecoveryHref = "";
        if (!commentRecoveryBudget.consume()) return;
        try {
            if (href && href !== location.href) {
                location.assign(href);
            } else {
                location.reload();
            }
        } catch (_) {}
    }

    function confirmBlankNewsTabRecovery(hrefOverride) {
        if (document.hidden) return;
        if (commentBlankRecoveryTimer) {
            try {
                cancelTimer(commentBlankRecoveryTimer);
            } catch (_) {}
            commentBlankRecoveryTimer = null;
        }
        if (isKeywordFilterPending()) {
            if (commentBlankConfirmTimer) cancelTimer(commentBlankConfirmTimer);
            commentBlankConfirmTimer = scheduleTimer(() => {
                commentBlankConfirmTimer = null;
                confirmBlankNewsTabRecovery(hrefOverride);
            }, KEYWORD_PENDING_RELEASE_DELAY_MS + 100);
            return;
        }
        if (hasRecoverableNewsContent()) {
            commentRecoveryHref = "";
            return;
        }
        if (commentBlankConfirmTimer) cancelTimer(commentBlankConfirmTimer);
        commentBlankConfirmTimer = scheduleTimer(() => {
            commentBlankConfirmTimer = null;
            if (hasRecoverableNewsContent()) {
                commentRecoveryHref = "";
                return;
            }
            runBlankNewsTabRecovery(hrefOverride);
        }, COMMENT_TAB_BLANK_CONFIRM_MS);
    }

    function recoverBlankNewsTab() {
        commentBlankRecoveryTimer = null;
        confirmBlankNewsTabRecovery();
    }

    function scheduleCommentBlankRecovery() {
        if (commentBlankRecoveryTimer) cancelTimer(commentBlankRecoveryTimer);
        commentBlankRecoveryTimer = scheduleTimer(recoverBlankNewsTab, COMMENT_TAB_BLANK_RECOVERY_MS);
    }

    function clearCommentBlankRecovery() {
        if (commentBlankRecoveryTimer) {
            try {
                cancelTimer(commentBlankRecoveryTimer);
            } catch (_) {}
            commentBlankRecoveryTimer = null;
        }
        if (commentBlankConfirmTimer) {
            try {
                cancelTimer(commentBlankConfirmTimer);
            } catch (_) {}
            commentBlankConfirmTimer = null;
        }
    }

    function clearForcedNewsTabLoad() {
        if (!commentForceLoadTimer) return;
        try {
            cancelTimer(commentForceLoadTimer);
        } catch (_) {}
        commentForceLoadTimer = null;
    }

    function scheduleForcedNewsTabLoad(control) {
        const href = findNewsTabHref(control);
        if (href) commentRecoveryHref = href;
        if (commentForceLoadTimer) cancelTimer(commentForceLoadTimer);
        clearCommentBlankRecovery();
        commentForceLoadTimer = scheduleTimer(() => {
            commentForceLoadTimer = null;
            if (hasRecoverableNewsContent()) {
                clearCommentBlankRecovery();
                commentRecoveryHref = "";
                return;
            }
            const hrefToLoad = href || commentRecoveryHref;
            confirmBlankNewsTabRecovery(hrefToLoad);
        }, COMMENT_TAB_FORCE_LOAD_MS);
    }

    function clearCommentTabSkipTimers() {
        for (const timer of commentTabSkipTimers) {
            try {
                cancelTimer(timer);
            } catch (_) {}
        }
        commentTabSkipTimers = [];
    }

    function scheduleCommentTabRedirect(selected, commentCentered) {
        const centered = typeof commentCentered === "boolean" ? commentCentered : isCommentPanelCentered();
        if (selected !== "comment" && !centered) {
            clearCommentTabSkipTimers();
            commentRedirectTarget = "";
            return false;
        }
        if (commentTabSkipTimers.length) return true;

        const nextTab = commentRedirectTarget || (lastNonCommentTab === "entertainment" ? "主要" : "エンタメ");
        for (const delay of COMMENT_TAB_REDIRECT_DELAYS_MS) {
            const timer = scheduleTimer(() => {
                commentTabSkipTimers = commentTabSkipTimers.filter((item) => item !== timer);
                if (findSelectedNewsTabLabel() !== "comment" && !isCommentPanelCentered()) {
                    clearCommentTabSkipTimers();
                    commentRedirectTarget = "";
                    return;
                }
                const nextControl = findNewsTab(nextTab);
                clickNewsTab(nextTab);
                if (nextTab === "主要") lastNonCommentTab = "major";
                if (nextTab === "エンタメ") lastNonCommentTab = "entertainment";
                commentRedirectTarget = "";
                scheduleForcedNewsTabLoad(nextControl);
                scheduleCommentTabSync();
            }, delay);
            commentTabSkipTimers.push(timer);
        }
        return true;
    }

    function syncCommentTabState() {
        const commentTab = findNewsTab("ヤフコメ");
        if (commentTab) {
            const hideNode = findCommentTabHideNode(commentTab);
            try {
                hideNode.classList.add(COMMENT_TAB_HIDDEN_CLASS);
                hideNode.setAttribute("aria-hidden", "true");
                hideNode.setAttribute("tabindex", "-1");
            } catch (_) {}
        }

        const selected = findSelectedNewsTabLabel();
        const commentCentered = isCommentPanelCentered();
        if (selected && selected !== "comment" && !commentCentered) {
            lastNonCommentTab = selected;
            clearCommentTabSkipTimers();
            commentRedirectTarget = "";
            return;
        }
        scheduleCommentTabRedirect(selected, commentCentered);
    }

    function scheduleCommentTabSync() {
        if (commentTabSyncTimer) return;
        commentTabSyncTimer = scheduleTimer(() => {
            commentTabSyncTimer = null;
            syncCommentTabState();
        }, COMMENT_TAB_SYNC_DELAY_MS);
    }

    function rememberNewsTabFromEvent(event) {
        const control = findEventNewsTabControl(event);
        if (!control) return false;
        const intent = getNewsTabIntent(control);
        if (!intent) return false;
        const commentCentered = isCommentPanelCentered();
        const selected = findSelectedNewsTabLabel();
        const wasSelected = Boolean(tabStateNode(control)) && !commentCentered;
        const needsCommentEscape = selected === "comment" || commentCentered;
        commentRedirectTarget = intent.label;
        commentRecoveryHref = findNewsTabHref(control);
        if (!commentCentered && (intent.key === "major" || intent.key === "entertainment")) {
            lastNonCommentTab = intent.key;
        }
        if (navigateToNewsTabHref(control)) {
            clearForcedNewsTabLoad();
            clearCommentBlankRecovery();
            try {
                event.preventDefault();
                event.stopImmediatePropagation();
            } catch (_) {}
            return true;
        }
        if (!needsCommentEscape) {
            clearForcedNewsTabLoad();
            if (wasSelected) {
                clearCommentBlankRecovery();
            } else {
                scheduleCommentBlankRecovery();
            }
        }
        if (!wasSelected && needsCommentEscape) {
            scheduleForcedNewsTabLoad(control);
            scheduleCommentBlankRecovery();
        }
        return false;
    }

    function rememberCommentSwipeStart(event) {
        const touch = event && event.touches && event.touches[0];
        if (!touch) return;
        const target = getElementFromNode(event && event.target);
        if (!isNewsSwipeArea(target)) return;
        commentSwipeStartX = touch.clientX;
        commentSwipeStartY = touch.clientY;
    }

    function rememberCommentSwipeEnd(event) {
        const touch = event && event.changedTouches && event.changedTouches[0];
        if (!touch || commentSwipeStartX === null || commentSwipeStartY === null) return;
        const deltaX = touch.clientX - commentSwipeStartX;
        const deltaY = touch.clientY - commentSwipeStartY;
        commentSwipeStartX = null;
        commentSwipeStartY = null;
        if (Math.abs(deltaX) < COMMENT_TAB_SWIPE_MIN_X || Math.abs(deltaY) > COMMENT_TAB_SWIPE_MAX_Y) return;
        commentRedirectTarget = deltaX < 0 ? "エンタメ" : "主要";
        const control = findNewsTab(commentRedirectTarget);
        commentRecoveryHref = findNewsTabHref(control);
    }

    function getElementFromNode(node) {
        return node && node.nodeType === 1
            ? node
            : (node && node.parentElement ? node.parentElement : null);
    }

    function isCommentTabMutationElement(node) {
        const element = getElementFromNode(node);
        if (!element) return false;
        try {
            if (element.matches(COMMENT_TAB_MUTATION_NODE_SELECTOR)) return true;
            return Boolean(element.closest("[role='tablist'],[role='tab']"));
        } catch (_) {
            return false;
        }
    }

    function containsCommentTabMutationElement(node) {
        const element = getElementFromNode(node);
        if (!element) return false;
        if (isCommentTabMutationElement(element)) return true;
        try {
            if (element.querySelector(COMMENT_TAB_MUTATION_NODE_SELECTOR)) return true;
        } catch (_) {
            return false;
        }
        if (element.childElementCount > 30) return false;
        const text = normalizeTabText((element.textContent || "").slice(0, 600));
        return text.includes("主要") && text.includes("エンタメ") && text.includes("ヤフコメ");
    }

    function isCommentTabMutationRelevant(mutation) {
        if (!mutation) return false;
        const target = getElementFromNode(mutation.target);
        if (!target) return false;

        if (mutation.type === "attributes") {
            return isCommentTabMutationElement(target);
        }

        if (mutation.type !== "childList") return false;
        try {
            if (target.matches(COMMENT_TAB_MUTATION_ROOT_SELECTOR)) return true;
        } catch (_) {}

        for (const node of mutation.addedNodes || []) {
            if (containsCommentTabMutationElement(node)) return true;
        }
        for (const node of mutation.removedNodes || []) {
            if (containsCommentTabMutationElement(node)) return true;
        }
        return false;
    }

    function scheduleCommentTabSyncFromMutations(mutations) {
        for (const mutation of mutations) {
            if (!isCommentTabMutationRelevant(mutation)) continue;
            invalidateNewsTabCache();
            scheduleCommentTabSync();
            return;
        }
    }

    function stopCommentTabRootObservers() {
        for (const item of commentTabRootObservers) {
            forgetObserver(item);
            try {
                item.disconnect();
            } catch (_) {}
        }
        commentTabRootObservers = [];
    }

    function scheduleCommentTabObserverRefresh() {
        if (commentTabObserverRefreshTimer) return;
        commentTabObserverRefreshTimer = scheduleTimer(() => {
            commentTabObserverRefreshTimer = null;
            refreshCommentTabObservers();
        }, COMMENT_TAB_OBSERVER_REFRESH_DELAY_MS);
    }

    function findCommentTabObserverRoots() {
        const roots = [];
        const seen = new Set();
        let nodes = null;
        try {
            nodes = document.querySelectorAll(COMMENT_TAB_MUTATION_ROOT_SELECTOR);
        } catch (_) {}
        if (!nodes) return roots;
        for (const node of nodes) {
            if (!node || node.nodeType !== 1 || seen.has(node)) continue;
            seen.add(node);
            roots.push(node);
        }
        return roots;
    }

    function refreshCommentTabObservers() {
        stopCommentTabRootObservers();
        if (!IS_NEWS_HOST) return;
        for (const root of findCommentTabObserverRoots()) {
            try {
                const observer = trackObserver(new MutationObserver(scheduleCommentTabSyncFromMutations));
                observer.observe(root, {
                    attributes: true,
                    attributeFilter: ["class", "aria-selected", "aria-current", "data-selected", "hidden", "style"],
                    childList: true,
                    subtree: true,
                });
                commentTabRootObservers.push(observer);
            } catch (_) {}
        }
    }

    function scheduleCommentTabSyncAndObserverRefresh(mutations) {
        let relevant = false;
        for (const mutation of mutations) {
            if (mutation.type !== "childList") continue;
            const nodes = Array.from(mutation.addedNodes || []).concat(Array.from(mutation.removedNodes || []));
            for (const node of nodes) {
                if (!containsCommentTabMutationElement(node)) continue;
                relevant = true;
                break;
            }
            if (relevant) break;
        }
        if (!relevant) return;
        invalidateNewsTabCache();
        scheduleCommentTabSync();
        scheduleCommentTabObserverRefresh();
    }

    function installCommentTabControls() {
        if (!IS_NEWS_HOST) return;
        syncCommentTabState();
        try {
            document.addEventListener("click", (event) => {
                if (!isCommentTabEventTarget(event)) return;
                if (rememberNewsTabFromEvent(event)) return;
                scheduleCommentTabSync();
            }, true);
            document.addEventListener("touchstart", (event) => {
                if (isCommentTabEventTarget(event)) rememberCommentSwipeStart(event);
            }, { capture: true, passive: true });
            document.addEventListener("touchend", (event) => {
                if (!isCommentTabEventTarget(event) && commentSwipeStartX === null) return;
                if (rememberNewsTabFromEvent(event)) return;
                rememberCommentSwipeEnd(event);
                scheduleCommentTabSync();
            }, true);
            document.addEventListener("pointerup", (event) => {
                const target = getElementFromNode(event && event.target);
                if (isNewsSwipeArea(target)) scheduleCommentTabSync();
            }, { capture: true, passive: true });
        } catch (_) {}

        if (commentTabObserver || !document.documentElement) return;
        try {
            commentTabObserver = trackObserver(new MutationObserver(scheduleCommentTabSyncAndObserverRefresh));
            commentTabObserver.observe(document.documentElement, {
                childList: true,
                subtree: true,
            });
            refreshCommentTabObservers();
        } catch (_) {
            commentTabObserver = null;
            stopCommentTabRootObservers();
        }
    }

    function stopScopeObservers() {
        for (const item of keywordObservers) {
            forgetObserver(item);
            try {
                item.disconnect();
            } catch (_) {}
        }
        keywordObservers = [];
    }

    function stopDocumentObserver() {
        if (!keywordDocumentObserver) return;
        forgetObserver(keywordDocumentObserver);
        try {
            keywordDocumentObserver.disconnect();
        } catch (_) {}
        keywordDocumentObserver = null;
    }

    function clearObserverRefreshTimer() {
        if (!observerRefreshTimer) return;
        cancelTimer(observerRefreshTimer);
        observerRefreshTimer = null;
    }

    function clearCommentTabSyncTimer() {
        if (!commentTabSyncTimer) return;
        cancelTimer(commentTabSyncTimer);
        commentTabSyncTimer = null;
    }

    function clearCommentTabObserverRefreshTimer() {
        if (!commentTabObserverRefreshTimer) return;
        cancelTimer(commentTabObserverRefreshTimer);
        commentTabObserverRefreshTimer = null;
    }

    function clearScheduledWork() {
        clearQueuedKeywordFilter();
        clearNavigationFilterTimers();
        clearObserverRefreshTimer();
        if (keywordPendingTimer) {
            cancelTimer(keywordPendingTimer);
            keywordPendingTimer = null;
        }
        if (keywordPendingReleaseTimer) {
            cancelTimer(keywordPendingReleaseTimer);
            keywordPendingReleaseTimer = null;
        }
        clearCommentBlankRecovery();
        clearForcedNewsTabLoad();
        clearCommentTabSkipTimers();
        clearCommentTabSyncTimer();
        clearCommentTabObserverRefreshTimer();
    }

    function stopCommentTabObserver() {
        if (!commentTabObserver) return;
        forgetObserver(commentTabObserver);
        try {
            commentTabObserver.disconnect();
        } catch (_) {}
        commentTabObserver = null;
    }

    function disposeContentScript() {
        clearScheduledWork();
        stopScopeObservers();
        stopDocumentObserver();
        stopCommentTabRootObservers();
        stopCommentTabObserver();
        if (lifecycle && typeof lifecycle.dispose === "function") {
            lifecycle.dispose();
        }
    }

    function handleVisibilityChange() {
        if (document.hidden) {
            clearScheduledWork();
            return;
        }
        if (lifecycle && typeof lifecycle.isDisposed === "function" && lifecycle.isDisposed()) return;
        if (keywords.length) beginKeywordPending();
        runNavigationRefresh();
    }

    function handlePageHide(event) {
        if (event && event.persisted) {
            clearScheduledWork();
            return;
        }
        disposeContentScript();
    }

    function installLifecycleCleanup() {
        try {
            document.addEventListener("visibilitychange", handleVisibilityChange, true);
            window.addEventListener("pagehide", handlePageHide, true);
            window.addEventListener("beforeunload", clearScheduledWork, true);
        } catch (_) {}
    }

    function scheduleObserverRefresh() {
        if (!keywords.length || observerRefreshTimer) return;
        observerRefreshTimer = scheduleTimer(() => {
            observerRefreshTimer = null;
            refreshKeywordObservers();
            scheduleKeywordFilter(document);
        }, KEYWORD_REFRESH_DELAY_MS);
    }

    function refreshKeywordObservers() {
        stopScopeObservers();
        if (!keywords.length) {
            stopDocumentObserver();
            clearObserverRefreshTimer();
            return;
        }

        startDocumentObserver();

        const scopes = findKeywordScopes(document);
        for (const scope of scopes) {
            try {
                const item = trackObserver(new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        if (mutation.type === "characterData") {
                            markKeywordSubtreeUnchecked(mutation.target);
                            scheduleKeywordFilter(findKeywordMutationRoot(mutation.target));
                        } else if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
                            for (const node of mutation.addedNodes) {
                                markKeywordSubtreeUnchecked(node);
                                scheduleKeywordFilter(findKeywordMutationRoot(node));
                            }
                        }
                    }
                }));
                item.observe(scope, { childList: true, characterData: true, subtree: true });
                keywordObservers.push(item);
            } catch (_) {}
        }
    }

    function startDocumentObserver() {
        if (keywordDocumentObserver || !document.documentElement) return;
        try {
            keywordDocumentObserver = trackObserver(new MutationObserver((mutations) => {
                let shouldRefreshObservers = false;
                for (const mutation of mutations) {
                    if (mutation.type !== "childList" || mutation.addedNodes.length < 1) continue;
                    for (const node of mutation.addedNodes) {
                        if (!node || node.nodeType !== 1) continue;
                        if (!shouldRefreshObservers && containsKeywordScope(node)) {
                            shouldRefreshObservers = true;
                        }
                        if (!isKeywordMutationCandidate(node)) continue;
                        markKeywordSubtreeUnchecked(node);
                        scheduleKeywordFilter(findKeywordMutationRoot(node));
                    }
                }
                if (shouldRefreshObservers) scheduleObserverRefresh();
            }));
            keywordDocumentObserver.observe(document.documentElement, {
                childList: true,
                subtree: true,
            });
        } catch (_) {
            keywordDocumentObserver = null;
        }
    }

    function init() {
        syncPlatformClass();
        installLifecycleCleanup();
        beginKeywordPending();
        loadKeywords();
        watchKeywordChanges();
        installNavigationHooks();
        if (IS_NEWS_HOST) {
            installCommentPanelGuards();
            installCommentTabControls();
        }

        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", () => {
                if (IS_NEWS_HOST) {
                    syncCommentTabState();
                    refreshCommentTabObservers();
                }
                runKeywordFilter(document);
                refreshKeywordObservers();
                scheduleObserverRefresh();
                releaseKeywordPendingWhenReady();
            }, { once: true });
        }
    }

    function loadKeywords() {
        const query = {};
        query[KEYWORD_STORAGE_KEY] = [];
        const requested = storageGet(query, (stored) => {
            ingestKeywords(stored[KEYWORD_STORAGE_KEY]);
            keywordsLoaded = true;
            clearQueuedKeywordFilter();
            runKeywordFilter(document);
            refreshKeywordObservers();
            scheduleObserverRefresh();
            releaseKeywordPendingWhenReady();
        });
        if (!requested) {
            ingestKeywords([]);
            keywordsLoaded = true;
            clearQueuedKeywordFilter();
            runKeywordFilter(document);
            refreshKeywordObservers();
            releaseKeywordPendingWhenReady();
        }
    }

    function watchKeywordChanges() {
        try {
            if (!extensionApi || !extensionApi.storage || !extensionApi.storage.onChanged) return;
            extensionApi.storage.onChanged.addListener((changes, area) => {
                if (area !== "local" || !changes || !changes[KEYWORD_STORAGE_KEY]) return;
                ingestKeywords(changes[KEYWORD_STORAGE_KEY].newValue);
                keywordsLoaded = true;
                clearQueuedKeywordFilter();
                runKeywordFilter(document);
                refreshKeywordObservers();
                scheduleObserverRefresh();
                releaseKeywordPendingWhenReady();
            });
        } catch (_) {}
    }

    init();
})();
