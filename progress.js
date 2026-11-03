import {migrateProfile} from './profile.js';

export const PROFILE_KEY='pronunciation-lab-profile-v1';
export const LESSON_KEY='pronunciation-lab-active-lesson';
export const progressKey=lesson=>`pronunciation-lab-lesson${lesson}-v1`;
function read(storage,key){try{return JSON.parse(storage.getItem(key));}catch{return null;}}
export function emptyProgress(profile={}){
 return {history:{},challenges:[],attempts:0,bestScores:{},challengeBest:null,quickBest:0,profile:migrateProfile(profile&&typeof profile==='object'?profile:{})};
}
export function readProgress(storage,lesson,words){
 const saved=read(storage,progressKey(lesson));
 const profile=read(storage,PROFILE_KEY)||saved?.profile||read(storage,progressKey(7))?.profile;
 const data=emptyProgress(profile);
 if(!saved||typeof saved.history!=='object'||!saved.history||Array.isArray(saved.history)||!Array.isArray(saved.challenges))return data;
 for(const w of words){
  const h=saved.history[w.id];
  if(Array.isArray(h))data.history[w.id]=h.filter(x=>x&&Number.isFinite(x.score)&&x.score>=0&&x.score<=100&&typeof x.heard==='string').slice(-30);
  const n=saved.bestScores?.[w.id];
  data.bestScores[w.id]=Math.max(Number.isFinite(n)&&n>=0&&n<=100?n:0,...(data.history[w.id]||[]).map(x=>x.score));
 }
 data.attempts=Number.isSafeInteger(saved.attempts)&&saved.attempts>=0?saved.attempts:Object.values(data.history).reduce((n,h)=>n+h.length,0);
 data.challenges=saved.challenges.filter(x=>x&&Number.isFinite(x.score)&&x.score>=0&&x.score<=100).slice(-50);
 const n=saved.challengeBest;data.challengeBest=Number.isFinite(n)&&n>=0&&n<=100?n:null;
 for(const c of data.challenges)data.challengeBest=Math.max(data.challengeBest??0,c.score);
 data.quickBest=Number.isInteger(saved.quickBest)&&saved.quickBest>=0&&saved.quickBest<=words.length?saved.quickBest:0;
 return data;
}
export function writeProgress(storage,lesson,data){
 storage.setItem(progressKey(lesson),JSON.stringify(data));
 storage.setItem(PROFILE_KEY,JSON.stringify(data.profile));
}
