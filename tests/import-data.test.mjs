import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';
const src=readFileSync('js/dataio.js','utf8').replace(/^import .*$/m,'').replace('export { DataIO };','');
function setup(failAt=0){const data=new Map([['ai-nikki-goals','{"reading":3}'],['ai-nikki-settings','{"theme":"paper"}']]);let writes=0;const localStorage={getItem:k=>data.get(k)??null,setItem(k,v){if(++writes===failAt)throw Error('quota');data.set(k,v)},removeItem:k=>data.delete(k)};return {data,io:runInNewContext(src+';DataIO',{localStorage})}}
const packet=data=>JSON.stringify({app:'ai-nikki',version:1,data});
test('valid legacy stats fill missing fields',()=>{const {data,io}=setup();assert.equal(io.importFromText(packet({'ai-nikki-stats':{exp:5}})).ok,true);assert.equal(JSON.parse(data.get('ai-nikki-stats')).streak.current,0)});
test('null and malformed types cause no writes',()=>{for(const bad of [null,[],{'ai-nikki-goals':{reading:'<img>'}},{'ai-nikki-stats':{level:0}},{'ai-nikki-stats':{exp:1e100}}]){const {data,io}=setup();const before=[...data];assert.equal(io.importFromText(packet(bad)).ok,false);assert.deepEqual([...data],before)}});
test('partial storage failure rolls all touched keys back',()=>{const {data,io}=setup(2);const before=[...data];assert.equal(io.importFromText(packet({'ai-nikki-goals':{reading:8},'ai-nikki-settings':{theme:'night'}})).ok,false);assert.deepEqual([...data],before)});
test('unknown fields do not authorize storage keys',()=>{const {data,io}=setup();assert.equal(io.importFromText(packet({'other':{}})).ok,false);assert.equal(data.has('other'),false)});
test('zero/stale EXP threshold is derived and huge EXP rejected',()=>{const {data,io}=setup();assert.equal(io.importFromText(packet({'ai-nikki-stats':{level:4,exp:100,expToNext:0}})).ok,true);assert.equal(JSON.parse(data.get('ai-nikki-stats')).expToNext,800);assert.equal(io.importFromText(packet({'ai-nikki-stats':{level:1,exp:1e100}})).ok,false)});
test('maximum accepted imported EXP has a bounded level-up loop',()=>{const {data,io}=setup();assert.equal(io.importFromText(packet({'ai-nikki-stats':{level:1,exp:1e7}})).ok,true);const stats=JSON.parse(data.get('ai-nikki-stats'));let steps=0;while(stats.exp>=stats.level*200){stats.exp-=stats.level*200;stats.level++;steps++;assert.ok(steps<400)}});
test('rollback failure exposes original full backup and refuses a second import',()=>{
 const original=new Map([['ai-nikki-goals','{"reading":3}'],['ai-nikki-settings','{"theme":"paper"}']]);const data=new Map(original);let writes=0;
 const localStorage={getItem:k=>data.get(k)??null,setItem(k,v){if(++writes>=2)throw Error('blocked');data.set(k,v)},removeItem:k=>data.delete(k)};
 const io=runInNewContext(src+';DataIO',{localStorage});
 assert.equal(io.importFromText(packet({'ai-nikki-settings':{theme:'night'},'ai-nikki-goals':{reading:8}})).ok,false);
 const backup=io.buildBackup();assert.equal(backup.data['ai-nikki-settings'].theme,'paper');assert.equal(backup.data['ai-nikki-goals'].reading,3);
 assert.equal(io.importFromText(packet({'ai-nikki-goals':{reading:99}})).ok,false);
});
