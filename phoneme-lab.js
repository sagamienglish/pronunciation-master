const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)];
let word='sunglasses',worker,prepared=false,processing=false,capture=null,sourceLabel='',sourceSample='';
const referenceResults={};
const phoneChecks=JSON.parse(document.querySelector('#phoneme-data').textContent);
let comparePhones,waveformPath,mainModel,bootTimer,operationTimer,attempt=0,stage='起動前';
function progress(message){stage=message;status(message);}
function clearTimers(){clearTimeout(bootTimer);clearTimeout(operationTimer);}
function failure(message){++attempt;clearTimers();prepared=false;processing=false;worker?.terminate();worker=null;mainModel=null;const button=$('#prepare');button.hidden=false;button.disabled=false;button.textContent='もう一度、音素チェックを準備する';status(message);controls();}
function ready(){clearTimers();prepared=true;processing=false;$('#prepare').hidden=true;status('準備できました。「マイクで試す」を押すと、マイクの許可・録音へ進みます。');controls();}
function status(text){$('#status').textContent=text;}
function controls(){all('[data-word]').forEach(b=>b.disabled=processing||!!capture);all('[data-sample]').forEach(b=>b.disabled=!prepared||processing||!!capture);$('#record').disabled=!prepared||processing;$('#record').textContent=capture?'録音を止めて判定':'マイクで試す';}
function select(key){word=key;const entry=phoneChecks[key];$('#word').textContent=entry.label;$('#japanese').textContent=entry.ja;$('#expected').textContent='/ '+entry.phones.join(' ')+' /';$('#hint').textContent=entry.hint;all('[data-word]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.word===key)));$('#result').hidden=true;$('#comparison').hidden=true;$('#playback').pause();$('#playback').hidden=true;}
function show(phonemes,elapsedMs){const result=comparePhones(phoneChecks[word].phones,phonemes);$('#similarity').textContent=result.similarity+'%';if(sourceSample){referenceResults[word]??={};referenceResults[word][sourceSample]=result.similarity;const scores=referenceResults[word];$('#comparison').textContent='合成音声の比較：英語 '+(scores.en??'—')+'% ／ カタカナ '+(scores.ja??'—')+'%';$('#comparison').hidden=false;}$('#heard').textContent=phonemes.length?'/ '+phonemes.join(' ')+' /':'音を認識できませんでした';$('#source').textContent=sourceLabel;const cells=result.alignment.map(pair=>{const cell=document.createElement('div');cell.className='phone'+(pair.match?' match':'');const target=document.createElement('small'),heard=document.createElement('span');target.textContent=pair.expected;heard.textContent=pair.heard;cell.append(target,heard);return cell;});$('#alignment').replaceChildren(...cells);$('#result').hidden=false;status('音素の認識が終わりました。赤い部分は音の違い、またはモデルの認識ミスです。');processing=false;controls();}
async function prepare(){
 if(location.protocol==='file:'){status('ローカルファイルでは動きません。下の公開版リンクから開いてください。');$('#public-page').hidden=false;return;}
 const current=++attempt;clearTimers();worker?.terminate();worker=null;mainModel=null;prepared=false;processing=true;
 const button=$('#prepare');button.disabled=true;button.textContent='準備しています…';progress('1/3 起動プログラムを読み込んでいます…');controls();
 operationTimer=setTimeout(()=>{if(current===attempt)failure('準備が時間内に終わりませんでした。止まった段階：'+stage+'。通信環境を確認して、もう一度お試しください。');},45000);
 try{
  const [check,wave]=await Promise.all([import('./phoneme-check.js?v=2'),import('./local-speech.js?v=25')]);if(current!==attempt)return;
  comparePhones=check.comparePhones;waveformPath=wave.waveformPath;
  let fallbackStarted=false,booted=false;
  const fallback=async()=>{
   if(fallbackStarted||current!==attempt)return;fallbackStarted=true;clearTimeout(bootTimer);worker?.terminate();worker=null;
   progress('別の起動方法で、計算エンジンを準備しています…');
   globalThis.phonemeLabProgress=message=>{if(current===attempt)progress(message);};
   try{const library=await import('./vendor/hama-1.7.0/browser.js?fallback='+current);if(current!==attempt)return;const model=await library.ASRBrowserModel.create();if(current!==attempt)return;mainModel=model;ready();}
   catch(error){if(current===attempt)failure('音素モデルの起動に失敗しました：'+error.message);}
  };
  try{
   const candidate=new Worker(new URL('./phoneme-lab-worker.js?v=2',document.baseURI),{type:'module'});worker=candidate;
   candidate.onmessage=({data})=>{
    if(worker!==candidate||current!==attempt)return;
    if(data.type==='boot'){booted=true;clearTimeout(bootTimer);progress('2/3 計算エンジンを起動しています…');}
    else if(data.type==='progress')progress(data.message);
    else if(data.type==='ready')ready();
    else if(data.type==='result'){clearTimeout(operationTimer);show(data.phonemes,data.elapsedMs);}
    else if(data.type==='error')failure('音素モデルでエラーが発生しました：'+data.message);
   };
   candidate.onerror=event=>{if(worker!==candidate||current!==attempt)return;if(!booted)fallback();else failure('計算エンジンが停止しました：'+(event.message||stage));};
   bootTimer=setTimeout(fallback,8000);candidate.postMessage({type:'prepare'});
  }catch{await fallback();}
 }catch(error){if(current===attempt)failure('起動プログラムを読み込めませんでした：'+error.message);}
}
window.requestPhonemeLabStart=prepare;$('#prepare').onclick=prepare;window.phonemeLabBound=true;
async function analyze(samples,sampleRate,label,sample=''){
 processing=true;sourceLabel=label;sourceSample=sample;$('#result').hidden=true;status('英単語に変換せず、音を認識しています…');controls();
 const current=attempt;operationTimer=setTimeout(()=>{if(current===attempt)failure('音素の解析が時間内に終わりませんでした。もう一度、準備してください。');},20000);
 try{if(mainModel){const result=await mainModel.transcribeWaveform(samples,sampleRate);if(current!==attempt)return;clearTimeout(operationTimer);show(result.phonemes,0);}else worker.postMessage({type:'analyze',samples,sampleRate},[samples.buffer]);}
 catch(error){if(current===attempt)failure('音素を解析できませんでした：'+error.message);}
}
all('[data-word]').forEach(b=>b.onclick=()=>select(b.dataset.word));
all('[data-sample]').forEach(b=>b.onclick=async()=>{processing=true;controls();const ctx=new (window.AudioContext||window.webkitAudioContext)();try{const url='media/phoneme-lab/'+word+'-'+b.dataset.sample+'.wav',response=await fetch(url);if(!response.ok)throw Error('比較用音声を読み込めませんでした。');const buffer=await ctx.decodeAudioData(await response.arrayBuffer());$('#playback').src=url;$('#playback').hidden=false;analyze(buffer.getChannelData(0).slice(),buffer.sampleRate,b.dataset.sample==='en'?'英語の合成音声（Samantha）':'カタカナ読みの合成音声（Kyoko）',b.dataset.sample);}catch(error){processing=false;controls();status(error.message);}finally{await ctx.close();}});
function release(){const session=capture;if(!session)return null;capture=null;clearTimeout(session.timer);if(session.processor)session.processor.onaudioprocess=null;for(const node of [session.source,session.processor,session.gain])try{node?.disconnect();}catch{}session.stream?.getTracks().forEach(track=>track.stop());session.ctx.close().catch(()=>{});$('#wave').setAttribute('d','M0 12 L64 12');return session;}
function finish(){const session=release();if(!session)return;const samples=new Float32Array(session.chunks.reduce((sum,c)=>sum+c.length,0));let offset=0;for(const chunk of session.chunks){samples.set(chunk,offset);offset+=chunk.length;}if(samples.length<session.ctx.sampleRate*.2){controls();status('録音が短すぎました。もう一度お試しください。');return;}analyze(samples,session.ctx.sampleRate,'マイクで録音した音声（端末内のみで処理）');}
$('#record').onclick=async()=>{
 if(capture){finish();return;}if(processing)return;$('#playback').pause();$('#playback').hidden=true;
 const session={ctx:new (window.AudioContext||window.webkitAudioContext)(),chunks:[]};capture=session;controls();status('マイクを準備しています…');try{
 const resumed=session.ctx.resume();session.stream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true},video:false});await resumed;
 if(capture!==session){session.stream.getTracks().forEach(t=>t.stop());return;}
 session.source=session.ctx.createMediaStreamSource(session.stream);session.processor=session.ctx.createScriptProcessor(4096,1,1);session.gain=session.ctx.createGain();session.gain.gain.value=0;
 session.processor.onaudioprocess=event=>{if(capture!==session)return;const samples=event.inputBuffer.getChannelData(0);session.chunks.push(samples.slice());$('#wave').setAttribute('d',waveformPath(Array.from({length:32},(_,i)=>samples[Math.floor(i*(samples.length-1)/31)])));};
 session.source.connect(session.processor);session.processor.connect(session.gain);session.gain.connect(session.ctx.destination);session.timer=setTimeout(finish,4000);status('話してください。4秒で自動停止します。早く終わったら、もう一度ボタンを押してください。');
 }catch(error){if(capture===session){release();controls();status(error.name==='NotAllowedError'?'マイクが許可されていません。ブラウザの設定を確認してください。':'マイクを利用できませんでした。Safariの通常タブでお試しください。');}}
};
document.addEventListener('visibilitychange',()=>{if(document.hidden&&capture){release();controls();status('画面を離れたため録音を停止しました。');}});window.addEventListener('pagehide',()=>release());select(word);if(window.phonemeLabPendingStart)prepare();
