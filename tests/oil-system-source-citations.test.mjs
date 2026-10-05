import assert from 'node:assert/strict';
import fs from 'node:fs';

const checklist=fs.readFileSync(new URL('../app-11-checklists.js',import.meta.url),'utf8');
const readiness=fs.readFileSync(new URL('../app-69-commissioning-readiness.js',import.meta.url),'utf8');

assert.match(checklist,/'2':\{[\s\S]*sourcePage:'73-00-00 p\.19–22'[\s\S]*sourceSection:'Throttle \/ choke Bowden-cable actuation and stops'/,
  'throttle/choke check must cite the detailed Chapter 73 control-actuation section');
assert.match(checklist,/'9':\{[\s\S]*sourcePage:'10-10-00 p\.5–8'[\s\S]*sourceSection:'Engine suspension \/ mechanical interfaces'/,
  'engine-suspension check must cite the detailed suspension/mechanical-interface section');
assert.match(checklist,/'11':\{[\s\S]*sourcePage:'79-00-00 p\.3–4'[\s\S]*sourceSection:'System description \/ oil-system connections'/,
  'oil-hose connection check must cite the detailed Chapter 79 system description');
assert.match(checklist,/'12':\{[\s\S]*sourcePage:'79-00-00 p\.24–25'[\s\S]*sourceSection:'Replenishing and purging of the oil system'/,
  'oil-system purge check must cite the detailed Chapter 79 purge procedure');
assert.match(checklist,/'15':\{[\s\S]*sourcePage:'24-00-00 p\.2'[\s\S]*sourceSection:'Guidelines for circuit wiring \/ routing and strain relief'/,
  'wiring check must cite the detailed Chapter 24 routing/clamping/strain-relief section');
assert.doesNotMatch(checklist,/'10':\{/,
  'oil-filter security should keep its explicit 10-10-00 pre-trial source rather than receive a Chapter 79 override');
assert.ok(checklist.includes('checklistItemSourceMeta(c,i)'));
assert.ok(checklist.includes('openSourceReference(doc,sourceMeta.sourcePage'));
assert.ok(readiness.includes('window.checklistItemSourceMeta(checklist,item)'));
assert.ok(readiness.includes('openSourceReference(doc,sourceMeta.sourcePage'));

console.log('pre-trial detailed source citation overrides passed');
