import assert from 'node:assert/strict';
import fs from 'node:fs';

const checklist=fs.readFileSync(new URL('../app-11-checklists.js',import.meta.url),'utf8');
const readiness=fs.readFileSync(new URL('../app-69-commissioning-readiness.js',import.meta.url),'utf8');

assert.match(checklist,/'11':\{[\s\S]*sourcePage:'79-00-00 p\.3–4'[\s\S]*sourceSection:'System description \/ oil-system connections'/,
  'oil-hose connection check must cite the detailed Chapter 79 system description');
assert.match(checklist,/'12':\{[\s\S]*sourcePage:'79-00-00 p\.24–25'[\s\S]*sourceSection:'Replenishing and purging of the oil system'/,
  'oil-system purge check must cite the detailed Chapter 79 purge procedure');
assert.doesNotMatch(checklist,/'10':\{/,
  'oil-filter security should keep its explicit 10-10-00 pre-trial source rather than receive a Chapter 79 override');
assert.ok(checklist.includes('checklistItemSourceMeta(c,i)'));
assert.ok(checklist.includes('openSourceReference(doc,sourceMeta.sourcePage'));
assert.ok(readiness.includes('window.checklistItemSourceMeta(checklist,item)'));
assert.ok(readiness.includes('openSourceReference(doc,sourceMeta.sourcePage'));

console.log('oil-system source citation overrides passed');
