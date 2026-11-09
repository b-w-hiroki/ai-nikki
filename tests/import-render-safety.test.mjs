import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const src=readFileSync('js/app.js','utf8');
const marker="function escapeHtml(s) {";
const start=src.indexOf(marker);
const end=src.indexOf("\n}",start)+2;
const escape=runInNewContext(src.slice(start,end)+';escapeHtml');
test('production escape keeps hostile imported values as text',()=>{
 const value="\"<img src=x onerror=alert(1)>'&";
 const safe=escape(value); assert.ok(!/[<>"']/.test(safe)); assert.ok(safe.includes('&lt;'));
});
test('boundary 1 stays escaped',()=>assert.ok(src.includes("${escapeHtml(c.icon)}")));
test('boundary 2 stays escaped',()=>assert.ok(src.includes("${escapeHtml(c.key)}")));
test('boundary 3 stays escaped',()=>assert.ok(src.includes("${escapeHtml(r.dateStr)}")));
test('boundary 4 stays escaped',()=>assert.ok(src.includes("${escapeHtml(goals[cat.key] || '')}")));
test('toast never parses imported text as HTML',()=>{assert.ok(src.includes('toast.textContent = msg;'));assert.ok(!src.includes('toast.innerHTML = msg;'))});
