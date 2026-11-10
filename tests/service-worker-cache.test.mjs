import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

test('updating photos only retires this app caches, preserving sister apps', async () => {
  const handlers = {}, deleted = [];
  const self = {
    addEventListener: (name, fn) => { handlers[name] = fn; },
    clients: { claim() {} }, skipWaiting() {},
  };
  const caches = {
    keys: async () => ['ai-nikki-v1', 'ai-nikki-v2', 'ai-nikki-v3', 'osanpo-bingo-v163', 'unrelated'],
    delete: async key => { deleted.push(key); return true; },
  };
  runInNewContext(readFileSync('service-worker.js', 'utf8'), { self, caches });
  let work;
  handlers.activate({ waitUntil: promise => { work = promise; } });
  await work;
  assert.deepEqual(deleted, ['ai-nikki-v1', 'ai-nikki-v2']);
});
