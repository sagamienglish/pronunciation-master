export function isAppleTouchDevice(nav={}){
 return /iPad|iPhone|iPod/.test(nav.userAgent||'')||(nav.platform==='MacIntel'&&nav.maxTouchPoints>1);
}
// iPad native capture can remain "started" while no longer returning audio.
// Use a fresh, non-continuous recognizer for each utterance, waiting for release
// before reconnecting. Logical continuous mode is used only by Word Rush.
export class IPadSpeechInput {
 constructor(Recognition,onBusy=()=>{},onState=()=>{},clock={setTimeout:(fn,ms)=>setTimeout(fn,ms),clearTimeout:id=>clearTimeout(id)}){
  this.Recognition=Recognition;this.onBusy=onBusy;this.onState=onState;this.clock=clock;this.session=null;this.native=null;this.resumeTimer=null;this.logs=[];
 }
 get busy(){return !!this.session;}
 event(label){this.logs.push(`${new Date().toLocaleTimeString('ja-JP')} ${label}`);this.logs=this.logs.slice(-20);this.onState({connected:!!this.native,listening:!!this.native?.listening,label,logs:[...this.logs]});}
 start({continuous=false,onTranscript,onError=()=>{},button}={}){
  if(this.session)return false;if(!this.Recognition){onError('unsupported');return false;}
  const s={continuous,onTranscript,onError,button,retries:0};this.session=s;this.onBusy(s);this.connect(s);return true;
 }
 connect(s){
  if(this.session!==s||this.native||this.resumeTimer!==null)return;
  this.clock.clearTimeout(this.resumeTimer);this.resumeTimer=null;
  const rec=new this.Recognition(),n={rec,owner:s,listening:false,closing:false,result:null,error:null,interim:null,watch:null,ending:null};this.native=n;
  const alive=()=>this.native===n;
  const armWatch=ms=>{this.clock.clearTimeout(n.watch);n.watch=this.clock.setTimeout(()=>{if(!alive()||n.closing)return;n.error='no-speech';this.event('認識結果なし・接続を更新');this.close(n,true);},ms);};
  rec.lang='en-US';rec.continuous=false;rec.interimResults=true;rec.maxAlternatives=1;
  const accept=text=>{if(!alive()||n.closing||this.session!==s||!text?.trim())return;n.result=text.trim();this.event('認識結果を受信・接続を終了中');this.close(n);};
  rec.onstart=()=>{if(alive()){n.listening=true;armWatch(s.retries?7000:4500);this.event('接続済み');}};
  rec.onaudiostart=()=>{if(alive())this.event('マイク音声の受付開始');};
  rec.onspeechstart=()=>{if(alive()){armWatch(7000);this.event('発話を検出');}};
  rec.onresult=e=>{
   if(!alive()||n.closing||this.session!==s)return;armWatch(7000);this.clock.clearTimeout(n.interim);
   for(let i=e.resultIndex??0;i<e.results.length;i++){
    const text=e.results[i][0]?.transcript;if(!text?.trim())continue;
    if(e.results[i].isFinal!==false){accept(text);break;}
    this.event('途中の認識結果を受信');n.interimText=text;this.clock.clearTimeout(n.interim);n.interim=this.clock.setTimeout(()=>accept(text),800);
   }
  };
  rec.onerror=e=>{if(!alive()||n.closing)return;n.error=e.error;this.event(`認識エラー：${e.error}`);this.close(n);};
  rec.onend=()=>{if(alive()){if(!n.error&&!n.result)n.result=n.interimText?.trim()||null;this.retire(n);}};
  // One bounded reconnect also recovers connections that start but never report speech.
  armWatch(s.retries?7000:4500);
  this.event('iPadの発話用接続を開始');
  try{rec.start();}catch{n.error='start-failed';this.retire(n);}
 }
 close(n,abort=false){
  if(this.native!==n||n.closing)return;n.closing=true;this.clock.clearTimeout(n.watch);this.clock.clearTimeout(n.interim);
  n.ending=this.clock.setTimeout(()=>{if(this.native!==n)return;try{n.rec.abort();}catch{}if(this.native===n)n.ending=this.clock.setTimeout(()=>this.retire(n),450);},abort?450:1200);
  try{if(abort)n.rec.abort();else n.rec.stop();}catch{this.retire(n);}
 }
 retire(n){
  if(this.native!==n)return;
  for(const timer of [n.watch,n.interim,n.ending])this.clock.clearTimeout(timer);
  n.rec.onstart=n.rec.onaudiostart=n.rec.onspeechstart=n.rec.onresult=n.rec.onerror=n.rec.onend=null;
  this.native=null;this.event('接続終了・次の発話を準備');
  this.resumeTimer=this.clock.setTimeout(()=>{
   this.resumeTimer=null;const s=this.session;if(!s)return;
   if(s!==n.owner){this.connect(s);return;}
   if(n.result){
    s.retries=0;
    if(!s.continuous){this.session=null;this.onBusy(null);}
    s.onTranscript(n.result);
    if(s.continuous&&this.session===s)this.connect(s);
   }else if(!['not-allowed','service-not-allowed','audio-capture','network','start-failed'].includes(n.error)&&s.retries<1){
    s.retries++;this.event('新しい接続で再試行');this.connect(s);
   }else{this.session=null;this.onBusy(null);s.onError(n.error||'no-speech');}
  },200);
 }
 cancel(){
  this.session=null;this.onBusy(null);
  if(this.native)this.close(this.native,true);
 }
 shutdown(){this.cancel();this.event('マイク接続を停止');}
}
