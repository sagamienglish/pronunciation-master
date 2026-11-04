import test from 'node:test';
import assert from 'node:assert/strict';
import {IPadSpeechInput,isAppleTouchDevice} from '../dist/ipad-speech.js';
function setup({autoEnd=true}={}){
 let now=0,id=0,starts=0,aborts=0,stops=0;const instances=[],timers=new Map();
 const clock={setTimeout(fn,ms){timers.set(++id,{at:now+ms,fn});return id;},clearTimeout(i){timers.delete(i);}};
 class Recognition{
  constructor(){instances.push(this);}start(){starts++;this.onstart?.();}
  stop(){stops++;if(autoEnd)this.onend?.();}abort(){aborts++;if(autoEnd)this.onend?.();}
  result(text,final=true){this.onresult?.({resultIndex:0,results:[Object.assign([{transcript:text}],{isFinal:final})]});}
 }
 const h={input:new IPadSpeechInput(Recognition,()=>{},()=>{},clock),instances,counts:()=>({starts,aborts,stops}),advance(ms){const end=now+ms;for(;;){const next=[...timers].sort((a,b)=>a[1].at-b[1].at).find(([,v])=>v.at<=end);if(!next)break;timers.delete(next[0]);now=next[1].at;next[1].fn();}now=end;}};return h;
}
test('iPadOS desktop-style user agent is detected without changing PC behavior',()=>{assert.equal(isAppleTouchDevice({platform:'MacIntel',maxTouchPoints:5}),true);assert.equal(isAppleTouchDevice({userAgent:'iPad'}),true);assert.equal(isAppleTouchDevice({platform:'MacIntel',maxTouchPoints:0}),false);});
test('twenty iPad words release each native connection before accepting the next',()=>{
 const h=setup(),heard=[];
 for(let i=0;i<20;i++){h.input.start({onTranscript:t=>heard.push(t)});assert.equal(h.instances[i].continuous,false);h.instances[i].result(`word${i}`);assert.equal(h.input.busy,true);h.advance(200);assert.equal(h.input.busy,false);}
 assert.equal(heard.length,20);assert.deepEqual(h.counts(),{starts:20,aborts:0,stops:20});
});
test('iPad interim-only results settle once, including final duplicates and OS early end',()=>{
 const h=setup(),heard=[];h.input.start({onTranscript:t=>heard.push(t)});const r=h.instances[0];r.result('nearly',false);h.advance(801);r.result('nearly',true);h.advance(200);assert.deepEqual(heard,['nearly']);
 h.input.start({onTranscript:t=>heard.push(t)});h.instances[1].result('victim',false);h.instances[1].onend();h.advance(200);assert.deepEqual(heard,['nearly','victim']);
});
test('word rush reopens a fresh recognizer after each answer, including repeated words',()=>{
 const h=setup(),heard=[];h.input.start({continuous:true,onTranscript:t=>heard.push(t)});
 for(let i=0;i<20;i++){h.instances[i].result('nearly');h.advance(200);assert.equal(h.input.busy,true);}
 assert.equal(heard.length,20);assert.equal(h.counts().starts,21);h.input.shutdown();h.advance(200);assert.equal(h.counts().starts,21);
});
test('silent iPad capture is replaced once instead of being reused indefinitely',()=>{
 const h=setup();let error;h.input.start({onTranscript(){assert.fail();},onError:e=>error=e});h.advance(4700);assert.equal(h.counts().starts,2);h.advance(7200);assert.equal(error,'recognition-timeout');assert.equal(h.input.busy,false);
 h.input.start({onTranscript(){}});assert.equal(h.counts().starts,3);
});
test('new target waits for native end and cooldown; cancelled results cannot leak',()=>{
 const h=setup({autoEnd:false}),heard=[];h.input.start({onTranscript:t=>heard.push(t)});const old=h.instances[0],late=old.onresult;h.input.cancel();h.input.start({onTranscript:t=>heard.push('new:'+t)});assert.equal(h.counts().starts,1);old.onend();h.advance(199);assert.equal(h.counts().starts,1);h.advance(1);assert.equal(h.counts().starts,2);late({results:[[{transcript:'stale'}]]});h.instances[1].result('victim');h.instances[1].onend();h.advance(200);assert.deepEqual(heard,['new:victim']);
});
test('missing native end falls back through abort and bounded release',()=>{
 const h=setup({autoEnd:false}),heard=[];h.input.start({onTranscript:t=>heard.push(t)});h.instances[0].result('nearly');h.advance(1200+450+200);assert.deepEqual(heard,['nearly']);assert.equal(h.input.busy,false);assert.equal(h.counts().aborts,1);
});
test('permission failures stop without retrying and permit a later user retry',()=>{
 const h=setup();let error;h.input.start({onError:e=>error=e});h.instances[0].onerror({error:'not-allowed'});h.advance(200);assert.equal(error,'not-allowed');assert.equal(h.counts().starts,1);assert.equal(h.input.busy,false);h.input.start({onTranscript(){}});assert.equal(h.counts().starts,2);
});

test('OS no-speech and application timeout retain separate causes in errors and diagnostics',()=>{const h=setup();let code;h.input.start({onError:e=>code=e});h.instances[0].onerror({error:'no-speech'});h.advance(200);h.instances[1].onerror({error:'no-speech'});h.advance(200);assert.equal(code,'no-speech');assert.match(h.input.logs.at(-1),/サービスから発話未検出/);});

test('native end without a transcript reports an empty result separately from timeout',()=>{const h=setup();let code;h.input.start({onError:e=>code=e});h.instances[0].onend();h.advance(200);h.instances[1].onend();h.advance(200);assert.equal(code,'no-result');assert.match(h.input.logs.at(-1),/サービスが結果なしで終了/);});
