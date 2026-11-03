import test from 'node:test';
import assert from 'node:assert/strict';
import {certificateRank} from '../dist/awards.js';

test('word rush ranks use the requested correct-word boundaries',()=>{
 const ranges=[[0,3,'チャレンジャー'],[4,6,'ルーキー'],[7,9,'エキスパート'],[10,12,'マスター'],[13,33,'レジェンド']];
 for(const [low,high,name] of ranges)for(const score of [low,high])assert.equal(certificateRank('quick',score).name,name,`${score} words`);
});
test('sprint ranks preserve the five score boundaries',()=>{
 const ranges=[[0,49,'チャレンジャー'],[50,69,'ルーキー'],[70,89,'エキスパート'],[90,99,'マスター'],[100,100,'レジェンド']];
 for(const [low,high,name] of ranges)for(const score of [low,high])assert.equal(certificateRank('sprint',score).name,name,`${score} points`);
});
