import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function setup(){
 const nodes=new Map(),instances=[],timers=new Map();let id=0,stops=0;
 const node=key=>{if(!nodes.has(key))nodes.set(key,{textContent:'',disabled:false});return nodes.get(key);};
 class Rec{constructor(){instances.push(this);}start(){this.onstart?.();this.onaudiostart?.();}stop(){stops++;this.onend?.();}abort(){this.onend?.();}}
 const context={document:{getElementById:node},window:{SpeechRecognition:Rec,addEventListener(){}},navigator:{clipboard:{writeText:async()=>{}}},Date,setTimeout(fn,ms){timers.set(++id,{fn,ms});return id;},clearTimeout(i){timers.delete(i);}};
 vm.createContext(context);vm.runInContext(fs.readFileSync(new URL('../dist/mic-check.js',import.meta.url),'utf8'),context);
 return {nodes,node,instances,stops:()=>stops,timeout(){const entry=[...timers.entries()].find(([,t])=>t.ms===20000);assert.ok(entry);timers.delete(entry[0]);entry[1].fn();}};
}
test('native baseline waits for natural end and performs two tests without app stop or reconnect',()=>{
 const h=setup();h.node('check-1').onclick();const r=h.instances[0];assert.equal(r.continuous,false);r.onresult({results:[Object.assign([{transcript:'apple'}],{isFinal:true})]});assert.equal(h.node('result-1').textContent,'apple');assert.equal(h.stops(),0);assert.equal(h.node('check-2').disabled,true);r.onend();assert.equal(h.node('check-2').disabled,false);h.node('check-2').onclick();assert.equal(h.instances.length,2);assert.equal(h.stops(),0);
});
test('silent second baseline records its own timeout and does not automatically reconnect',()=>{
 const h=setup();h.node('check-2').onclick();h.timeout();assert.equal(h.instances.length,1);assert.equal(h.stops(),1);assert.equal(h.node('check-1').disabled,false);assert.match(h.node('check-log').textContent,/20秒待機時間切れ（認識結果なし）/);
});
