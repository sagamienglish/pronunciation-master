import {runInNewContext} from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import {LocalSpeechInput,waveformPath,lessonGrammar,localTranscript} from '../dist/local-speech.js';
function setup(){
 const recognizers=[],processors=[],signals=[],busy=[];let stopped=0,closed=0;
 class Recognizer{constructor(rate,grammar){this.grammar=grammar;this.rate=rate;this.events={};this.removed=false;recognizers.push(this);}on(name,fn){this.events[name]=fn;}acceptWaveform(buffer){this.buffer=buffer;}remove(){this.removed=true;}retrieveFinalResult(){this.flushed=true;}}
 class Context{constructor(){this.sampleRate=48000;this.destination={};}resume(){return Promise.resolve();}close(){closed++;return Promise.resolve();}createMediaStreamSource(){return {connect(){},disconnect(){}};}createScriptProcessor(){const p={connect(){},disconnect(){}};processors.push(p);return p;}createGain(){return {gain:{value:1},connect(){},disconnect(){}};}}
 const stream={getTracks:()=>[{stop(){stopped++;}}]};
 const input=new LocalSpeechInput(s=>busy.push(!!s),signal=>signals.push(signal),{AudioContext:Context,mediaDevices:{getUserMedia:async()=>stream}});input.model={KaldiRecognizer:Recognizer};
 return {input,recognizers,processors,signals,busy,counts:()=>({stopped,closed})};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('local recognition and true waveform use the same capture, release it on result and accept a next word',async()=>{
 const h=setup(),heard=[];
 for(const word of ['apple','banana']){
  h.input.start({onTranscript:text=>heard.push(text)});await settle();const rec=h.recognizers.at(-1),p=h.processors.at(-1),samples=new Float32Array([0,.1,-.1,.2,-.2,0]);p.onaudioprocess({inputBuffer:{getChannelData:()=>samples}});assert.ok(h.signals.at(-1).level>0);assert.equal(h.signals.at(-1).samples.length,32);rec.events.result({result:{text:word}});assert.equal(rec.removed,true);assert.equal(h.input.busy,false);
 }
 assert.deepEqual(heard,['apple','banana']);assert.deepEqual(h.counts(),{stopped:2,closed:2});
});
test('word rush keeps local capture for multiple results; cancelled late messages cannot award another answer',async()=>{
 const h=setup(),heard=[];h.input.start({continuous:true,onTranscript:text=>heard.push(text)});await settle();const rec=h.recognizers[0];rec.events.result({result:{text:'apple'}});rec.events.result({result:{text:'skip'}});assert.equal(h.input.busy,true);h.input.cancel();rec.events.result({result:{text:'stale'}});assert.deepEqual(heard,['apple','skip']);assert.equal(h.counts().stopped,1);
});
test('waveform is flat for silence and derives finite bounded points from input samples',()=>{
 assert.equal(waveformPath(),'M0 12 L64 12');assert.match(waveformPath([0,0]),/^M0.0 12.0 L64.0 12.0$/);assert.match(waveformPath([-1,1]),/22.0.*2.0/);
});
test('local mode reports missing preparation without activating native speech or microphone',()=>{let code;const input=new LocalSpeechInput();assert.equal(input.start({onError:e=>code=e}),false);assert.equal(code,'local-not-ready');assert.equal(input.busy,false);});
test('capture arriving after cancellation immediately stops and cannot create a recognizer',async()=>{
 let release,stops=0,created=0;const input=new LocalSpeechInput(()=>{},()=>{},{AudioContext:class{resume(){return Promise.resolve();}close(){return Promise.resolve();}},mediaDevices:{getUserMedia:()=>new Promise(resolve=>release=resolve)}});input.model={KaldiRecognizer:class{constructor(){created++;}}};input.start();input.cancel();release({getTracks:()=>[{stop(){stops++;}}]});await settle();assert.equal(stops,1);assert.equal(created,0);
});

test('lesson vocabulary includes all competing entries, compound spelling and unknown speech',async()=>{
 const words=[{say:'Dutch'},{say:'victim'},{say:'microplastic'},{say:'non-profit organization'}];
 const grammar=JSON.parse(lessonGrammar(words));assert.deepEqual(grammar,['dutch','victim','microplastic','micro plastic','non profit organization','skip','[unk]']);
 const h=setup();h.input.start({vocabulary:words,onTranscript(){}});await settle();assert.deepEqual(JSON.parse(h.recognizers[0].grammar),grammar);h.input.cancel();
});
test('unknown markers around a recognized word do not become incorrect spelling penalties',()=>{assert.equal(localTranscript('[unk] Dutch [unk]'),'Dutch');assert.equal(localTranscript('[unk]'),'[unk]');assert.equal(localTranscript('symbol [unk] of'),'symbol of');});

test('shared recognizers receive samples from their own window while the match keeps its microphone',async()=>{
 const h=setup(),heard=[],errors=[];
 const {AudioContext,mediaDevices}=h.input.env;
 const capture={ctx:new AudioContext(),stream:await mediaDevices.getUserMedia()};
 capture.ctx.state='running';
 h.input.env.copySamples=samples=>Float32Array.from(samples);
 h.input.start({capture,onTranscript:value=>heard.push(value),onError:code=>errors.push(code)});
 const rec=h.recognizers[0];
 const foreignSamples=runInNewContext('new Float32Array([0.25, -0.25])');
 assert.equal(foreignSamples instanceof Float32Array,false);
 rec.acceptWaveformFloat=(samples,rate)=>{
  assert.ok(samples.map(value=>value*32768) instanceof Float32Array);
  assert.deepEqual([...samples],[.25,-.25]);
  assert.equal(rate,48000);
 };
 h.processors[0].onaudioprocess({inputBuffer:{sampleRate:48000,getChannelData:()=>foreignSamples}});
 rec.events.result({result:{text:'apple'}});
 assert.deepEqual(errors,[]);
 assert.deepEqual(heard,['apple']);
 assert.deepEqual(h.counts(),{stopped:0,closed:0});
});
