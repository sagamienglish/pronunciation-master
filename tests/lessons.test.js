import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {lessons,getLesson} from '../dist/lessons.js';
import {words as oldLesson7} from '../dist/vocabulary.js';
import {emptyProgress,progressKey,readProgress,writeProgress,PROFILE_KEY} from '../dist/progress.js';

function storage(seed={}){const map=new Map(Object.entries(seed));return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};}
const counts=[[13,12,8],[13,10,9],[10,11,11],[16,7,8],[7,12,9],[12,9,8],[9,11,12],[10,8,10],[9,7,13],[15,9,12]];
test('ten lessons match the printed Part boundaries and keep unique local IDs',()=>{
 assert.deepEqual(lessons.map(l=>l.id),[1,2,3,4,5,6,7,8,9,10]);
 for(const l of lessons){
  assert.deepEqual([1,2,3].map(part=>l.words.filter(w=>w.part===part).length),counts[l.id-1],l.name);
  assert.deepEqual(l.words.map(w=>w.id),Array.from({length:l.words.length},(_,id)=>l.id===5&&id>=19?id+1:l.id===8&&id>=22?id+2:id));
  assert.equal(new Set(l.words.map(w=>w.en)).size,l.words.length);
  for(const w of l.words){assert.ok(w.ja&&w.pos&&w.say,w.en);assert.doesNotMatch(w.say,/[.…～/()]/,w.en);}
 }
 assert.equal(lessons.reduce((n,l)=>n+l.words.length,0),310);
 assert.equal(getLesson(11),undefined);
});
test('Other words is excluded while all regular Part 1 entries in Lesson 6 remain',()=>{
 assert.ok(!getLesson(1).words.some(w=>w.en==='among'));
 for(const en of ['percentage','rate','naturally'])assert.equal(getLesson(6).words.find(w=>w.en===en)?.part,1);
 assert.deepEqual(getLesson(7).words,oldLesson7);
 assert.ok(!getLesson(5).words.some(w=>w.en==='Mfuwe Village'));
 const zambia=getLesson(5).words.find(w=>w.en==='Zambia');
 assert.equal(zambia.id,20);assert.equal(zambia.audio,'lesson-5/20');
});
test('each lesson has a nonempty model recording without changing Lesson 7 paths',()=>{
 for(const l of lessons)for(const w of l.words){
  const b=fs.readFileSync(new URL(`../dist/audio/${w.audio??w.id}.wav`,import.meta.url));
  assert.equal(b.subarray(0,4).toString(),'RIFF',`${l.name}: ${w.en}`);
  assert.equal(b.subarray(8,12).toString(),'WAVE');assert.ok(b.length>5000,w.en);
 }
});
test('old Lesson 7 scores migrate unchanged, and profiles are shared across lessons',()=>{
 const legacy={...emptyProgress({name:'Student',group:'2組 15番'}),history:{0:[{score:75,heard:'Nearly'}]},challengeBest:60,quickBest:12};
 const s=storage({[progressKey(7)]:JSON.stringify(legacy)});
 const seven=readProgress(s,7,getLesson(7).words);
 assert.equal(seven.history[0][0].heard,'Nearly');assert.equal(seven.bestScores[0],75);
 assert.equal(seven.challengeBest,60);assert.equal(seven.quickBest,12);
 const one=readProgress(s,1,getLesson(1).words);assert.equal(one.profile.name,'Student');assert.deepEqual(one.history,{});
 one.history[0]=[{score:100,heard:'tourism'}];one.quickBest=33;one.profile.name='Updated';writeProgress(s,1,one);
 assert.equal(readProgress(s,1,getLesson(1).words).quickBest,33);
 const restored=readProgress(s,7,getLesson(7).words);
 assert.equal(restored.history[0][0].score,75);assert.equal(restored.quickBest,12);assert.equal(restored.profile.name,'Updated');
 assert.equal(JSON.parse(s.getItem(PROFILE_KEY)).classNo,'2');
});
test('broken saved progress falls back safely and out-of-range rush scores are rejected',()=>{
 const s=storage({[progressKey(1)]:'{broken'});
 assert.equal(readProgress(s,1,getLesson(1).words).attempts,0);
 const data=emptyProgress();data.quickBest=33;writeProgress(s,6,data);
 assert.equal(readProgress(s,6,getLesson(6).words).quickBest,0);
});

test('removing a word keeps following words attached to their original history',()=>{
 const s=storage();const data=emptyProgress();
 data.history={19:[{score:100,heard:'Mfuwe Village'}],20:[{score:75,heard:'Zambia'}]};
 writeProgress(s,5,data);const restored=readProgress(s,5,getLesson(5).words);
 assert.equal(restored.history[19],undefined);assert.equal(restored.history[20][0].heard,'Zambia');assert.equal(restored.bestScores[20],75);
});

test('rush history migrates safely and retains the latest fifty dated rounds',()=>{
 const s=storage();const data=emptyProgress();data.quickBest=1;
 data.quickChallenges=Array.from({length:55},(_,i)=>({score:i%20,date:new Date(Date.UTC(2026,10,3,0,i)).toISOString()}));
 writeProgress(s,7,data);const restored=readProgress(s,7,getLesson(7).words);
 assert.equal(restored.quickChallenges.length,50);assert.equal(restored.quickChallenges[0].date,data.quickChallenges[5].date);assert.equal(restored.quickBest,19);
 const legacy=emptyProgress();delete legacy.quickChallenges;legacy.quickBest=12;s.setItem(progressKey(7),JSON.stringify(legacy));
 const migrated=readProgress(s,7,getLesson(7).words);assert.deepEqual(migrated.quickChallenges,[]);assert.equal(migrated.quickBest,12);
});

test('new lessons match the supplied parts, Japanese parts of speech and textbook themes',()=>{
 for(const id of [8,9,10])for(const word of getLesson(id).words)assert.match(word.pos,/^(名詞|動詞|形容詞|副詞|代名詞|表現)$/);
 assert.deepEqual([8,9,10].map(id=>getLesson(id).theme),['purple','green','orange']);
 assert.ok(!getLesson(8).words.some(w=>['dish','coat','thick','practice'].includes(w.en)));
 assert.equal(getLesson(8).words.find(w=>w.en==='sustainably').part,3);
 assert.equal(getLesson(9).words.find(w=>w.en==='teamwork').part,3);
 assert.equal(getLesson(10).words.find(w=>w.en==='now and then').part,3);
});

test('removed Lesson 8 names leave following word IDs and scores unchanged',()=>{
 const lesson=getLesson(8);assert.ok(!lesson.words.some(w=>['Grand Banks','Newfoundland'].includes(w.en)));
 const shore=lesson.words.find(w=>w.en==='shore');assert.equal(shore.id,24);assert.equal(shore.audio,'lesson-8/24');
 const data=emptyProgress();data.history={22:[{score:100,heard:'Grand Banks'}],24:[{score:75,heard:'shore'}]};const s=storage();writeProgress(s,8,data);const restored=readProgress(s,8,lesson.words);assert.equal(restored.history[22],undefined);assert.equal(restored.bestScores[24],75);
});
