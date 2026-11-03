// Result and service-disconnect are separate events. Never overlap native sessions.
export class SpeechInput {
  constructor(Recognition,onBusy=()=>{},clock={setTimeout:(fn,ms)=>setTimeout(fn,ms),clearTimeout:id=>clearTimeout(id)}){
    this.Recognition=Recognition;this.onBusy=onBusy;this.clock=clock;this.session=null;
  }
  get busy(){return !!this.session;}
  start({continuous=false,onTranscript,onError=()=>{},button}={}){
    if(this.session)return false;
    if(!this.Recognition){onError('unsupported');return false;}
    const rec=new this.Recognition();
    const s={rec,continuous,onTranscript,onError,button,seen:new Map(),cancelled:false,result:null,error:null,timer:null,ending:null};
    this.session=s;rec.lang='en-US';rec.continuous=continuous;rec.interimResults=false;rec.maxAlternatives=1;
    const alive=()=>this.session===s;
    const arm=(ms,fn)=>{this.clock.clearTimeout(s.timer);s.timer=this.clock.setTimeout(fn,ms);};
    const finish=()=>{
      if(!alive())return;this.clock.clearTimeout(s.timer);this.clock.clearTimeout(s.ending);
      rec.onstart=rec.onresult=rec.onerror=rec.onend=null;this.session=null;this.onBusy(null);
      if(s.cancelled)return;
      if(s.result&&!continuous)onTranscript(s.result);
      else onError(s.error||(continuous?'ended':'no-speech'));
    };
    const abortWithFallback=()=>{if(!alive())return;try{rec.abort();}catch{}if(alive()){this.clock.clearTimeout(s.ending);s.ending=this.clock.setTimeout(finish,450);}};
    s.cancel=()=>{s.cancelled=true;this.clock.clearTimeout(s.timer);abortWithFallback();};
    const watchdog=()=>arm(9000,()=>{s.error='no-speech';abortWithFallback();});
    rec.onstart=()=>{if(alive())this.onBusy({...s,listening:true});};
    rec.onresult=e=>{
      if(!alive()||s.cancelled)return;
      for(let i=e.resultIndex??0;i<e.results.length;i++){
        if(e.results[i].isFinal===false)continue;
        const transcript=e.results[i][0]?.transcript?.trim();if(!transcript||s.seen.get(i)===transcript)continue;s.seen.set(i,transcript);
        if(continuous){watchdog();onTranscript(transcript);if(!alive()||s.cancelled)break;}
        else if(!s.result){s.result=transcript;this.clock.clearTimeout(s.timer);
          // stop gracefully; aborting from onresult can strand Safari's audio session.
          s.ending=this.clock.setTimeout(abortWithFallback,1600);
          try{rec.stop();}catch{}break;
        }
      }
    };
    rec.onerror=e=>{if(!alive()||s.cancelled)return;s.error=e.error;this.clock.clearTimeout(s.timer);this.clock.clearTimeout(s.ending);s.ending=this.clock.setTimeout(abortWithFallback,600);};
    rec.onend=finish;this.onBusy(s);watchdog();
    try{rec.start();}catch(e){s.error='start-failed';finish();return false;}
    return true;
  }
  cancel(){this.session?.cancel();}
}
