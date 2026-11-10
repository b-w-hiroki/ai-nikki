import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import assert from 'node:assert/strict';
import test from 'node:test';

function cloud() {
  const values=new Map(); let loads=0; const writes=[];
  const payload={app:'ai-nikki',data:{'ai-nikki-entries':{'2026-01-01':{text:'synthetic'}}}};
  const client={auth:{getUser:async()=>({data:{user:{id:'fake-user'}}})},from:table=>({upsert:async value=>{writes.push({table,value});return {};}})};
  const context={localStorage:{getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)},window:{supabase:{createClient:()=>{loads++;return client;}}},DataIO:{buildBackup:()=>payload}};
  runInNewContext(readFileSync('js/cloud.js','utf8').replace(/import .*?;\n/,'').replace('export { Cloud };','globalThis.Cloud=Cloud;'),context);
  return {api:context.Cloud,writes,payload,loads:()=>loads};
}
test('unconfigured cloud performs no SDK/client/auth/data work',async()=>{
  const c=cloud();assert.equal(await c.api.getClient(),null);assert.equal(await c.api.getUser(),null);assert.equal((await c.api.push()).ok,false);assert.equal(c.loads(),0);assert.equal(c.writes.length,0);
});
test('configuration and user lookup do not upload; explicit push sends backup only',async()=>{
  const c=cloud();c.api.setConfig('https://example.invalid','fake-public-key');assert.equal(c.writes.length,0);await c.api.getUser();assert.equal(c.writes.length,0);
  assert.equal((await c.api.push()).ok,true);assert.equal(c.writes.length,1);assert.equal(c.writes[0].table,'backups');assert.equal(c.writes[0].value.data,c.payload);
});
function ai(window={}){const c={window};runInNewContext(readFileSync('js/ai.js','utf8').replace('export { AI, SYSTEM_PROMPT };','globalThis.AI=AI;'),c);return c.AI;}
test('unsupported built-in AI falls back without creating a session',async()=>{
  const a=ai();assert.equal(await a.availability(),'no-api');assert.equal(await a.prompt('synthetic'),null);
});
test('supported built-in AI uses browser factory and releases one-shot session',async()=>{
  let created=0,destroyed=0;const inputs=[];
  const a=ai({LanguageModel:{availability:async()=>'available',create:async()=>{created++;return {prompt:async t=>{inputs.push(t);return ' mock response ';},destroy:()=>destroyed++};}}});
  assert.equal(await a.availability(),'available');assert.equal(created,0);assert.equal(await a.prompt('synthetic diary'),'mock response');assert.deepEqual(inputs,['synthetic diary']);assert.equal(destroyed,1);
});
