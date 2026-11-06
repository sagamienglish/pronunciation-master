import {LocalSpeechInput,waveformPath} from '../dist/local-speech.js';
import {practiceOrder} from '../dist/practice-order.js';
import {pronunciationFor} from '../dist/phonetics.js';
import {certificateRank} from '../dist/awards.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {words,scoreWord,sample,totalScore} from '../dist/vocabulary.js';
import {lessons,getLesson,themeColors} from '../dist/lessons.js';
import {LESSON_KEY,readProgress,writeProgress,emptyProgress} from '../dist/progress.js';
import {IPadSpeechInput,isAppleTouchDevice} from '../dist/ipad-speech.js';
import {migrateProfile,profileSelections} from '../dist/profile.js';
import {SpeechInput as NativeSpeechInput} from '../dist/speech-input.js';
import {rmsLevel,MicMeter} from '../dist/audio.js';
function harness({navigator={},Meter=MicMeter,saved={},nativeRecognition=true}={}){
 let now=Date.UTC(2026,10,3,9),interval,recognizer,stored,spoken;
 const nodes=new Map(),timeouts=[],storage=new Map(Object.entries(saved));
 function element(){return {innerHTML:'',textContent:'',value:'',hidden:false,disabled:false,style:{},dataset:{},classList:{add(){},remove(){},toggle(){}},setAttribute(){},addEventListener(){},remove(){},append(){},querySelector(){return element();},scrollIntoView(){},showModal(){this.open=true;},close(){this.open=false;}};}
 const document={querySelector(s){if(!nodes.has(s))nodes.set(s,element());return nodes.get(s);},querySelectorAll(){return [];},addEventListener(){},createElement(){return element();},body:element()};
 class Rec{constructor(){recognizer=this;}start(){}stop(){this.onend?.();}abort(){this.onend?.();}}
 const synth={speaking:false,getVoices(){return [];},cancel(){},resume(){},speak(u){spoken=u;}};
 const context={LocalSpeechInput,waveformPath,practiceOrder,pronunciationFor,certificateRank,words,lessons,getLesson,themeColors,LESSON_KEY,readProgress,writeProgress,emptyProgress,scoreWord,sample,totalScore,MicMeter:Meter,IPadSpeechInput,isAppleTouchDevice,migrateProfile,profileSelections,ModelAudio:class{stop(){}play(id,onEnd){spoken={id};onEnd?.();}},SpeechInput:class extends NativeSpeechInput{constructor(r,busy){super(r,busy,{setTimeout(fn){timeouts.push(fn);return timeouts.length;},clearTimeout(){}});}},Intl,document,window:{navigator,SpeechRecognition:nativeRecognition?Rec:undefined,speechSynthesis:synth,matchMedia(query){return {matches:query.includes('prefers-reduced-motion')};},addEventListener(){},scrollTo(){}},SpeechSynthesisUtterance:class{constructor(text){this.text=text;}},localStorage:{getItem(k){return storage.get(k)??null;},setItem(k,v){storage.set(k,v);if(k.includes('-lesson'))stored=JSON.parse(v);}},Date:class extends Date{constructor(...args){super(...(args.length?args:[now]));}static now(){return now;}},setTimeout(fn){timeouts.push(fn);return timeouts.length;},clearTimeout(){},setInterval(fn){interval=fn;return 1;},clearInterval(){interval=null;},confirm(){return true;},console};
 vm.createContext(context);const source=fs.readFileSync(new URL('../dist/app.js',import.meta.url),'utf8').replace(/^import[^\n]+\n/gm,'');
 vm.runInContext(source+'\nthis.api={stats,useRecognitionMode,recognitionAvailable,browserContext,filteredWords,sortPracticeCards,showPracticeScore,openChallengeHistory,renderChallengeHistory,selectLesson,testMicrophone,record,cancelRecording,startChallenge,updateTimer,updateCountdown,answerChallenge,finishChallenge,challengeSetup,historyHtml,speak,list,displayHeard,errorMessage,practiceFace,setReady:()=>micReady=true,setMode,listenQuick,applyMeaning,state:()=>({challenge,data,active,lesson,words,recognitionMode,localSpeechInput}),seedHistory:(h)=>data.history[0]=h};',context);
 return {api:context.api,nodes,getSaved:key=>storage.get(key),recognition:()=>recognizer,advance(ms){now+=ms;interval?.();},stored:()=>stored,spoken:()=>spoken,start(){context.api.setReady();context.api.startChallenge();now+=3000;context.api.updateCountdown();},flush(){timeouts.splice(0).forEach(fn=>fn());}};
}
test('three-second countdown does not consume challenge time',()=>{const h=harness();h.api.setReady();h.api.startChallenge();assert.equal(h.api.state().challenge.phase,'countdown');h.advance(2000);assert.equal(h.api.state().challenge.phase,'countdown');assert.equal(h.nodes.get('#countdown-number').textContent,'1');h.advance(1000);assert.equal(h.api.state().challenge.phase,'running');h.advance(59000);assert.equal(h.api.state().challenge.phase,'running');h.advance(1000);assert.equal(h.api.state().challenge.phase,'done');});
test('microphone permission failure releases UI and permits retry',()=>{const h=harness();let error;h.api.record(words[0],{onResult(){assert.fail();},onError:m=>error=m});h.recognition().onerror({error:'not-allowed'});h.recognition().onend();assert.match(error,/許可/);assert.equal(h.api.state().active,null);h.api.record(words[0],{onResult(){}});assert.ok(h.api.state().active);h.api.cancelRecording();assert.equal(h.api.state().active,null);});
test('all ten words are displayed and an unanswered round gives 0/100',()=>{const h=harness();h.start();const c=h.api.state().challenge;assert.equal(new Set(c.items.map(w=>w.id)).size,10);assert.equal((h.nodes.get('#challenge-content').innerHTML.match(/data-challenge-item=/g)||[]).length,10);h.api.finishChallenge();assert.equal(h.stored().challenges[0].score,0);});
test('sprint retry keeps the best score and records every attempt',()=>{const h=harness();h.start();const w=h.api.state().challenge.items[7];h.api.answerChallenge(7);h.recognition().onresult({results:[[{transcript:w.say}]]});assert.equal(h.api.state().data.attempts,1);assert.equal(h.api.state().challenge.results[7].score,100);assert.match(h.nodes.get('#challenge-content').innerHTML,/再挑戦/);h.api.answerChallenge(7);h.recognition().onresult({results:[[{transcript:'wrong answer'}]]});assert.equal(h.api.state().data.attempts,2);assert.equal(h.api.state().challenge.results[7].score,100);assert.ok(h.api.state().challenge.lastResults[7].score<100);h.api.finishChallenge();assert.equal(h.stored().challenges[0].score,10);});
test('wall-clock expiry ignores late speech and only saves one result',()=>{const h=harness();h.start();h.api.answerChallenge(0);const late=h.recognition().onresult;h.advance(61000);late({results:[[{transcript:'nearly'}]]});assert.equal(h.stored().challenges[0].score,0);assert.equal(h.api.state().data.attempts,0);h.api.updateTimer();assert.equal(h.api.state().data.challenges.length,1);});
test('network failure cancels round without storing a challenge result',()=>{const h=harness();h.start();h.api.answerChallenge(0);h.recognition().onerror({error:'network'});h.recognition().onend();assert.equal(h.api.state().challenge,null);assert.equal(h.api.state().data.challenges.length,0);assert.match(h.nodes.get('#challenge-content').innerHTML,/チャレンジを中止/);});
test('history shows the latest five scores in chronological order',()=>{const h=harness();h.api.seedHistory([20,40,60,75,80,100].map(score=>({score})));const html=h.api.historyHtml(words[0]);assert.doesNotMatch(html,/>20</);assert.match(html,/>40<.*>60<.*>75<.*>80<.*>100</);assert.equal((html.match(/class="arrow"/g)||[]).length,4);});
test('model audio uses normal playback speed',()=>{const h=harness();h.api.speak(words[0],1);assert.equal(h.spoken().id,0);});
test('certificate contains ten scores, identity fields and Japan timestamp',()=>{const h=harness();h.start();h.advance(61000);const html=h.nodes.get('#challenge-content').innerHTML;assert.match(html,/発音スプリント 認定証/);assert.match(html,/2026\/11\/03 18:01:04/);assert.doesNotMatch(html,/実施日時|日本時間/);assert.match(html,/チャレンジャー/);assert.match(html,/cert-name/);assert.match(html,/cert-group/);assert.equal((html.match(/class="cert-row"/g)||[]).length,10);});
test('microphone RMS distinguishes silence from actual input samples',()=>{assert.equal(rmsLevel(new Uint8Array(512).fill(128)),0);assert.ok(rmsLevel(new Uint8Array(512).fill(150))>.018);});

test('all vocabulary is rendered without page controls',()=>{const h=harness();assert.equal((h.nodes.get('#word-list').innerHTML.match(/class="word-card"/g)||[]).length,32);assert.doesNotMatch(h.nodes.get('#word-list').innerHTML,/data-action="slow"/);});
test('quick mode hides the English answer, counts correct words and advances',()=>{const h=harness();h.api.setMode('quick');h.start();const c=h.api.state().challenge;assert.equal(c.type,'quick');assert.equal(c.items.length,32);assert.match(h.nodes.get('#challenge-content').innerHTML,/quick-prompt/);assert.doesNotMatch(h.nodes.get('#challenge-content').innerHTML,new RegExp(c.items[0].say));const rec=h.recognition();rec.onresult({resultIndex:0,results:[[{transcript:c.items[0].say}]]});assert.equal(c.correct,1);assert.equal(c.index,1);rec.onresult({resultIndex:0,results:[[{transcript:'duplicate'}]]});assert.equal(c.correct,1);assert.equal(c.index,1);h.api.finishChallenge();assert.equal(h.api.state().data.quickBest,1);assert.equal(h.api.state().data.challenges.length,0);assert.match(h.nodes.get('#challenge-content').innerHTML,/日→英ワードラッシュ 認定証/);});
test('quick skip never awards a point and wrong answers stay on the prompt',()=>{const h=harness();h.api.setMode('quick');h.start();const c=h.api.state().challenge;h.recognition().onresult({resultIndex:0,results:[[{transcript:'completely different answer'}]]});assert.equal(c.correct,0);assert.equal(c.index,0);h.nodes.get('#quick-skip').onclick();assert.equal(c.index,1);assert.equal(c.correct,0);assert.equal(c.results[0].skipped,true);h.api.finishChallenge();});

test('voice skip advances without recording a wrong attempt',()=>{const h=harness();h.api.setMode('quick');h.start();const c=h.api.state().challenge;h.recognition().onresult({resultIndex:0,results:[[{transcript:'Skip.'}]]});assert.equal(c.index,1);assert.equal(c.correct,0);assert.equal(c.results[0].skipped,true);assert.equal(c.results[0].heard,'skip');assert.equal(h.api.state().data.attempts,0);h.api.finishChallenge();});
test('correct rush answers display the English word in a victory overlay',()=>{const h=harness();h.api.setMode('quick');h.start();const c=h.api.state().challenge;h.recognition().onresult({resultIndex:0,results:[[{transcript:c.items[0].say}]]});assert.ok(c.blockUntil>0);assert.equal(c.correct,1);h.api.finishChallenge();assert.match(h.nodes.get('#quick-best').innerHTML,/1/);});

test('a better sprint retry replaces the word score without adding a second slot',()=>{const h=harness();h.start();const c=h.api.state().challenge,w=c.items[2];h.api.answerChallenge(2);h.recognition().onresult({results:[[{transcript:'incorrect'}]]});const first=c.results[2].score;h.api.answerChallenge(2);h.recognition().onresult({results:[[{transcript:w.say}]]});assert.ok(c.results[2].score>first);assert.equal(c.results.filter(Boolean).length,1);assert.equal(h.api.state().data.attempts,2);h.api.finishChallenge();assert.equal(h.stored().challenges[0].score,10);});
test('100 sprint points finish immediately and save exactly one round',()=>{const h=harness();h.start();const c=h.api.state().challenge;for(let i=0;i<10;i++){h.api.answerChallenge(i);h.recognition().onresult({results:[[{transcript:c.items[i].say}]]});}assert.equal(c.phase,'done');assert.equal(h.api.state().data.attempts,10);assert.equal(h.stored().challenges.length,1);assert.equal(h.stored().challenges[0].score,100);assert.equal(h.api.state().active,null);h.advance(61000);h.api.finishChallenge();assert.equal(h.stored().challenges.length,1);});
test('ten answers below 100 still allow retry, and reaching 100 on retry finishes',()=>{const h=harness();h.start();const c=h.api.state().challenge;for(let i=0;i<10;i++){h.api.answerChallenge(i);h.recognition().onresult({results:[[{transcript:i===0?'incorrect':c.items[i].say}]]});}assert.equal(c.phase,'running');h.api.answerChallenge(0);h.recognition().onresult({results:[[{transcript:c.items[0].say}]]});assert.equal(c.phase,'done');assert.equal(h.stored().challenges[0].score,100);});
test('practice recognition text is lowercase for new and existing results',()=>{const h=harness();assert.equal(h.api.displayHeard('Victim'),'victim');h.api.seedHistory([{score:100,heard:'Victim'}]);h.api.list();assert.match(h.nodes.get('#word-list').innerHTML,/認識：victim/);assert.doesNotMatch(h.nodes.get('#word-list').innerHTML,/認識：Victim/);assert.equal(h.api.state().data.history[0][0].heard,'Victim');});

test('iPad microphone test shows a live volume bar and releases the meter before countdown',()=>{
 let onLevel,stops=0;
 class Meter{constructor(level){onLevel=level;}start(){}stop(){stops++;}}
 const h=harness({navigator:{userAgent:'iPad'},Meter});
 h.api.setMode('challenge');h.api.testMicrophone();
 assert.equal(h.nodes.get('#meter-panel').hidden,false);
 assert.equal(h.nodes.get('#begin-challenge').disabled,true);
 assert.equal(h.recognition(),undefined);
 onLevel(0);assert.equal(h.nodes.get('#mic-level').style.width,'0%');
 onLevel(.1);assert.equal(h.nodes.get('#mic-level').style.width,'45%');
 assert.equal(h.nodes.get('#begin-challenge').disabled,false);
 assert.doesNotMatch(h.nodes.get('#test-status').textContent,/nearly/);
 h.api.startChallenge();assert.equal(stops,1);assert.equal(h.api.state().challenge.phase,'countdown');
 h.advance(3000);h.api.answerChallenge(0);assert.ok(h.recognition());
 h.api.finishChallenge();
});

test('lesson tabs change all counts, Part filters and certificate labels',()=>{
 const h=harness();
 for(const lesson of lessons){
  h.api.selectLesson(lesson.id);
  assert.equal(h.api.state().lesson.id,lesson.id);
  assert.equal((h.nodes.get('#word-list').innerHTML.match(/class="word-card"/g)||[]).length,lesson.words.length);
  assert.match(h.nodes.get('#mastered').innerHTML,new RegExp('/ '+lesson.words.length));
  h.api.setMode('challenge');h.start();const c=h.api.state().challenge;
  assert.equal(c.items.length,10);
  assert.ok(c.items.every(w=>lesson.words.includes(w)));
  h.api.finishChallenge();assert.match(h.nodes.get('#challenge-content').innerHTML,new RegExp('LESSON '+String(lesson.id).padStart(2,'0')));
  h.api.setMode('practice');
 }
});
test('lesson scores remain independent across switches and survive reload',()=>{
 const h=harness();h.api.setMode('challenge');h.start();h.api.answerChallenge(0);
 h.recognition().onresult({results:[[{transcript:h.api.state().challenge.items[0].say}]]});h.api.finishChallenge();
 assert.equal(h.api.state().data.challengeBest,10);
 h.api.selectLesson(1);assert.equal(h.api.state().data.challengeBest,null);assert.equal(h.api.state().data.attempts,0);
 h.api.selectLesson(7);assert.equal(h.api.state().data.challengeBest,10);assert.equal(h.api.state().data.attempts,1);
 const reload=harness({saved:{[LESSON_KEY]:'6'}});assert.equal(reload.api.state().lesson.id,6);
 assert.equal((reload.nodes.get('#word-list').innerHTML.match(/class="word-card"/g)||[]).length,29);
});
test('rush ends at each tested lesson length, including new Lessons 8–10',()=>{
 for(const lessonId of [1,5,6,8,9,10]){
  const h=harness();h.api.selectLesson(lessonId);h.api.setMode('quick');h.start();const c=h.api.state().challenge;
  assert.equal(c.items.length,getLesson(lessonId).words.length);
  assert.match(h.nodes.get('#challenge-content').innerHTML,new RegExp('/ '+c.items.length));
  for(let i=0;i<c.items.length;i++)h.nodes.get('#quick-skip').onclick();
  assert.equal(c.phase,'done');assert.equal(c.index,c.items.length);
  assert.match(h.nodes.get('#challenge-content').innerHTML,new RegExp('語正解 / '+c.items.length+'語'));
 }
});

test('mastery crown needs every word at 90, and sprint crown needs a best of 100',()=>{
 const h=harness();h.api.selectLesson(5);const {data,words}=h.api.state();
 data.bestScores=Object.fromEntries(words.map(w=>[w.id,90]));data.bestScores[words[0].id]=89;data.challengeBest=99;h.api.stats();
 assert.doesNotMatch(h.nodes.get('#mastered').innerHTML,/achievement-crown/);
 assert.doesNotMatch(h.nodes.get('#best').innerHTML,/achievement-crown/);
 data.bestScores[words[0].id]=90;h.api.stats();
 assert.match(h.nodes.get('#mastered').innerHTML,/全単語マスター/);
 assert.doesNotMatch(h.nodes.get('#best').innerHTML,/achievement-crown/);
 data.challengeBest=100;h.api.stats();assert.match(h.nodes.get('#best').innerHTML,/発音スプリント100点達成/);
});
test('lesson tab crowns survive reload, stay separate by lesson and clear on reset',()=>{
 const complete={history:{},challenges:[],bestScores:Object.fromEntries(getLesson(1).words.map(w=>[w.id,90]))};
 const sprint={history:{},challenges:[],bestScores:{},challengeBest:100};
 const h=harness({saved:{'pronunciation-lab-lesson1-v1':JSON.stringify(complete),'pronunciation-lab-lesson2-v1':JSON.stringify(sprint)}});
 const tab=id=>h.nodes.get('#lesson-tabs').innerHTML.match(new RegExp('data-lesson="'+id+'"[\\s\\S]*?</button>'))[0];
 assert.match(tab(1),/全単語マスター/);assert.doesNotMatch(tab(1),/発音スプリント100点達成/);
 assert.match(tab(2),/発音スプリント100点達成/);assert.doesNotMatch(tab(2),/全単語マスター/);
 assert.doesNotMatch(tab(7),/achievement-crown/);
 h.api.selectLesson(1);h.nodes.get('#reset').onclick();assert.doesNotMatch(tab(1),/achievement-crown/);assert.match(tab(2),/発音スプリント100点達成/);
});

test('rush rounds are recorded once, include zero and remain separate from sprint history',()=>{
 const h=harness();h.api.setMode('quick');h.start();h.api.finishChallenge();h.api.finishChallenge();
 assert.equal(h.api.state().data.quickChallenges.length,1);assert.equal(h.api.state().data.quickChallenges[0].score,0);assert.equal(h.api.state().data.challenges.length,0);
 h.api.openChallengeHistory('quick');assert.match(h.nodes.get('#history-content').innerHTML,/0<\/strong> 語/);assert.match(h.nodes.get('#history-content').innerHTML,/2026\/11\/03/);
 h.api.selectLesson(1);assert.equal(h.api.state().data.quickChallenges.length,0);h.api.selectLesson(7);assert.equal(h.api.state().data.quickChallenges.length,1);
});

test('rush certificate shows the current round rank, keeps date and omits redundant labels',()=>{
 for(const [score,name] of [[3,'チャレンジャー'],[4,'ルーキー'],[7,'エキスパート'],[10,'マスター'],[13,'レジェンド']]){
  const h=harness();h.api.setMode('quick');h.start();const {challenge:c,data}=h.api.state();data.quickBest=20;c.correct=score;c.items.slice(0,score).forEach((w,i)=>c.results[i]={score:100,heard:w.say});h.api.finishChallenge();
  const html=h.nodes.get('#challenge-content').innerHTML;
  assert.match(html,new RegExp(`称号：${name}`));assert.match(html,/BEST 20/);assert.match(html,/2026\/11\/03 18:00:03/);assert.doesNotMatch(html,/実施日時|日本時間|日本語を見て、/);
 }
});
test('sprint certificate rank is based on this round rather than the saved best',()=>{
 const h=harness();h.start();const {challenge:c,data}=h.api.state();data.challengeBest=100;c.results=c.items.map(w=>({score:50,heard:w.say}));h.api.finishChallenge();const html=h.nodes.get('#challenge-content').innerHTML;assert.match(html,/称号：ルーキー/);assert.match(html,/BEST 100/);assert.doesNotMatch(html,/称号：レジェンド/);
});

test('perfect sprint time excludes countdown, appears on certificate and history, and survives reload',()=>{
 const h=harness();h.start();const c=h.api.state().challenge;
 h.advance(23456);
 for(let i=0;i<10;i++){h.api.answerChallenge(i);h.recognition().onresult({results:[[{transcript:c.items[i].say}]]});}
 const stored=h.stored();assert.equal(stored.challenges[0].elapsedMs,23456);assert.match(h.nodes.get('#challenge-content').innerHTML,/cert-time.*23\.5/);
 h.api.openChallengeHistory('sprint');assert.match(h.nodes.get('#history-content').innerHTML,/100点達成/);assert.match(h.nodes.get('#history-content').innerHTML,/23\.5秒/);
 const restored=harness({saved:{'pronunciation-lab-lesson7-v1':JSON.stringify(stored)}});restored.api.openChallengeHistory('sprint');assert.match(restored.nodes.get('#history-content').innerHTML,/23\.5秒/);
});
test('incomplete sprint and older perfect scores never invent completion times',()=>{
 const h=harness({saved:{'pronunciation-lab-lesson7-v1':JSON.stringify({history:{},challenges:[{score:100,date:'2026-11-03T09:00:00Z'},{score:50,date:'2026-11-03T09:00:00Z',elapsedMs:1000},{score:100,date:'2026-11-03T09:00:00Z',elapsedMs:-1}]})}});
 h.start();h.advance(61000);assert.equal(h.stored().challenges.at(-1).elapsedMs,undefined);assert.doesNotMatch(h.nodes.get('#challenge-content').innerHTML,/cert-time/);h.api.openChallengeHistory('sprint');assert.doesNotMatch(h.nodes.get('#history-content').innerHTML,/\d\.\d秒/);
 h.api.openChallengeHistory('quick');assert.doesNotMatch(h.nodes.get('#history-content').innerHTML,/100点達成/);
});

test('practice places phonetics beside meanings and challenge prompts keep English answers hidden',()=>{
 const h=harness();const html=h.nodes.get('#word-list').innerHTML;assert.match(html,/word-reading"><p class="meaning"[^>]*>ほとんど<\/p><span class="phonetic"[^>]*>\/níərli\//);assert.equal((html.match(/class="phonetic"/g)||[]).length,32);
 h.api.selectLesson(1);assert.match(h.nodes.get('#word-list').innerHTML,/túərizm/);h.api.setMode('quick');h.start();assert.doesNotMatch(h.nodes.get('#challenge-content').innerHTML,/class="phonetic"/);
});

test('microphone permission advice consistently refers to browser settings',()=>{const h=harness();for(const code of ['not-allowed']){assert.match(h.api.errorMessage(code),/ブラウザの設定を確認してください/);assert.doesNotMatch(h.api.errorMessage(code),/Safari|Siri/);}});
test('practice retains the same speaking icon for unpractised and perfect-score words',()=>{const h=harness();const html=h.nodes.get('#word-list').innerHTML;assert.match(html,/data-practice-face="speaking"/);assert.doesNotMatch(html,/> 発音<\/button>/);h.api.state().data.history[0]=[{score:100,heard:'nearly'}];h.api.list();assert.match(h.nodes.get('#word-list').innerHTML,/nearlyを発音する[^>]*>.*?data-practice-face="speaking"/);assert.doesNotMatch(h.nodes.get('#word-list').innerHTML,/data-practice-face="smile"/);assert.match(h.api.practiceFace(),/speaking/);});

test('iPad sprint accepts successive words using one native connection',()=>{
 const h=harness({navigator:{platform:'MacIntel',maxTouchPoints:5}});h.start();const c=h.api.state().challenge;
 for(let i=0;i<3;i++){
  h.api.answerChallenge(i);const rec=h.recognition();assert.equal(rec.continuous,true);rec.onresult({results:[[{transcript:c.items[i].say}]]});
  assert.equal(h.api.state().active,null);assert.equal(c.results[i].score,100);
 }
 assert.equal(h.api.state().data.attempts,3);h.api.finishChallenge();
});

test('recognition errors distinguish timeout, OS no-speech and empty completion',()=>{const h=harness();assert.match(h.api.errorMessage('recognition-timeout'),/結果が返りません/);assert.match(h.api.errorMessage('no-result'),/結果を返さず終了/);assert.match(h.api.errorMessage('no-speech'),/サービスで発話を検出できません/);h.nodes.get('#show-speech-status').onclick();assert.equal(h.nodes.get('#speech-diagnostics').open,true);});

test('unsupported native speech can enable local practice and both challenges without native API',()=>{const h=harness({nativeRecognition:false});assert.equal(h.api.recognitionAvailable(),false);h.api.state().localSpeechInput.model={};assert.equal(h.api.useRecognitionMode('local'),true);assert.equal(h.api.recognitionAvailable(),true);h.api.list();assert.doesNotMatch(h.nodes.get('#word-list').innerHTML,/<button class="icon mic"[^>]*disabled/);h.api.setMode('challenge');h.api.setReady();h.api.challengeSetup();assert.doesNotMatch(h.nodes.get('#challenge-content').innerHTML,/id="begin-challenge" disabled/);h.api.setMode('quick');h.api.setReady();h.api.challengeSetup();assert.doesNotMatch(h.nodes.get('#challenge-content').innerHTML,/id="begin-challenge" disabled/);});
test('Safari keeps native mode by default while other iPad contexts get compatibility guidance',()=>{for(const [ua,context] of [['Version/27.0 Mobile Safari/605.1.15','safari'],['CriOS/155.0 Mobile Safari/604.1','chrome'],['LoiLoNote Mobile','embedded']]){const h=harness({navigator:{platform:'MacIntel',maxTouchPoints:5,userAgent:ua}});assert.equal(h.api.browserContext(),context);assert.equal(h.api.state().recognitionMode,'native');assert.equal(h.api.state().localSpeechInput.ready,false);if(context==='safari')assert.equal(h.nodes.has('#recognition-notice'),false);else assert.equal(h.nodes.get('#recognition-notice').hidden,false);}});

test('top compatibility switch toggles both engines without a settings dialog',async()=>{const h=harness(),local=h.api.state().localSpeechInput;local.model={};const button=h.nodes.get('#recognition-toggle');await button.onclick();assert.equal(h.api.state().recognitionMode,'local');assert.equal(h.nodes.get('#recognition-toggle-state').textContent,'ON');assert.equal(h.nodes.has('#recognition-dialog'),false);button.onclick();assert.equal(h.api.state().recognitionMode,'native');assert.equal(h.nodes.get('#recognition-toggle-state').textContent,'OFF');assert.doesNotMatch(h.nodes.get('#word-list').innerHTML,/<small>待機<\/small>/);});
test('switching off during preparation prevents a late load from changing engines',async()=>{const h=harness(),local=h.api.state().localSpeechInput;let finish;local.prepare=()=>new Promise(resolve=>finish=resolve);const button=h.nodes.get('#recognition-toggle'),loading=button.onclick();assert.equal(h.nodes.get('#recognition-toggle-state').textContent,'準備中');button.onclick();assert.equal(h.nodes.get('#recognition-toggle-state').textContent,'OFF');local.model={};finish();await loading;assert.equal(h.api.state().recognitionMode,'native');assert.equal(h.nodes.get('#recognition-notice').hidden,true);});
test('preparation failure restores the off switch and allows retry',async()=>{const h=harness(),local=h.api.state().localSpeechInput;local.prepare=async()=>{throw Error('test download failure');};await h.nodes.get('#recognition-toggle').onclick();assert.equal(h.nodes.get('#recognition-toggle-state').textContent,'OFF');assert.match(h.nodes.get('#recognition-notice-text').textContent,/test download failure/);assert.equal(h.api.state().recognitionMode,'native');});
test('compatibility switch cannot replace the engine during a challenge',async()=>{const h=harness();h.start();await h.nodes.get('#recognition-toggle').onclick();assert.equal(h.api.state().recognitionMode,'native');assert.equal(h.nodes.get('#recognition-toggle-state').textContent,'OFF');h.api.finishChallenge();});
test('cancelling compatibility preparation preserves the working native iPad connection',async()=>{const h=harness({navigator:{platform:'MacIntel',maxTouchPoints:5,userAgent:'Version/27.0 Mobile Safari/605.1.15'}});h.api.record(words[0],{onResult(){}});const rec=h.recognition();rec.onresult({resultIndex:0,results:[[{transcript:'nearly'}]]});let finish;h.api.state().localSpeechInput.prepare=()=>new Promise(resolve=>finish=resolve);const button=h.nodes.get('#recognition-toggle'),loading=button.onclick();button.onclick();finish();await loading;h.api.record(words[1],{onResult(){}});assert.equal(h.recognition(),rec);h.api.cancelRecording();});

test('local practice, sprint and rush receive the full lesson context rather than only the expected word',()=>{const h=harness(),local=h.api.state().localSpeechInput;local.model={};h.api.useRecognitionMode('local');const starts=[];local.start=options=>{starts.push(options);return true;};h.api.record(words[0],{onResult(){}});assert.equal(starts.at(-1).vocabulary.length,32);assert.ok(starts.at(-1).vocabulary.some(w=>w.say==='Dutch'));h.start();h.api.answerChallenge(0);assert.equal(starts.at(-1).vocabulary.length,32);h.api.finishChallenge();h.api.setMode('quick');h.start();assert.equal(starts.at(-1).continuous,true);assert.equal(starts.at(-1).vocabulary.length,32);h.api.finishChallenge();});

test('Safari returns once to native text recognition without altering saved practice or certificates',()=>{const saved=JSON.stringify({history:{0:[{score:90,heard:'nearly',date:'2026-11-01T00:00:00Z'}]},bestScores:{0:90},attempts:1,challenges:[{score:100,date:'2026-11-01T00:00:00Z',elapsedMs:25000}],profile:{name:'Test Student',class:'3',number:'12'}});const h=harness({navigator:{platform:'MacIntel',maxTouchPoints:5,userAgent:'Version/27.0 Mobile Safari/605.1.15'},saved:{'pronunciation-lab-recognition-safari':'local','pronunciation-lab-lesson7-v1':saved}});assert.equal(h.api.state().recognitionMode,'native');assert.equal(h.api.state().localSpeechInput.ready,false);assert.equal(h.getSaved('pronunciation-lab-recognition-safari'),'native');assert.equal(h.getSaved('pronunciation-lab-safari-native-default-v1'),'1');assert.equal(h.getSaved('pronunciation-lab-lesson7-v1'),saved);assert.match(h.nodes.get('#lesson-footer').textContent,/標準認識/);let connection;for(const w of words.slice(0,3)){let result;h.api.record(w,{onResult:r=>result=r});const rec=h.recognition();if(connection)assert.equal(rec,connection);connection=rec;rec.onresult({resultIndex:0,results:[[{transcript:w.say}]]});assert.equal(result.score,100);}});
test('desktop Safari also returns to native recognition',()=>{const h=harness({navigator:{platform:'MacIntel',maxTouchPoints:0,userAgent:'Version/27.0 Safari/605.1.15'},saved:{'pronunciation-lab-recognition-desktop':'local'}});assert.equal(h.api.state().recognitionMode,'native');assert.equal(h.getSaved('pronunciation-lab-recognition-desktop'),'native');});
test('later explicit choices, Chrome, standalone and Safari without native API retain their compatibility option',async()=>{const prepare=LocalSpeechInput.prototype.prepare;LocalSpeechInput.prototype.prepare=async function(){this.model={};};try{const ipad={platform:'MacIntel',maxTouchPoints:5,userAgent:'Version/27.0 Mobile Safari/605.1.15'};for(const config of [{navigator:ipad,key:'safari',saved:{'pronunciation-lab-safari-native-default-v1':'1'}},{navigator:{...ipad,userAgent:'CriOS/155.0 Mobile Safari/604.1'},key:'chrome'},{navigator:{...ipad,standalone:true},key:'standalone'},{navigator:ipad,key:'safari',nativeRecognition:false}]){const h=harness({...config,saved:{...config.saved,['pronunciation-lab-recognition-'+config.key]:'local'}});await new Promise(setImmediate);assert.equal(h.api.state().recognitionMode,'local');assert.match(h.nodes.get('#lesson-footer').textContent,/互換認識/);}}finally{LocalSpeechInput.prototype.prepare=prepare;}});


test('native and compatibility practice score the displayed transcript identically',()=>{
 for(const heard of ['SUNGLASSES','millimeter','Dutch','wrong answer']){
  const results=[];
  for(const engine of ['native','local']){
   const h=harness();let submit;
   if(engine==='local'){
    const local=h.api.state().localSpeechInput;local.model={};h.api.useRecognitionMode('local');
    local.start=options=>{submit=options.onTranscript;return true;};
   }
   const target={say:'sunglasses'};
   h.api.record(target,{onResult:r=>results.push(r)});
   if(engine==='native')h.recognition().onresult({results:[[{transcript:heard}]]});else submit(heard);
  }
  assert.equal(results.length,2);
  assert.equal(results[0].heard,heard.toLowerCase());
  assert.equal(results[1].heard,results[0].heard);
  assert.equal(results[1].score,results[0].score);
  assert.equal(results[1].score,scoreWord('sunglasses',results[1].heard));
  if(heard==='SUNGLASSES')assert.equal(results[1].score,100);
  else assert.ok(results[1].score<100);
 }
});
test('compatibility sprint and rush award full credit for an exact transcript',()=>{
 for(const mode of ['challenge','quick']){
  const h=harness(),local=h.api.state().localSpeechInput;let submit;
  local.model={};h.api.useRecognitionMode('local');
  local.start=options=>{submit=options.onTranscript;return true;};
  h.api.setMode(mode);h.start();const c=h.api.state().challenge,w=c.items[0];
  if(mode==='challenge')h.api.answerChallenge(0);
  submit(w.say.toUpperCase());
  assert.equal(c.results[0].score,100);
  assert.equal(c.results[0].heard,w.say.toLowerCase());
  if(mode==='quick')assert.equal(c.correct,1);
  h.api.finishChallenge();
 }
});
