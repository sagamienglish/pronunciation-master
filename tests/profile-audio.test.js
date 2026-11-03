import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {migrateProfile,profileSelections,validSelection} from '../dist/profile.js';
import {words} from '../dist/vocabulary.js';
test('class and seat selections accept boundaries and reject out-of-range values',()=>{assert.deepEqual(profileSelections('13','50'),{classNo:'13',number:'50',group:'13組 50番'});assert.equal(validSelection('14',13),'');assert.equal(validSelection('51',50),'');assert.equal(validSelection('0',13),'');assert.equal(validSelection('1.5',13),'');});
test('existing profile group text migrates to separate selections',()=>{const p=migrateProfile({name:'Example',group:'1年2組 15番'});assert.equal(p.classNo,'2');assert.equal(p.number,'15');assert.equal(p.name,'Example');});
test('all 32 model recordings contain nonempty PCM wave data',()=>{for(const w of words){const b=fs.readFileSync(new URL(`../dist/audio/${w.id}.wav`,import.meta.url));assert.equal(b.subarray(0,4).toString(),'RIFF');assert.equal(b.subarray(8,12).toString(),'WAVE');assert.ok(b.length>5000,w.en);}});
