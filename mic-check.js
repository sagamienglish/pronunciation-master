// Minimal native baseline: no app adapter, audio playback, getUserMedia,
// automatic reconnect, interim settling, or stop() after a successful result.
const $=id=>document.getElementById(id),Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
let active=null,sequence=0,lines=[];
function log(message){lines.push(`${new Date().toLocaleTimeString('ja-JP')} ${message}`);$('check-log').textContent=lines.join('\n');}
function controls(){for(const id of ['check-1','check-2'])$(id).disabled=!!active||!Recognition;$('check-stop').disabled=!active;}
function start(number){
 if(active||!Recognition)return;
 const rec=new Recognition(),s={rec,number,id:++sequence,result:'',timer:null,release:null};active=s;controls();$('result-'+number).textContent='—';$('check-status').textContent='接続を開始しています…';
 const alive=()=>active===s;
 const finish=()=>{if(!alive())return;clearTimeout(s.timer);clearTimeout(s.release);rec.onstart=rec.onaudiostart=rec.onspeechstart=rec.onspeechend=rec.onresult=rec.onerror=rec.onend=null;active=null;controls();};
 const stop=()=>{if(!alive())return;clearTimeout(s.timer);s.release=setTimeout(()=>{if(!alive())return;log(`#${s.id} 終了通知なし・接続を中止`);try{rec.abort();}catch{}finish();},2000);try{rec.stop();}catch{finish();}};
 s.stop=stop;rec.lang='en-US';rec.continuous=false;rec.interimResults=true;rec.maxAlternatives=1;
 rec.onstart=()=>{if(alive())log(`#${s.id} 接続済み`);};
 rec.onaudiostart=()=>{if(alive()){log(`#${s.id} 音声受付開始`);$('check-status').textContent=`「${number===1?'apple':'banana'}」と言ってください。`;}};
 rec.onspeechstart=()=>{if(alive())log(`#${s.id} 発話を検出`);};
 rec.onspeechend=()=>{if(alive())log(`#${s.id} 発話終了の通知`);};
 rec.onresult=e=>{if(!alive())return;for(let i=e.resultIndex??0;i<e.results.length;i++){const r=e.results[i],text=r[0]?.transcript?.trim();if(!text)continue;s.result=text;$('result-'+number).textContent=text;log(`#${s.id} ${r.isFinal?'確定':'途中'}の認識結果：${text}`);if(r.isFinal)$('check-status').textContent='認識結果を受信しました。終了通知を待っています…';}};
 rec.onerror=e=>{if(!alive())return;log(`#${s.id} サービスのエラー：${e.error}`);$('check-status').textContent=['not-allowed','service-not-allowed'].includes(e.error)?'ブラウザの設定を確認してください。':`認識サービスから「${e.error}」が返りました。`;};
 rec.onend=()=>{if(!alive())return;log(`#${s.id} 接続終了（${s.result?'認識結果あり':'認識結果なし'}）`);$('check-status').textContent=s.result?'終了しました。次のマイクボタンを押せます。':'認識結果なしで終了しました。診断記録をお送りください。';finish();};
 s.timer=setTimeout(()=>{if(!alive())return;log(`#${s.id} 診断の20秒待機時間切れ（${s.result?'認識結果あり':'認識結果なし'}）`);$('check-status').textContent=s.result?'認識結果は返りましたが、自動で終了しませんでした。':'音声認識から結果が返りませんでした。診断記録をお送りください。';stop();},20000);
 log(`#${s.id} ${number}回目のテスト開始（自動再接続なし）`);try{rec.start();}catch(e){log(`#${s.id} 開始失敗：${e.name}`);$('check-status').textContent='音声認識を開始できませんでした。';finish();}
}
$('check-1').onclick=()=>start(1);$('check-2').onclick=()=>start(2);$('check-stop').onclick=()=>{if(active){log(`#${active.id} 利用者が停止`);active.stop();}};
$('check-copy').onclick=async()=>{try{await navigator.clipboard.writeText(lines.join('\n'));$('check-status').textContent='診断記録をコピーしました。このチャットに貼り付けてください。';}catch{$('check-status').textContent='下の診断記録を選択してコピーしてください。';}};
window.addEventListener('pagehide',()=>{if(active){clearTimeout(active.timer);clearTimeout(active.release);try{active.rec.abort();}catch{}}});
controls();if(!Recognition)$('check-status').textContent='このブラウザは音声認識に対応していません。';
