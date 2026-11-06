import test from 'node:test';
import assert from 'node:assert/strict';
import {loadWasm} from '../dist/vendor/hama-1.7.0/engine.browser.js';
async function environment(caches,fetch,fn){const saved={caches:globalThis.caches,fetch:globalThis.fetch};globalThis.caches=caches;globalThis.fetch=fetch;try{await fn();}finally{globalThis.caches=saved.caches;globalThis.fetch=saved.fetch;}}
test('stalled cache writing cannot block downloaded engine bytes',{timeout:3000},async()=>{let written=false;await environment({open:async()=>({match:async()=>null,put(){written=true;return new Promise(()=>{});}})},async()=>new Response(new Uint8Array([0,97,115,109])),async()=>{assert.deepEqual([...await loadWasm()],[0,97,115,109]);assert.equal(written,true);});});
test('stalled Safari cache opening falls back to the network',{timeout:5000},async()=>{let fetched=false;await environment({open:()=>new Promise(()=>{})},async()=>{fetched=true;return new Response(new Uint8Array([0,97,115,109]));},async()=>{assert.deepEqual([...await loadWasm()],[0,97,115,109]);assert.equal(fetched,true);});});
test('saved bytes can prepare without a network request',async()=>{await environment({open:async()=>({match:async()=>new Response(new Uint8Array([0,97,115,109]))})},async()=>assert.fail('cached engine should not fetch'),async()=>assert.deepEqual([...await loadWasm()],[0,97,115,109]));});
