import assert from 'node:assert/strict';
import fs from 'node:fs';

const read=name=>fs.readFileSync(new URL('../'+name,import.meta.url),'utf8');
const settings=read('app-05-views.js');
const system=read('app-18-enhancements.js');
const reliability=read('app-45-reliability.js');
const atomic=read('app-66-atomic-receipt-outbox.js');
const logbook=read('app-09-logbook.js');

assert.match(settings,/App & Deployment/);
assert.match(settings,/Advanced \/ Troubleshooting/);
assert.doesNotMatch(settings,/data-tracker-update-button/);
assert.doesNotMatch(settings,/Open fresh version/);

const systemRender=system.slice(system.indexOf('async function renderSystem()'),system.indexOf('// ---------- GLOBAL SEARCH ----------'));
assert.match(systemRender,/Advanced \/ Troubleshooting/);
assert.match(systemRender,/Restores are kept under Advanced \/ Troubleshooting/);
assert.doesNotMatch(systemRender,/Force Latest Version/);
assert.doesNotMatch(systemRender,/Fresh version/);
assert.doesNotMatch(systemRender,/onclick="restoreCloudSnapshot/);

assert.match(reliability,/window\.openAdvancedTroubleshooting=function/);
assert.match(reliability,/Recovery and diagnostic tools/);
assert.match(reliability,/Force Latest Version/);
assert.match(reliability,/Manage Snapshot Restores/);
assert.match(reliability,/Restore Local Recovery/);
assert.match(reliability,/Inventory Transaction Safety/);

const systemHealth=reliability.slice(reliability.indexOf("const sys=window.renderSystem"),reliability.indexOf('})();'));
assert.match(systemHealth,/System Health/);
assert.match(systemHealth,/Advanced \/ Troubleshooting/);
assert.doesNotMatch(systemHealth,/Test Latest Snapshot/);
assert.doesNotMatch(systemHealth,/Restore Local Recovery/);

assert.match(atomic,/Inventory protection active/);
assert.match(atomic,/Review Pending Inventory Transaction/);
assert.doesNotMatch(atomic,/Atomic Receipt Testing/);
assert.doesNotMatch(atomic,/Inventory Transaction Safety'\+\(pending\(\)\?' • Pending'/);
assert.match(logbook,/System → Advanced \/ Troubleshooting → Inventory Transaction Safety/);

console.log('advanced troubleshooting UX regression tests passed');
