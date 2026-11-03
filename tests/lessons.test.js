import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {lessons,getLesson} from '../dist/lessons.js';
import {words as oldLesson7} from '../dist/vocabulary.js';
import {emptyProgress,progressKey,readProgress,writeProgress,PROFILE_KEY} from '../dist/progress.js';

function storage(seed={}){const map=new Map(Object.entries(seed));return {getItem:key=>map.get(key)??null,setItem:(key,value)=>map.set(key,value)};}
const counts=[[13,12,8],[13,10,9],[10,11,11],[16,7,8],[7,12,10],[12,9,8],[9,11,12]];
test('seven lessons match the printed Part boundaries and keep unique local IDs',()=>{
 assert.deepEqual(lessons.map(l=>l.id),[1,2,3,4,5,6,7]);
 for(const l of lessons){
  assert.deepEqual([1,2,3].map(part=>l.words.filter(w=>w.part===part).length),counts[l.id-1],l.name);
  assert.deepEqual(l.words.map(w=>w.id),Array.from({length:l.words.length},(_,id)=>id));
  assert.equal(new Set(l.words.map(w=>w.en)).size,l.words.length);
  for(const w of l.words){assert.ok(w.ja&&w.pos&&w.say,w.en);assert.doesNotMatch(w.say,/[.…～/()]/,w.en);}
 }
 assert.equal(lessons.reduce((n,l)=>n+l.words.length,0),218);
 assert.equal(getLesson(8),undefined);
});
test('Other words is excluded while all regular Part 1 entries in Lesson 6 remain',()=>{
 assert.ok(!getLesson(1).words.some(w=>w.en==='among'));
 for(const en of ['percentage','rate','naturally'])assert.equal(getLesson(6).words.find(w=>w.en===en)?.part,1);
 assert.deepEqual(getLesson(7).words,oldLesson7);
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
