import {practiceOrder} from './practice-order.js?v=18';
import {pronunciationFor} from './phonetics.js?v=19';
import {certificateRank} from './awards.js?v=15';
import {scoreWord,sample,totalScore} from './vocabulary.js';
import {lessons,getLesson,themeColors} from './lessons.js?v=19';
import {LESSON_KEY,readProgress,writeProgress,emptyProgress} from './progress.js?v=19';
import {MicMeter} from './audio.js?v=19';
import {SpeechInput} from './speech-input.js';
import {IPadSpeechInput,isAppleTouchDevice} from './ipad-speech.js?v=19';
import {ModelAudio} from './model-audio.js';
import {migrateProfile,profileSelections} from './profile.js';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
let initialLesson;try{initialLesson=localStorage.getItem(LESSON_KEY);}catch{}
let lesson=getLesson(initialLesson)||getLesson(7),words=lesson.words;
let data=readProgress(localStorage,lesson.id,words);
let scoreOrder=false;
let mode='practice',part=0,active=null,toastTimer,challenge=null,tick=null,micReady=false,meter=null,meterTimeout=null,speechToken=0,currentUtterance=null,speechButton=null,speechWatchdog=null,celebrationTimer=null,quickRestart=null;
const CHALLENGES={sprint:{name:'発音スプリント'},quick:{name:'日→英ワードラッシュ'}};
const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
const ipadMode=isAppleTouchDevice(window.navigator||{});
const modelAudio=new ModelAudio();
data.profile=migrateProfile(data.profile);
const micSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10v2a7 7 0 0014 0v-2M12 19v3M8 22h8"/></svg>';
const speakingFaceSvg='<svg class="practice-face" viewBox="0 0 28 24" aria-hidden="true"><path d="M22 21v-5c3-2 4-5 3-8a7 7 0 00-13 1l-3 3h4v4h4v5"/><path d="M4 8l-2 4 2 4M7 9l-2 3 2 3"/><circle cx="16" cy="8" r=".8" fill="currentColor" stroke="none"/></svg>';
const smileFaceSvg='<svg class="practice-face" viewBox="0 0 28 24" aria-hidden="true"><circle cx="14" cy="12" r="9"/><path d="M9 14c2 4 8 4 10 0"/><circle cx="11" cy="9" r=".8" fill="currentColor" stroke="none"/><circle cx="17" cy="9" r=".8" fill="currentColor" stroke="none"/></svg>';
function practiceFace(perfect){return `<span class="practice-face-wrap" data-practice-face="${perfect?'smile':'speaking'}" aria-hidden="true">${perfect?smileFaceSvg:speakingFaceSvg}</span>`;}
const speakerSvg='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4L5 9H2v6h3l6 5zM15 8a6 6 0 010 8M18 5a10 10 0 010 14"/></svg>';
function escape(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function toast(s){clearTimeout(toastTimer);$('#toast').textContent=s;$('#toast').hidden=false;toastTimer=setTimeout(()=>$('#toast').hidden=true,6000);}
function persist(){try{writeProgress(localStorage,lesson.id,data);}catch{toast('このブラウザでは記録を保存できません。現在の画面では練習を続けられます。');}}
function displayHeard(text){return String(text??'').toLowerCase();}
function latest(w){return data.history[w.id]?.at(-1);}
function weakWords(){return words.filter(w=>latest(w)&&latest(w).score<90);}
const crownSvg='<svg class="crown-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6l5 4 4-7 4 7 5-4-2 12H5z"/><path d="M5 21h14"/></svg>';
function crownMark(label,short=''){return `<span class="achievement-crown" role="img" aria-label="${escape(label)}" title="${escape(label)}">${crownSvg}${short?`<span class="crown-label" aria-hidden="true">${short}</span>`:''}</span>`;}
function allMastered(progress,items){return items.length>0&&items.every(w=>progress.bestScores[w.id]>=90);}
function stats(){const mastered=words.filter(w=>data.bestScores[w.id]>=90).length;$('#mastered').innerHTML=`${mastered} <em>/ ${words.length}</em>${allMastered(data,words)?crownMark('全単語マスター'):''}`;$('#master-bar').style.width=`${mastered/words.length*100}%`;$('#attempts').innerHTML=`${data.attempts} <em>回</em>`;$('#best').innerHTML=`${data.challengeBest??'—'} <em>/ 100</em>${data.challengeBest===100?crownMark('発音スプリント100点達成'):''}`;$('#weak-count').textContent=weakWords().length;$('#quick-best').innerHTML=`${data.quickBest} <em>語</em>`;renderLessons();}
function showPracticeScore(card,result){const face=card.querySelector('[data-practice-face]');if(face){face.innerHTML=result.score===100?smileFaceSvg:speakingFaceSvg;face.setAttribute('data-practice-face',result.score===100?'smile':'speaking');}const score=card.querySelector('.practice-score');score.classList.remove('score-enter');score.innerHTML=`<strong>${result.score}</strong><span>点</span>`;score.setAttribute('aria-label',`今回の得点 ${result.score}点`);void score.offsetWidth;score.classList.add('score-enter');}
function historyHtml(w){const h=(data.history[w.id]||[]).slice(-5);return h.length?`<small>直近</small>${h.map(r=>`<span class="score">${r.score}</span>`).join('<span class="arrow">→</span>')}`:'';}
function filteredWords(){return practiceOrder((mode==='review'?weakWords():words).filter(w=>!part||w.part===part),data,scoreOrder);}
function list(){const items=filteredWords();$('#list-title').textContent=mode==='review'?'苦手な単語を復習':'単語を練習';
 $('#word-list').innerHTML=items.length?items.map(w=>{const h=data.history[w.id]||[],last=h.at(-1),best=h.length?data.bestScores[w.id]:null;return `<article class="word-card" data-id="${w.id}"><div class="word-meta"><span>PART ${w.part} · ${w.pos}</span><span class="badge ${best>=90?'good':''}">${best===null?'未練習':`BEST ${best}`}</span></div><h3 lang="en" class="${w.en.length>18?'long':''}">${escape(w.en)}</h3><div class="word-reading"><p class="meaning" title="${escape(w.ja)}">${escape(w.ja)}</p><span class="phonetic" lang="en-fonipa" aria-label="発音記号" title="米音を基準にした発音の目安">/${escape(pronunciationFor(w.en))}/</span></div><div class="word-actions"><button class="icon" data-action="listen" aria-label="${escape(w.en)}のお手本を聞く">${speakerSvg}</button><button class="icon mic" data-action="record" ${!Recognition?'disabled':''} aria-label="${escape(w.en)}を発音する">${micSvg}${practiceFace(last?.score===100)}</button></div><div class="practice-score" aria-live="polite" aria-atomic="true"></div><div class="history" aria-label="直近5回の得点">${historyHtml(w)}</div><div class="card-result" aria-live="polite" title="${last?escape(displayHeard(last.heard)):''}">${last?`認識：${escape(displayHeard(last.heard))}`:''}</div></article>`;}).join(''):`<div class="empty"><h3>${mode==='review'?'復習する単語はありません':'単語が見つかりません'}</h3><p>${mode==='review'?'最後の練習が90点未満の単語が並びます。':'Partを変えてみてください。'}</p></div>`;
 updateSortButton();$('#word-count').textContent=`${items.length}語を表示`;applyMeaning();updateMicUI(!!active);
}
function updateSortButton(){const button=$('#sort-words');button.setAttribute('aria-pressed',String(scoreOrder));button.innerHTML=`<span aria-hidden="true">⇅</span> ${scoreOrder?'教材順に戻す':'並べ替え'}`;button.title=scoreOrder?'教材に載っている順番に戻す':'未練習 → BEST得点が低い語 → 高い語';}
function sortPracticeCards(){
 cancelRecording();stopSpeech();
 const container=$('#word-list'),cards=[...container.querySelectorAll('.word-card')];
 cards.forEach(card=>card.getAnimations?.().forEach(animation=>animation.cancel()));
 const before=new Map(cards.map(card=>[card.dataset.id,card.getBoundingClientRect()]));
 scoreOrder=!scoreOrder;const byId=new Map(cards.map(card=>[Number(card.dataset.id),card]));
 filteredWords().forEach(word=>{const card=byId.get(word.id);if(card)container.append(card);});
 updateSortButton();
 if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)cards.forEach((card,index)=>{
  const from=before.get(card.dataset.id),to=card.getBoundingClientRect(),dx=from.left-to.left,dy=from.top-to.top;
  if(dx||dy)card.animate?.([{transform:`translate(${dx}px,${dy}px)`,opacity:.65},{transform:'translate(0,0)',opacity:1}],{duration:650,fill:'backwards',delay:Math.min(index*18,150),easing:'cubic-bezier(.2,.8,.2,1)'});
 });
 $('#word-count').textContent=`${cards.length}語を表示 · ${scoreOrder?'未練習 → BEST得点が低い順':'教材順'}`;
}
function stopSpeech(){modelAudio.stop();speechButton?.classList.remove('speaking');speechButton?.setAttribute('aria-pressed','false');speechButton=null;}
async function speak(w,rate=1,button=null){
 if(active){toast('回答が終わってから、お手本を再生してください。');return;}stopSpeech();speechButton=button;button?.classList.add('speaking');button?.setAttribute('aria-pressed','true');
 const done=()=>{button?.classList.remove('speaking');button?.setAttribute('aria-pressed','false');if(speechButton===button)speechButton=null;};
 try{await modelAudio.play(w.audio??w.id,done);}catch(e){done();toast(e.message||'音声を再生できませんでした。');}
}
function diagnostic(state){$('#speech-log').textContent=state.logs.join('\n');$('#ipad-connection').hidden=!ipadMode;$('#ipad-state').textContent=state.connected?'iPad：発話ごとにマイク接続を更新':`iPad：${state.label}`;}
const onBusy=session=>{active=session;updateMicUI(!!session);};
const speechInput=ipadMode?new IPadSpeechInput(Recognition,onBusy,diagnostic):new SpeechInput(Recognition,onBusy);
$('#release-mic').onclick=()=>{clearTimeout(quickRestart);speechInput.shutdown?.();micReady=false;if(['running','countdown'].includes(challenge?.phase))toast('接続を停止しました。回答ボタンで再接続できます。');};
function cancelRecording(){speechInput.cancel();}
function updateMicUI(on){
 $$('[data-action="record"]').forEach(b=>{b.disabled=on||!Recognition;b.classList.remove('recording');});
 $$('[data-challenge-record]').forEach(b=>{b.disabled=on||!Recognition;b.classList.remove('recording');});
 const q=$('#quick-mic');if(q){q.disabled=on||!Recognition;q.classList.toggle('recording',on);q.innerHTML=on?`${micSvg} 聞いています…`:`${micSvg} マイクを再開`;}
 if(on&&active?.button){active.button.classList.add('recording');active.button.disabled=true;}
}
function errorMessage(code){return ({'not-allowed':'マイク・音声認識が許可されていません。ブラウザの設定を確認してください。','service-not-allowed':'音声認識が制限されています。ブラウザの設定を確認してください。','audio-capture':'マイクが見つかりません。他のアプリのマイク使用も確認してください。','network':'音声認識に接続できません。インターネット接続を確認してください。','no-speech':'声を聞き取れませんでした。もう一度マイクを押してください。','aborted':'音声認識が中断されました。もう一度お試しください。'})[code]||'音声認識が終了しました。もう一度お試しください。';}
function record(w,{button,onResult,onError=toast}={}){
 if(speechInput.busy){toast('マイクの終了処理中です。少し待ってから押してください。');return;}
 stopMeter();stopSpeech();
 speechInput.start({button,onTranscript:heard=>onResult({score:scoreWord(w.say,heard),heard,date:new Date().toISOString()}),onError:code=>onError(errorMessage(code),code)});
}
function applyMeaning(){
 const hide=$('#hide-meaning').checked;$('#word-list').classList.remove('hide-meaning');
 $$('.meaning').forEach(el=>{el.style.visibility=hide?'hidden':'visible';el.setAttribute('aria-hidden',String(hide));});
}
function updateProfileLabel(){$('#profile-label').textContent=data.profile.name||'名前を設定';}
function addHistory(w,r){data.attempts++;data.bestScores[w.id]=Math.max(data.bestScores[w.id]||0,r.score);data.history[w.id]=[...(data.history[w.id]||[]),r].slice(-30);persist();stats();}
function stopMeter(){clearTimeout(meterTimeout);meter?.stop();meter=null;}
function saveProfile(){data.profile.name=$('#profile-name').value.trim().slice(0,60);Object.assign(data.profile,profileSelections($('#profile-class').value,$('#profile-number').value));persist();updateProfileLabel();}
function clearRound(){clearTimeout(quickRestart);$('#quick-victory')?.remove();clearTimeout(celebrationTimer);$('#perfect-celebration')?.remove();document.body.classList.remove('challenge-running');cancelRecording();stopMeter();stopSpeech();clearInterval(tick);if(challenge?.phase==='countdown')$('#countdown-overlay')?.remove();challenge=null;}
function setMode(next){if(['running','countdown'].includes(challenge?.phase)&&!confirm('チャレンジを終了しますか？ この回の結果は保存されません。'))return;clearRound();document.body.classList.remove('certificate-focus');mode=next;if(next==='review'){part=0;$$('[data-part]').forEach(b=>b.classList.toggle('selected',b.dataset.part==='0'));}$$('[data-mode]').forEach(b=>{b.classList.toggle('selected',b.dataset.mode===next);b.setAttribute('aria-pressed',b.dataset.mode===next);});$('#practice-view').hidden=['challenge','quick'].includes(next);$('#challenge-view').hidden=!['challenge','quick'].includes(next);if(['challenge','quick'].includes(next)){micReady=false;challengeSetup();}else list();}
function challengeSetup(message=''){clearTimeout(celebrationTimer);$('#perfect-celebration')?.remove();stopMeter();clearInterval(tick);const quick=mode==='quick';$('#challenge-content').innerHTML=`<section class="challenge-panel"><div class="eyebrow">${quick?'60 SECONDS · JAPANESE TO ENGLISH':'60 SECONDS · 10 WORDS · 100 POINTS'}</div><h1>${quick?CHALLENGES.quick.name:CHALLENGES.sprint.name}</h1><p>${quick?'日本語を見て、英語で即答。正解すると自動で次の問題へ。':'10語を一度に表示。好きな順にマイクを押して発音しよう。'}</p><p class="setup-profile">提出名：${escape(data.profile.name||'未設定')} ${escape(data.profile.group)} <button class="text-button" id="setup-profile">名前を設定</button></p><div id="meter-panel" class="meter-panel" hidden><div class="meter-label"><span>マイクの入力音量</span><span id="meter-state">音を待っています…</span></div><div id="mic-meter" class="meter" role="meter" aria-label="マイクの入力音量" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><i id="mic-level"></i></div><small class="meter-note">声に合わせてバーが伸びればOK。音声は保存されません。</small></div><div id="test-status" class="test-status" role="status">${escape(message||'最初にマイクを試して、声が入るか確認してください。')}</div><div class="start-buttons"><button class="secondary" id="test-mic">マイクを試す</button><button class="primary" id="begin-challenge" ${micReady&&Recognition?'':'disabled'}>3秒カウントでスタート ↗</button><button class="secondary" id="setup-history">得点履歴 ↗</button></div><p class="rules-note">${quick?`一致した単語を1語とカウント。スキップ可・全${words.length}語。音が途切れたらマイクを再開できます。`:'何度でも再挑戦OK。各単語の最高点を合計。100点で自動終了。未回答は0点。'} 3 → 2 → 1で60秒スタート。</p></section>`;
 $('#setup-history').onclick=()=>openChallengeHistory(quick?'quick':'sprint');$('#setup-profile').onclick=openProfile;$('#test-mic').onclick=testMicrophone;$('#begin-challenge').onclick=startChallenge;
}
function testMicrophone(){if(speechInput.busy){$('#test-status').textContent='録音の終了処理中です。少し待ってから、もう一度押してください。';return;}if(meter){stopMeter();$('#test-mic').textContent='もう一度マイクを試す';$('#test-status').textContent=micReady?'マイクの音量確認ができました。スタートできます。':'声を検出できませんでした。もう一度お試しください。';return;}stopSpeech();if(ipadMode)speechInput.shutdown();micReady=false;$('#begin-challenge').disabled=true;$('#meter-panel').hidden=false;$('#test-status').textContent='マイクの使用を許可し、声を出してください。';$('#test-mic').textContent='テストを終了';
 meter=new MicMeter(level=>{const value=Math.min(100,Math.round(level*450));$('#meter-state').textContent=level>.018?'音を検出しました ✓':micReady?'確認OK · 現在は静かです':'音を待っています…';$('#mic-level').style.width=`${value}%`;$('#mic-meter').setAttribute('aria-valuenow',value);if(level>.018){micReady=true;$('#meter-state').textContent='音を検出しました ✓';$('#begin-challenge').disabled=!Recognition;$('#test-status').textContent=Recognition?'マイクOK！ バーが動いたらスタートできます。':'音量は確認できましたが、音声認識は使えません。対応するブラウザで開いてください。';}},message=>{meter=null;$('#test-mic').textContent='もう一度マイクを試す';$('#test-status').textContent=message;});meter.start();meterTimeout=setTimeout(()=>{if(meter){stopMeter();$('#test-mic').textContent='もう一度マイクを試す';if(!micReady)$('#test-status').textContent='音が検出されませんでした。マイクの設定を確認し、もう一度お試しください。';}},15000);
}
function startChallenge(){if(!micReady||active||['running','countdown'].includes(challenge?.phase))return;stopMeter();stopSpeech();cancelRecording();document.body.classList.add('challenge-running');const quick=mode==='quick';challenge={type:quick?'quick':'sprint',phase:'countdown',items:sample(words,quick?words.length:10),results:Array(quick?words.length:10).fill(null),index:0,correct:0,countdownEnd:Date.now()+3000};renderCountdown();tick=setInterval(updateCountdown,100);}
function renderCountdown(){const overlay=document.createElement('div');overlay.id='countdown-overlay';overlay.className='countdown';overlay.innerHTML='<span>GET READY</span><strong id="countdown-number" role="status" aria-live="assertive">3</strong><span>声で、自分のベストを超えよう。</span><button id="cancel-countdown" class="secondary">キャンセル</button>';document.body.append(overlay);$('#cancel-countdown').onclick=()=>{clearRound();challengeSetup('準備ができたら、もう一度スタート。');};}
function updateCountdown(){if(challenge?.phase!=='countdown')return;const remaining=challenge.countdownEnd-Date.now();if(remaining<=0){clearInterval(tick);$('#countdown-overlay')?.remove();challenge.phase='running';challenge.deadline=Date.now()+60000;challenge.startedAt=new Date().toISOString();if(challenge.type==='quick'){quickBoard();listenQuick();}else challengeBoard();tick=setInterval(updateTimer,100);updateTimer();return;}const n=String(Math.ceil(remaining/1000));if($('#countdown-number').textContent!==n){$('#countdown-number').textContent=n;$('#countdown-number').style.animation='none';void $('#countdown-number').offsetWidth;$('#countdown-number').style.animation='';}}
function updateTimer(){if(challenge?.phase!=='running')return;const remaining=Math.max(0,challenge.deadline-Date.now());if(!remaining){finishChallenge();return;}const secs=Math.ceil(remaining/1000);$('#time').textContent=secs===60?'1:00':`0:${String(secs).padStart(2,'0')}`;$('#time').classList.toggle('urgent',secs<=10);$('#time-bar').style.width=`${remaining/60000*100}%`;}
function challengeBoard(){const c=challenge;if(c?.phase!=='running')return;const answered=c.results.filter(Boolean).length;$('#challenge-content').innerHTML=`<section class="challenge-board"><div class="board-header"><div><h1>発音スプリント</h1><p>60秒以内なら再挑戦OK · 100点で自動終了</p></div><div><span class="board-status">${answered} / 10語 回答済み</span><strong id="time" class="board-time">1:00</strong></div></div><div class="time-track"><i id="time-bar"></i></div><div class="challenge-grid">${c.items.map((w,i)=>{const r=c.results[i],last=c.lastResults?.[i]||r;return `<article class="challenge-item ${r?'answered':''} ${r?.score===100?'perfect':''}" data-challenge-item="${i}"><span class="number">${String(i+1).padStart(2,'0')}</span><div><h2 lang="en" class="${w.en.length>18?'long':''}">${escape(w.en)}</h2><p>${escape(w.ja)}</p><div class="heard" aria-live="polite">${last?`今回 ${(last.score/10).toFixed(1)}点：${escape(last.heard)}`:'未回答'}</div></div><div class="item-score" title="この単語の最高点">${r?(r.score/10).toFixed(r.score===100?0:1):'—'}<small> /10</small></div><button class="mic" data-challenge-record="${i}" aria-label="${escape(w.en)}を${r?'もう一度':''}発音する" ${!Recognition?'disabled':''}>${micSvg} ${r?'再挑戦':'発音'}</button></article>`;}).join('')}</div><div class="board-footer"><button class="text-button" id="quit-challenge">やめる</button><span id="round-status" role="status">時間内は再挑戦OK。各単語の最高点を合計します。</span><button class="secondary" id="finish-round">結果を見る →</button></div></section>`;
 $$('[data-challenge-record]').forEach(b=>b.onclick=()=>answerChallenge(Number(b.dataset.challengeRecord),b));$('#finish-round').onclick=()=>{if(answered<10&&!confirm('未回答は0点として終了しますか？'))return;finishChallenge();};$('#quit-challenge').onclick=()=>{if(confirm('チャレンジを終了しますか？ この回の結果は保存されません。')){clearRound();challengeSetup('また挑戦しよう。');}};updateTimer();}
function answerChallenge(index,button){const c=challenge;if(c?.phase!=='running'||active)return;if(Date.now()>=c.deadline){finishChallenge();return;}const w=c.items[index];$('#round-status').textContent=`「${w.say}」を聞いています…`;stopSpeech();record(w,{button,onResult:r=>{if(challenge!==c||c.phase!=='running')return;if(Date.now()>=c.deadline){finishChallenge();return;}c.lastResults??=[];c.lastResults[index]=r;if(!c.results[index]||r.score>c.results[index].score)c.results[index]=r;addHistory(w,r);if(totalScore(c.results)===100){finishChallenge();celebrate('PERFECT! 100点達成 👑');return;}challengeBoard();if(r.score===100)celebrate();},onError:(message,code)=>{if(challenge!==c||c.phase!=='running')return;if(['not-allowed','service-not-allowed','audio-capture','network','start-failed'].includes(code)){clearRound();micReady=false;challengeSetup(`チャレンジを中止しました。${message}`);}else $('#round-status').textContent=message;}});}
function celebrate(message='PERFECT! +10 ★'){clearTimeout(celebrationTimer);$('#perfect-celebration')?.remove();const el=document.createElement('div');el.id='perfect-celebration';el.className='celebration';el.setAttribute('aria-hidden','true');el.innerHTML=`<strong>${escape(message)}</strong>${Array.from({length:28},(_,i)=>`<i style="--confetti-left:${i*3.7}%;--confetti-delay:${(i%5)*.06}s;--confetti-color:${['#d7eaa0','#d8b566','#759d7a','#ead8a2'][i%4]}"></i>`).join('')}`;document.body.append(el);celebrationTimer=setTimeout(()=>el.remove(),1800);}
function certificateBadge(type,score){const rank=certificateRank(type,score);return `<div class="cert-badge cert-badge-${rank.level}" aria-label="称号：${rank.name}"><span class="cert-badge-emblem" aria-hidden="true">${crownSvg}</span><span><small>ACHIEVEMENT RANK</small><strong>${rank.name}</strong></span></div>`;}
function sprintTime(record){return record.score===100&&Number.isFinite(record.elapsedMs)&&record.elapsedMs>=0&&record.elapsedMs<=60000?(Math.ceil(record.elapsedMs/100)/10).toFixed(1):null;}
function certificateDate(iso){return new Intl.DateTimeFormat('ja-JP',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(new Date(iso));}
function finishChallenge(){if(challenge?.phase!=='running')return;if(challenge.type==='quick'){finishQuick();return;}cancelRecording();clearInterval(tick);const c=challenge;c.phase='done';clearTimeout(celebrationTimer);$('#perfect-celebration')?.remove();document.body.classList.remove('challenge-running');c.finishedAt=new Date().toISOString();const score=totalScore(c.results),answered=c.results.filter(Boolean).length,previous=data.challengeBest??-1;data.challengeBest=Math.max(score,previous);const elapsedMs=Date.parse(c.finishedAt)-Date.parse(c.startedAt),record={score,date:c.finishedAt};if(score===100&&Number.isFinite(elapsedMs)&&elapsedMs>=0)record.elapsedMs=Math.min(60000,elapsedMs);c.elapsedMs=record.elapsedMs;data.challenges=[...data.challenges,record].slice(-50);persist();stats();
 $('#challenge-content').innerHTML=`<section class="certificate-wrap"><div class="certificate" id="certificate"><div class="cert-heading"><span>PRONUNCIATION LAB · LESSON ${String(lesson.id).padStart(2,'0')}</span><span class="cert-seal">✦</span><span>60 SECONDS / 10 WORDS</span></div><h1>発音スプリント 認定証</h1><p class="cert-subtitle">CERTIFICATE OF ACHIEVEMENT</p><div class="certificate-identity"><label>名前<input id="cert-name" maxlength="60" value="${escape(data.profile.name)}" placeholder="提出前に名前を入力" aria-label="認定証の名前"></label><label>組・番号<input id="cert-group" readonly value="${escape(data.profile.group)}" placeholder="組・番号を入力" aria-label="認定証の組・番号"></label></div><div class="cert-summary"><div class="cert-score">${score}<small> / 100点</small></div><div class="cert-achievement">${certificateBadge('sprint',score)}${sprintTime({score,elapsedMs:c.elapsedMs})!==null?`<div class="cert-time">TIME <strong>${sprintTime({score,elapsedMs:c.elapsedMs})}</strong> s</div>`:''}<div class="cert-record">BEST ${data.challengeBest} / 100 · ANSWERED ${answered} / 10</div></div></div><div class="cert-details">${c.items.map((w,i)=>{const r=c.results[i];return `<div class="cert-row"><span class="num">${String(i+1).padStart(2,'0')}</span><div><b lang="en">${escape(w.en)}</b><small>${r?`認識：${escape(r.heard)}`:'未回答'}</small></div><span class="points">${r?(r.score/10).toFixed(r.score===100?0:1):'0'}<small> /10</small></span></div>`;}).join('')}</div><p class="cert-date">${certificateDate(c.finishedAt)}</p><p class="cert-foot">Pronunciation Lab / ${lesson.name}</p></div><p class="capture-tip">名前・組番号を確認し、「提出用に大きく表示」で認定証全体をスクリーンショットしてください。</p><div class="cert-actions"><button class="primary" id="capture-certificate">提出用に大きく表示</button><button class="secondary" id="retry">もう一度挑戦</button><button class="secondary" id="review-result">苦手を復習</button><button class="secondary" id="result-history">得点履歴 ↗</button></div></section><button class="restore-view" id="restore-view">通常表示に戻る</button>`;
 $('#result-history').onclick=()=>openChallengeHistory(c.type);
 for(const k of ['name'])$('#cert-'+k).oninput=()=>{data.profile[k]=$('#cert-'+k).value.slice(0,60);persist();updateProfileLabel();};$('#capture-certificate').onclick=()=>{document.body.classList.add('certificate-focus');window.scrollTo({top:0});};$('#restore-view').onclick=()=>document.body.classList.remove('certificate-focus');$('#retry').onclick=()=>{document.body.classList.remove('certificate-focus');challenge=null;challengeSetup();};$('#review-result').onclick=()=>setMode('review');window.scrollTo({top:0});
}
function openProfile(){
 cancelRecording();stopMeter();stopSpeech();clearTimeout(quickRestart);
 $('#profile-name').value=data.profile.name;$('#profile-class').value=data.profile.classNo||'';$('#profile-number').value=data.profile.number||'';$('#profile-dialog').showModal();
}
$('#profile-settings').onclick=openProfile;
$('#profile-form').onsubmit=e=>{e.preventDefault();saveProfile();$('#profile-dialog').close();if(['challenge','quick'].includes(mode)&&!['running','countdown','done'].includes(challenge?.phase))challengeSetup('提出用の名前を保存しました。');toast('名前を保存しました。');};
function scheduleQuick(){clearTimeout(quickRestart);const c=challenge;quickRestart=setTimeout(()=>{if(challenge===c&&c?.phase==='running'&&c.type==='quick'&&!document.hidden)listenQuick();},500);}
function quickBoard(){
 const c=challenge;if(c?.phase!=='running'||c.type!=='quick')return;
 if(c.index>=c.items.length){finishQuick();return;}
 const w=c.items[c.index];
 $('#challenge-content').innerHTML=`<section class="quick-board"><div class="board-header"><div><h1>日→英ワードラッシュ</h1><p>日本語を見て英語で回答 · スキップOK（「skip」と発音でも可）</p></div><strong id="time" class="board-time">1:00</strong></div><div class="time-track"><i id="time-bar"></i></div><div class="quick-score"><b>${c.correct}</b> 語正解 <span>自己ベスト ${data.quickBest}語</span></div><div class="quick-prompt"><span class="eyebrow">${c.index+1} / ${c.items.length} · ${w.pos}</span><h2>${escape(w.ja)}</h2><p>英語で言ってみよう。</p></div><div class="quick-feedback" role="status">${escape(c.feedback||'マイクが聞いています。英語で答えてください。')}</div><div class="quick-controls"><button class="primary" id="quick-mic">${micSvg} マイクを再開</button><button class="secondary" id="quick-skip">スキップ →</button><button class="secondary" id="quick-pause">回答を一時停止</button></div><p class="quick-note" id="round-status" role="status">正解すると自動で次へ。聞き取れない場合は「マイクを再開」。</p><div class="board-footer"><button class="text-button" id="quick-quit">やめる</button><span>教材の表現と一致すると正解 · 最大${c.items.length}語</span><button class="secondary" id="quick-finish">結果を見る →</button></div></section>`;
 $('#quick-mic').onclick=()=>{c.endCount=0;listenQuick();};
 $('#quick-skip').onclick=()=>skipQuick(false);
 $('#quick-pause').onclick=()=>{clearTimeout(quickRestart);cancelRecording();$('#round-status').textContent='回答を一時停止中。「マイクを再開」で続けられます。時間は進みます。';};
 $('#quick-quit').onclick=()=>{if(confirm('チャレンジを終了しますか？ この回の結果は保存されません。')){clearRound();challengeSetup();}};
 $('#quick-finish').onclick=()=>{if(confirm('ここまでの正解数で終了しますか？'))finishQuick();};updateTimer();updateMicUI(!!active);
}
function listenQuick(){
 const c=challenge;if(c?.phase!=='running'||c.type!=='quick'||document.hidden)return;
 if(Date.now()>=c.deadline){finishQuick();return;}
 if(speechInput.busy){$('#round-status').textContent='マイクの終了を待っています。少し待ってから再開してください。';return;}
 clearTimeout(quickRestart);stopMeter();stopSpeech();
 speechInput.start({continuous:true,button:$('#quick-mic'),onTranscript:heard=>{
  if(challenge!==c||c.phase!=='running')return;if(Date.now()>=c.deadline){finishQuick();return;}
  if(c.index>=c.items.length||Date.now()<(c.blockUntil||0))return;
  if(scoreWord('skip',heard)===100){skipQuick(true);return;}
  c.endCount=0;const w=c.items[c.index],score=scoreWord(w.say,heard),r={score,heard,date:new Date().toISOString()};addHistory(w,r);
  if(score===100){quickVictory(w);c.results[c.index]=r;c.correct++;c.index++;c.feedback=`正解！ ${w.en}`;if(c.index===c.items.length){setTimeout(()=>{if(challenge===c&&c.phase==='running')finishQuick();},1100);return;}}
  else c.feedback=`認識：${heard} ／ もう一度、またはスキップ。`;
  quickBoard();
 },onError:code=>{
  if(challenge!==c||c.phase!=='running')return;
  if(['not-allowed','service-not-allowed','audio-capture','network','start-failed','unsupported'].includes(code)){$('#round-status').textContent=errorMessage(code);return;}
  c.endCount=(c.endCount||0)+1;
  if(c.endCount<=3){$('#round-status').textContent='マイクを再接続しています…';scheduleQuick();}
  else $('#round-status').textContent='音声が途切れました。「マイクを再開」を押してください。';
 }});
}
function finishQuick(){
 const c=challenge;if(c?.type!=='quick'||c.phase!=='running')return;
 c.phase='done';$('#quick-victory')?.remove();clearTimeout(quickRestart);clearInterval(tick);cancelRecording();document.body.classList.remove('challenge-running');c.finishedAt=new Date().toISOString();
 const previous=data.quickBest;data.quickBest=Math.max(previous,c.correct);data.quickChallenges=[...data.quickChallenges,{score:c.correct,date:c.finishedAt}].slice(-50);persist();stats();
 const skipped=c.results.filter(r=>r?.skipped).length,correct=c.items.filter((w,i)=>c.results[i]?.score===100);
 $('#challenge-content').innerHTML=`<section class="certificate-wrap"><div class="certificate" id="certificate"><div class="cert-heading"><span>PRONUNCIATION LAB · LESSON ${String(lesson.id).padStart(2,'0')}</span><span class="cert-seal">✦</span><span>60 SECONDS / JAPANESE TO ENGLISH</span></div><h1>日→英ワードラッシュ 認定証</h1><p class="cert-subtitle">CERTIFICATE OF ACHIEVEMENT</p><div class="certificate-identity"><label>名前<input id="cert-name" maxlength="60" value="${escape(data.profile.name)}" placeholder="提出前に名前を入力" aria-label="認定証の名前"></label><label>組・番号<input id="cert-group" readonly value="${escape(data.profile.group)}" placeholder="組・番号を入力" aria-label="認定証の組・番号"></label></div><div class="cert-summary"><div class="cert-score">${c.correct}<small> 語正解 / ${c.items.length}語</small></div><div class="cert-achievement">${certificateBadge('quick',c.correct)}<div class="cert-record">BEST ${data.quickBest} · SKIPPED ${skipped}</div></div></div><div class="quick-cert-words"><h2>正解した単語・表現</h2><div>${correct.length?correct.map(w=>`<span lang="en">${escape(w.en)}</span>`).join(''):'<span>次の挑戦で、まずは1語！</span>'}</div></div><p class="cert-date">${certificateDate(c.finishedAt)}</p><p class="cert-foot">Pronunciation Lab / ${lesson.name}</p></div><p class="capture-tip">名前を確認し、提出用表示でスクリーンショットしてください。</p><div class="cert-actions"><button class="primary" id="capture-certificate">提出用に大きく表示</button><button class="secondary" id="retry">もう一度挑戦</button><button class="secondary" id="review-result">単語を練習</button><button class="secondary" id="result-history">得点履歴 ↗</button></div></section><button class="restore-view" id="restore-view">通常表示に戻る</button>`;
 $('#result-history').onclick=()=>openChallengeHistory(c.type);
 for(const k of ['name'])$('#cert-'+k).oninput=()=>{data.profile[k]=$('#cert-'+k).value.slice(0,60);persist();updateProfileLabel();};
 $('#capture-certificate').onclick=()=>{document.body.classList.add('certificate-focus');window.scrollTo({top:0});};$('#restore-view').onclick=()=>document.body.classList.remove('certificate-focus');$('#retry').onclick=()=>{document.body.classList.remove('certificate-focus');challenge=null;challengeSetup();};$('#review-result').onclick=()=>setMode('practice');window.scrollTo({top:0});
}
$('#word-list').onclick=e=>{const b=e.target.closest('button[data-action]');if(!b)return;const card=b.closest('[data-id]'),w=words.find(word=>word.id===Number(card.dataset.id));if(b.dataset.action==='listen')speak(w,1,b);if(b.dataset.action==='record'){stopSpeech();const area=card.querySelector('.card-result');area.classList.remove('error');const score=card.querySelector('.practice-score');score.classList.remove('score-enter');score.innerHTML='';area.textContent='聞いています…';record(w,{button:b,onResult:r=>{addHistory(w,r);showPracticeScore(card,r);area.textContent=`認識：${displayHeard(r.heard)}`;area.title=displayHeard(r.heard);card.querySelector('.history').innerHTML=historyHtml(w);const badge=card.querySelector('.badge');badge.textContent=`BEST ${data.bestScores[w.id]}`;badge.classList.toggle('good',data.bestScores[w.id]>=90);},onError:m=>{area.classList.add('error');area.textContent=m;}});}};
$$('[data-mode]').forEach(b=>b.onclick=()=>setMode(b.dataset.mode));$('#part-tabs').onclick=e=>{const b=e.target.closest('[data-part]');if(!b)return;cancelRecording();stopSpeech();part=Number(b.dataset.part);$$('[data-part]').forEach(x=>{x.classList.toggle('selected',x===b);x.setAttribute('aria-pressed',String(x===b));});list();};$('#sort-words').onclick=sortPracticeCards;$('#hide-meaning').addEventListener('input',applyMeaning);$('#hide-meaning').addEventListener('change',applyMeaning);$('#help').onclick=()=>{if(['running','countdown'].includes(challenge?.phase)){toast('チャレンジを終えてから使い方動画を開いてください。');return;}cancelRecording();stopMeter();stopSpeech();$('#help-dialog').showModal();};$('#help-dialog').addEventListener('close',()=>$('#tutorial-video').pause());$$('.dialog-close').forEach(b=>b.onclick=()=>b.closest('dialog').close());$('#reset').onclick=()=>{if(['running','countdown'].includes(challenge?.phase)){toast('チャレンジを終了してから記録をリセットしてください。');return;}if(confirm(`この端末の${lesson.name}の練習記録・チャレンジ記録を削除しますか？ 名前と他のレッスンの記録は残ります。`)){clearRound();data=emptyProgress(data.profile);persist();stats();updateProfileLabel();if(['challenge','quick'].includes(mode))challengeSetup();else list();toast('学習記録をリセットしました。');}};
window.addEventListener('pagehide',()=>{speechInput.shutdown?.();clearTimeout(quickRestart);cancelRecording();stopMeter();stopSpeech();});document.addEventListener('visibilitychange',()=>{if(document.hidden){speechInput.shutdown?.();clearTimeout(quickRestart);cancelRecording();stopMeter();stopSpeech();if(challenge?.phase==='countdown'){clearRound();challengeSetup('画面を離れたためカウントダウンを中止しました。');}else if(challenge?.phase==='running')$('#round-status').textContent='マイクが中断されました。もう一度押してください。';}else updateTimer();});
$('#ipad-connection').hidden=!ipadMode;renderLessons();renderLessonDetails();updateProfileLabel();stats();list();
function skipQuick(fromVoice=false){
 const c=challenge;if(c?.type!=='quick'||c.phase!=='running'||Date.now()<(c.blockUntil||0))return;
 if(Date.now()>=c.deadline){finishQuick();return;}
 clearTimeout(quickRestart);if(!fromVoice)cancelRecording();
 const old=c.items[c.index];c.results[c.index]={score:0,heard:fromVoice?'skip':'',skipped:true};c.index++;c.feedback=`スキップ：${old.en}`;
 if(c.index===c.items.length)finishQuick();else{quickBoard();if(!fromVoice)scheduleQuick();}
}
function quickVictory(w){
 const c=challenge;c.blockUntil=Date.now()+1100;$('#quick-victory')?.remove();
 const el=document.createElement('div');el.id='quick-victory';el.className='quick-victory';el.setAttribute('role','status');el.innerHTML=`<div class="victory-halo"></div><div class="victory-card"><span>CORRECT!</span><strong lang="en">${escape(w.say)}</strong><p>${escape(w.ja)}</p><b>+1 WORD ✦</b></div>${Array.from({length:36},(_,i)=>`<i style="--left:${i*2.85}%;--delay:${(i%6)*.04}s;--color:${['#d9ed9e','#f3cc69','#68ab8e','#f8e2a2'][i%4]}"></i>`).join('')}`;
 document.body.append(el);setTimeout(()=>el.remove(),1100);
}

function renderLessons(){
 $('#lesson-tabs').style.gridTemplateColumns=`repeat(${lessons.length},minmax(0,1fr))`;
 $('#lesson-tabs').innerHTML=lessons.map(item=>{const progress=item.id===lesson.id?data:readProgress(localStorage,item.id,item.words);const mastered=allMastered(progress,item.words),perfect=progress.challengeBest===100;const marks=(mastered?crownMark('全単語マスター','単語'):'')+(perfect?crownMark('発音スプリント100点達成','100'):'');return `<button type="button" data-lesson="${item.id}" style="--tab-color:${themeColors[item.theme]}" class="${item.id===lesson.id?'selected':''}" aria-pressed="${item.id===lesson.id}"><span class="lesson-name"><span>Lesson</span> ${item.id}</span>${marks?`<span class="lesson-achievements">${marks}</span>`:''}</button>`;}).join('');
}
function renderLessonDetails(){
 document.body.setAttribute('data-theme',lesson.theme);
 $('meta[name="theme-color"]').setAttribute('content',themeColors[lesson.theme]);
 $('#favicon').setAttribute('href',`icons/favicon-${lesson.theme}.png`);
 document.title=`${lesson.name} — Pronunciation Lab`;
 $('#header-tag').textContent=`LESSON ${String(lesson.id).padStart(2,'0')} · VOCABULARY`;
 $('#lesson-footer').textContent=`${lesson.name} · 得点は認識された文字との一致度の目安です`;
 $('#part-tabs').innerHTML=[0,1,2,3].map(p=>`<button type="button" data-part="${p}" class="${part===p?'selected':''}" aria-pressed="${part===p}">${p?'Part '+p:'すべて'} <span>${p?words.filter(w=>w.part===p).length:words.length}</span></button>`).join('');
 $('#help-quick-count').textContent=words.length;
}
function selectLesson(id){
 const next=getLesson(id);if(!next||next.id===lesson.id)return;
 if(['running','countdown'].includes(challenge?.phase)&&!confirm('チャレンジを終了してレッスンを変更しますか？ この回の結果は保存されません。'))return;
 clearRound();persist();lesson=next;words=lesson.words;data=readProgress(localStorage,lesson.id,words);
 try{localStorage.setItem(LESSON_KEY,String(lesson.id));}catch{}
 part=0;scoreOrder=false;micReady=false;
 renderLessons();renderLessonDetails();setMode(mode);stats();updateProfileLabel();window.scrollTo({top:0});
}
$('#lesson-tabs').onclick=e=>{const button=e.target.closest('[data-lesson]');if(button)selectLesson(Number(button.dataset.lesson));};

let historyType='sprint';
function openChallengeHistory(type='sprint'){
 if(['running','countdown'].includes(challenge?.phase))return;
 cancelRecording();stopMeter();stopSpeech();historyType=type==='quick'?'quick':'sprint';renderChallengeHistory();$('#challenge-history-dialog').showModal();
}
function renderChallengeHistory(){
 const quick=historyType==='quick',records=quick?data.quickChallenges:data.challenges,unit=quick?'語':'点';
 $('#history-title').textContent=`${lesson.name} · 得点履歴`;
 $('#history-mode-tabs').innerHTML=Object.entries(CHALLENGES).map(([type,info])=>`<button type="button" data-history-mode="${type}" class="${historyType===type?'selected':''}" aria-pressed="${historyType===type}">${info.name}</button>`).join('');
 const recent=records.slice(-5);
 const sequence=recent.length?`<div class="round-recent"><small>直近5回</small>${recent.map(r=>`<b>${r.score}<small>${unit}</small></b>`).join('<span aria-hidden="true">→</span>')}</div>`:'';
 const best=quick?data.quickBest:data.challengeBest;
 $('#history-content').innerHTML=`<p class="round-history-summary">${CHALLENGES[historyType].name} · 自己ベスト <strong>${best??'—'}${unit}</strong></p>${sequence}${records.length?`<div class="round-history-table"><table><thead><tr><th scope="col">実施日時（日本時間）</th><th scope="col">${quick?'正解語数':'得点'}</th>${quick?'':'<th scope="col">100点達成</th>'}</tr></thead><tbody>${[...records].reverse().map(r=>`<tr><td>${Number.isFinite(Date.parse(r.date))?certificateDate(r.date):'日時不明'}</td><td><strong>${r.score}</strong> ${unit}</td>${quick?'':`<td>${sprintTime(r)!==null?`${sprintTime(r)}秒`:'—'}</td>`}</tr>`).join('')}</tbody></table></div><p class="round-history-note">新しい順に表示 · このレッスンの直近50回を保存</p>`:`<p class="round-history-empty">${quick&&best>0?'これまでのベストは保存されています。各回の履歴は今回の更新から記録します。':'まだ履歴がありません。チャレンジが終わると記録されます。'}</p>`}`;
}
$('#history-mode-tabs').onclick=e=>{const b=e.target.closest('[data-history-mode]');if(b){historyType=b.dataset.historyMode==='quick'?'quick':'sprint';renderChallengeHistory();}};
