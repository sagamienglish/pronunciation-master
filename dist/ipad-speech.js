export function isAppleTouchDevice(nav={}){
 return /iPad|iPhone|iPod/.test(nav.userAgent||'')||(nav.platform==='MacIntel'&&nav.maxTouchPoints>1);
}
// Keep one physical recognition connection; individual word buttons only route results.
export class IPadSpeechInput {
 constructor(Recognition,onBusy=()=>{},onState=()=>{},clock={setTimeout:(fn,ms)=>setTimeout(fn,ms),clearTimeout:id=>clearTimeout(id)}){
  this.Recognition=Recognition;this.onBusy=onBusy;this.onState=onState;this.clock=clock;this.session=null;this.native=null;this.logs=[];
 }
 get busy(){return !!this.session;}
 event(label){this.logs.push(`${new Date().toLocaleTimeString('ja-JP')} ${label}`);this.logs=this.logs.slice(-20);this.onState({connected:!!this.native,listening:!!this.native?.listening,label,logs:[...this.logs]});}
 start({continuous=false,onTranscript,onError=()=>{},button}={}){
  if(this.session)return false;if(!this.Recognition){onError('unsupported');return false;}
  const s={continuous,onTranscript,onError,button,timer:null};this.session=s;this.onBusy(s);
  if(this.native){for(const [i,t] of this.native.raw)this.native.used.set(i,t);this.event('同じ接続で次の回答を受付');this.watch();return true;}
  const rec=new this.Recognition(),n={rec,raw:new Map(),used:new Map(),listening:false,interim:null};this.native=n;
  rec.lang='en-US';rec.continuous=true;rec.interimResults=true;rec.maxAlternatives=1;
  const alive=()=>this.native===n;
  const deliver=(i,full)=>{
   if(!alive())return;const previous=n.used.get(i)||'';let text=full.trim();if(!text||(text===previous&&!n.newUtterance))return;n.newUtterance=false;
   if(previous&&text.toLowerCase().startsWith(previous.toLowerCase()+' '))text=text.slice(previous.length).trim();
   n.used.set(i,full);this.event('認識結果を受信');const current=this.session;if(!current||!text)return;
   if(!current.continuous){this.cancel();}else this.watch();
   current.onTranscript(text);
  };
  rec.onstart=()=>{if(alive()){n.listening=true;this.event('接続済み');}};
  rec.onaudiostart=()=>{if(alive())this.event('マイク音声の受付開始');};
  rec.onspeechstart=()=>{if(alive()){n.newUtterance=true;this.event('発話を検出');}};
  rec.onresult=e=>{
   if(!alive())return;this.clock.clearTimeout(n.interim);
   for(let i=e.resultIndex??0;i<e.results.length;i++){
    const text=e.results[i][0]?.transcript?.trim();if(!text)continue;n.raw.set(i,text);
    if(!this.session){n.used.set(i,text);continue;}
    if(e.results[i].isFinal!==false)deliver(i,text);
    else {this.event('途中の認識結果を受信');n.interim=this.clock.setTimeout(()=>deliver(i,text),800);}
   }
  };
  rec.onerror=e=>{if(!alive())return;this.event(`認識エラー：${e.error}`);const current=this.session;this.cancel();current?.onError(e.error);};
  rec.onend=()=>{if(!alive())return;this.clock.clearTimeout(n.interim);this.native=null;this.event('OSが接続を終了');const current=this.session;this.cancel();current?.onError('no-result');};
  this.event('iPadの継続接続を開始');this.watch();
  try{rec.start();return true;}catch{this.native=null;this.cancel();this.event('接続開始に失敗');onError('start-failed');return false;}
 }
 watch(){const s=this.session;if(!s)return;this.clock.clearTimeout(s.timer);s.timer=this.clock.setTimeout(()=>{if(this.session!==s)return;this.cancel();this.event('接続を維持していますが、認識結果が返りません');s.onError('recognition-timeout');},12000);}
 cancel(){const s=this.session;if(s)this.clock.clearTimeout(s.timer);this.session=null;this.onBusy(null);if(this.native){this.clock.clearTimeout(this.native.interim);for(const [i,t] of this.native.raw)this.native.used.set(i,t);}}
 shutdown(){this.cancel();const n=this.native;this.native=null;if(n){this.clock.clearTimeout(n.interim);n.rec.onstart=n.rec.onaudiostart=n.rec.onspeechstart=n.rec.onresult=n.rec.onerror=n.rec.onend=null;try{n.rec.abort();}catch{}}this.event('マイク接続を停止');}
}
