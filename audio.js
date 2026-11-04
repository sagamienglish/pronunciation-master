export function rmsLevel(samples){if(!samples.length)return 0;return Math.sqrt(samples.reduce((s,n)=>s+((n-128)/128)**2,0)/samples.length);}
export class MicMeter {
 constructor(onLevel,onError){this.onLevel=onLevel;this.onError=onError;this.generation=0;this.stream=null;this.ctx=null;this.frame=null;}
 async start(){this.stop();const generation=this.generation;
  try{if(!navigator.mediaDevices?.getUserMedia)throw Error('このブラウザでは音量テストを利用できません。HTTPSの対応ブラウザで開いてください。');const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true},video:false});if(generation!==this.generation){stream.getTracks().forEach(t=>t.stop());return;}this.stream=stream;
   const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error('音量の測定に対応していません。');this.ctx=new Context();await this.ctx.resume();if(generation!==this.generation)return;const analyser=this.ctx.createAnalyser();analyser.fftSize=512;this.ctx.createMediaStreamSource(stream).connect(analyser);const samples=new Uint8Array(analyser.fftSize);
   const draw=()=>{if(generation!==this.generation)return;analyser.getByteTimeDomainData(samples);const level=rmsLevel(samples);this.onLevel(level);this.frame=requestAnimationFrame(draw);};draw();
  }catch(e){if(generation!==this.generation)return;this.stop();this.onError(e.name==='NotAllowedError'?'マイクの使用を許可してください。ブラウザの設定を確認してください。':e.name==='NotFoundError'?'利用できるマイクが見つかりません。':e.message||'音量を測定できませんでした。');}
 }
 stop(){this.generation++;if(this.frame)cancelAnimationFrame(this.frame);this.frame=null;this.stream?.getTracks().forEach(t=>t.stop());this.stream=null;if(this.ctx){this.ctx.close().catch(()=>{});this.ctx=null;}}
}
