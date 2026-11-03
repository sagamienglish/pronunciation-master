import {lessons} from '../dist/lessons.js';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,rmSync,statSync,existsSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const temporary=mkdtempSync(path.join(os.tmpdir(),'pronunciation-audio-'));
try{mkdirSync('dist/audio',{recursive:true});for(const w of lessons.flatMap(lesson=>lesson.words)){const aiff=path.join(temporary,`${w.id}.aiff`);const out=path.resolve(`dist/audio/${w.audio??w.id}.wav`);if(existsSync(out)&&statSync(out).size>5000)continue;mkdirSync(path.dirname(out),{recursive:true});for(const [cmd,args] of [['say',['-v','Samantha','-r','145','-o',aiff,w.say]],['afconvert',['-f','WAVE','-d','LEI16',aiff,out]]]){const r=spawnSync(cmd,args,{encoding:'utf8'});if(r.status!==0)throw Error(`${cmd} failed: ${r.stderr}`);}if(statSync(out).size<5000)throw Error(`Empty audio for ${w.en}`);}console.log(`English model recordings ready for ${lessons.reduce((n,l)=>n+l.words.length,0)} entries.`);}finally{rmSync(temporary,{recursive:true,force:true});}
