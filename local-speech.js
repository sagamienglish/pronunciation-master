// Optional, fully local Vosk recognition. Native Safari capture is not changed.
export function waveformPath(samples=[]){if(!samples.length)return 'M0 12 L64 12';return samples.map((v,i)=>`${i?'L':'M'}${(i*64/(samples.length-1||1)).toFixed(1)} ${(12-Math.max(-1,Math.min(1,v*3))*10).toFixed(1)}`).join(' ');}
export class LocalSpeechInput {
 constructor(onBusy=()=>{},onSignal=()=>{},env={}){this.onBusy=onBusy;this.onSignal=onSignal;this.env=env;this.session=null;this.model=null;this.loading=null;}
 get busy(){return !!this.session;}
 get ready(){return !!this.model;}
 async prepare(){
  if(this.model)return;if(this.loading)return this.loading;
  this.loading=(async()=>{
   await (this.env.loadLibrary?.()||import('./vendor/vosk-0.0.8.js'));
   const Vosk=this.env.Vosk||globalThis.Vosk;if(!Vosk)throw Error('認識エンジンを読み込めませんでした。');
   const model=new Vosk.Model(new URL('./models/vosk-en-us-small-0.15.tar.gz',import.meta.url).href,-1);
   try{await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('準備に時間がかかっています。通信環境を確認してください。')),180000);const done=error=>{clearTimeout(timer);error?reject(error):resolve();};model.on('load',message=>done(message.result?null:Error('認識データを読み込めませんでした。')));model.on('error',()=>done(Error('互換モードを準備できませんでした。')));});this.model=model;}
   catch(error){model.terminate();throw error;}
  })();try{await this.loading;}finally{this.loading=null;}
 }
 start({continuous=false,onTranscript,onError=()=>{},button}={}){
  if(this.session)return false;if(!this.model){onError('local-not-ready');return false;}
  const s={continuous,onTranscript,onError,button,ctx:null,stream:null,processor:null,source:null,gain:null,rec:null,watch:null,settle:null,flushing:false};this.session=s;this.onBusy(s);
  const alive=()=>this.session===s;
  const fail=code=>{if(!alive())return;this.cancel();onError(code);};
  const watch=()=>{clearTimeout(s.watch);s.watch=setTimeout(()=>fail('recognition-timeout'),15000);};watch();
  (async()=>{
   try{
    const Context=this.env.AudioContext||globalThis.AudioContext||globalThis.webkitAudioContext;
    const media=this.env.mediaDevices||globalThis.navigator?.mediaDevices;
    if(!Context||!media?.getUserMedia){fail('local-mic-unavailable');return;}
    s.ctx=new Context();const resumed=s.ctx.resume();
    s.stream=await media.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,channelCount:1},video:false});await resumed;
    if(!alive()){s.stream.getTracks().forEach(track=>track.stop());return;}
    const rec=s.rec=new this.model.KaldiRecognizer(s.ctx.sampleRate);
    rec.on('error',()=>fail('local-recognition-failed'));
    rec.on('result',message=>{
     if(!alive())return;s.flushing=false;clearTimeout(s.settle);const text=message.result?.text?.trim();if(!text)return;
     if(!continuous)this.cancel();else watch();onTranscript(text);
    });
    rec.on('partialresult',message=>{
     if(!alive()||!message.result?.partial?.trim()||s.flushing)return;
     clearTimeout(s.settle);s.settle=setTimeout(()=>{if(alive()){s.flushing=true;rec.retrieveFinalResult();}},1000);
    });
    s.source=s.ctx.createMediaStreamSource(s.stream);s.processor=s.ctx.createScriptProcessor(4096,1,1);s.gain=s.ctx.createGain();s.gain.gain.value=0;
    s.processor.onaudioprocess=event=>{
     if(!alive())return;const samples=event.inputBuffer.getChannelData(0);let energy=0;const trace=[];
     for(let i=0;i<samples.length;i++)energy+=samples[i]*samples[i];
     for(let i=0;i<32;i++)trace.push(samples[Math.floor(i*(samples.length-1)/31)]);
     this.onSignal({kind:'wave',level:Math.sqrt(energy/samples.length),samples:trace});
     try{rec.acceptWaveform(event.inputBuffer);}catch{fail('local-recognition-failed');}
    };
    s.source.connect(s.processor);s.processor.connect(s.gain);s.gain.connect(s.ctx.destination);
   }catch(error){fail(error.name==='NotAllowedError'?'not-allowed':error.name==='NotFoundError'?'audio-capture':'local-mic-unavailable');}
  })();return true;
 }
 cancel(){
  const s=this.session;if(!s)return;this.session=null;clearTimeout(s.watch);clearTimeout(s.settle);
  if(s.processor)s.processor.onaudioprocess=null;
  for(const node of [s.source,s.processor,s.gain])try{node?.disconnect();}catch{}
  s.stream?.getTracks().forEach(track=>track.stop());try{s.rec?.remove();}catch{}s.ctx?.close().catch(()=>{});
  this.onBusy(null);
 }
 shutdown(){this.cancel();}
}
