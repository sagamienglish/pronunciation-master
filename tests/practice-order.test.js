import test from 'node:test';
import assert from 'node:assert/strict';
import {practiceOrder} from '../dist/practice-order.js';
const words=Array.from({length:6},(_,id)=>({id}));
const progress={history:{0:[{score:100}],2:[{score:20},{score:60}],3:[{score:50}],4:[{score:50}],5:[{score:0}]},bestScores:{0:100,2:60,3:50,4:50,5:0}};
test('unpractised precedes zero, then displayed best scores ascend with stable ties',()=>{
 assert.deepEqual(practiceOrder(words,progress,true).map(w=>w.id),[1,5,3,4,2,0]);
 assert.deepEqual(words.map(w=>w.id),[0,1,2,3,4,5]);
 assert.deepEqual(practiceOrder(words,progress,false),words);
});
test('filtered subsets retain their scope and old records without best score use history',()=>{
 assert.deepEqual(practiceOrder([words[0],words[4],words[2]],progress,true).map(w=>w.id),[4,2,0]);
 assert.deepEqual(practiceOrder(words,{history:progress.history,bestScores:{}},true).map(w=>w.id),[1,5,3,4,2,0]);
});
