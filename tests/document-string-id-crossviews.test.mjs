import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const projects=read('app-06-projects.js');
const logbook=read('app-09-logbook.js');
const annual=read('app-50-annual-inspection.js');
const component=read('app-65-component-view.js');
const kitfox=read('app-68-kitfox-manual-checklists.js');

assert.doesNotMatch(projects,/openDocumentDetail\(\$\{d\.id\}\)/,'Project detail still emits bare document IDs');
assert.match(projects,/const did=val\('linkDocId'\)/,'Project document linker still coerces IDs through selectedNumber');
assert.doesNotMatch(projects,/selectedNumber\('linkDocId'\)/);

assert.doesNotMatch(logbook,/openDocumentDetail\(\$\{d\.id\}\)/,'Work Log detail still emits bare document IDs');
assert.doesNotMatch(component,/openDocumentDetail\(\$\{d\.id\}\)/,'Component view still emits bare document IDs');

assert.doesNotMatch(annual,/docById\(Number\(c\.sourceDocumentId\)\)/,'Annual inspection still coerces source Document IDs to numbers');
assert.match(annual,/data-annual-source-doc/,'Annual source links should bind through string-safe data attributes');

assert.doesNotMatch(kitfox,/docById\(Number\(did\)\)/,'Kitfox manual source lookup still coerces document IDs to numbers');
assert.match(kitfox,/docById\(did\)/);

console.log('cross-view stable string Document ID regression tests passed');
