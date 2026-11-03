import test from 'node:test';
import assert from 'node:assert/strict';
import {words,scoreWord,sample,totalScore} from '../dist/vocabulary.js';
test('Lesson 7 contains exactly 32 unique words and the correct part counts',()=>{assert.equal(words.length,32);assert.equal(new Set(words.map(w=>w.en)).size,32);assert.deepEqual([1,2,3].map(p=>words.filter(w=>w.part===p).length),[9,11,12]);});
test('scoring ignores casing and spacing but does not accept missing words',()=>{assert.equal(scoreWord('non-profit organization','Non profit organization.'),100);assert.equal(scoreWord('mistake for','mistake for'),100);assert.equal(scoreWord('debris',''),0);assert.ok(scoreWord('green sea turtle','turtle')<50);assert.ok(scoreWord('nearly','nearly anything')<100);assert.ok(scoreWord('decompose','decompos')>80);});
test('random selection is unique, ten long and does not mutate the source',()=>{const original=[...words];for(let i=0;i<100;i++){const chosen=sample(words);assert.equal(chosen.length,10);assert.equal(new Set(chosen.map(x=>x.id)).size,10);}assert.deepEqual(words,original);});
test('challenge score always uses ten questions including unanswered slots',()=>{assert.equal(totalScore(Array(10).fill({score:100})),100);assert.equal(totalScore([{score:100},...Array(9).fill(null)]),10);assert.equal(totalScore(Array(10).fill(null)),0);assert.equal(totalScore([{score:85}]),9);});
