const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "Extension/Resources/keyword_utils.js"), "utf8");
const matcherSource = fs.readFileSync(path.join(root, "Extension/Resources/keyword_matcher.js"), "utf8");
const context = { globalThis: {} };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "keyword_utils.js" });
vm.runInContext(matcherSource, context, { filename: "keyword_matcher.js" });

const utils = context.YNCHKeywordUtils;
assert(utils, "YNCHKeywordUtils should be exposed");
assert.strictEqual(utils.normalizeKeyword("  ＡＢＣ　ニュース  "), "abc ニュース");
assert.strictEqual(utils.normalizeKeyword(null), "");
assert.strictEqual(utils.displayKeyword("  a   b　c  ", 40), "a b c");
assert.strictEqual(utils.displayKeyword("123456", 4), "1234");

const matcherApi = context.YNCHKeywordMatcher;
assert(matcherApi, "YNCHKeywordMatcher should be exposed");
const matcher = matcherApi.create(["a+b", "ニュース", "ニュース"]);
assert.strictEqual(matcher.size, 2);
assert.strictEqual(matcher.matches("今日はa+bの話題"), true);
assert.strictEqual(matcher.matches("abc ニュース"), true);
assert.strictEqual(matcher.matches("abc news"), false);

console.log("keyword_utils.test.js passed");
