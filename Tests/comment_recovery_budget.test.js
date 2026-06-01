const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "Extension/Resources/comment_recovery_budget.js"), "utf8");
const context = { globalThis: {} };
context.globalThis = context;
vm.createContext(context);
vm.runInContext(source, context, { filename: "comment_recovery_budget.js" });

const storage = new Map();
const budget = context.YNCHCommentRecoveryBudget.create({
  key: "recovery-count",
  max: 1,
  storage: {
    getItem(key) {
      return storage.has(key) ? storage.get(key) : null;
    },
    setItem(key, value) {
      storage.set(key, value);
    }
  }
});

assert.strictEqual(budget.consume(), true);
assert.strictEqual(budget.consume(), false);
assert.strictEqual(storage.get("recovery-count"), "1");

console.log("comment_recovery_budget.test.js passed");
