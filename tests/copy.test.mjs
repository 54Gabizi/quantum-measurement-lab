import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {copy} from '../src/i18n.mjs';
test('interface is English-only and all visible translation keys resolve',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const keys=[...html.matchAll(/data-i18n="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(Object.keys(copy),['en']);
 for(const key of keys)assert.ok(copy.en[key]?.trim(),key);
 assert.match(html,/<html lang="en">/);assert.doesNotMatch(html,/id="language"/);
 assert.match(copy.en.animationNote,/not real quantum trajectories/);
 assert.match(copy.en.animationNote,/Counts update on arrival/);
});
