// Pre-generated speech avoids switching iPad's native speech synthesis audio session.
export class ModelAudio {
 constructor(){this.ctx=null;this.source=null;this.cache=new Map();this.generation=0;this.done=null;}
 stop(){this.generation++;try{this.source?.stop();}catch{}this.source=null;this.done?.();this.done=null;}
 async play(id,onEnd=()=>{}){
  this.stop();const generation=this.generation;const Context=window.AudioContext||window.webkitAudioContext;
  if(!Context)throw Error('このブラウザはお手本音声に対応していません。');
  this.ctx??=new Context();await this.ctx.resume();
  let buffer=this.cache.get(id);if(!buffer){const response=await fetch(`audio/${id}.wav`);if(!response.ok)throw Error('お手本音声を読み込めません。通信環境を確認してください。');buffer=await this.ctx.decodeAudioData(await response.arrayBuffer());this.cache.set(id,buffer);}
  if(generation!==this.generation)return;
  this.done=onEnd;const source=this.ctx.createBufferSource();source.buffer=buffer;source.connect(this.ctx.destination);this.source=source;
  source.onended=()=>{if(generation!==this.generation)return;this.source=null;this.done=null;onEnd();};source.start();
 }
}
