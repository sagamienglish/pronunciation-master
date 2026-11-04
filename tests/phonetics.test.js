import test from 'node:test';
import assert from 'node:assert/strict';
import {lessons} from '../dist/lessons.js';
import {phonetics,pronunciationFor} from '../dist/phonetics.js';

test('all active vocabulary and expressions have static accent-mark transcriptions',()=>{
 for(const lesson of lessons)for(const word of lesson.words){
  const phonetic=pronunciationFor(word.en);
  assert.ok(phonetic,`Lesson ${lesson.id}: ${word.en}`);
  assert.doesNotMatch(phonetic,/[ˈˌ]|undefined|[ぁ-んァ-ン一-龥]/);
  assert.equal(phonetic,phonetic.normalize('NFC'));
 }
 assert.equal(pronunciationFor('unlisted word'),'');
 for(const en of ['Mfuwe Village','Grand Banks','Newfoundland'])assert.ok(!Object.keys(phonetics).includes(en));
});
test('sample vocabulary uses textbook-style vowel accents and American sounds',()=>{
 assert.equal(pronunciationFor('nearly'),'níərli');
 assert.equal(pronunciationFor('victim'),'víktim');
 assert.equal(pronunciationFor('mistake'),'mistéik');
 assert.equal(pronunciationFor('decompose'),'dìːkəmpóuz');
 assert.equal(pronunciationFor('consume'),'kənsúːm');
 assert.match(pronunciationFor('reuse'),/z$/);
});
