import assert from 'node:assert/strict';
import fs from 'node:fs';

const log=fs.readFileSync(new URL('../app-09-logbook.js',import.meta.url),'utf8');
const attachments=fs.readFileSync(new URL('../app-13-attachments.js',import.meta.url),'utf8');
const projects=fs.readFileSync(new URL('../app-06-projects.js',import.meta.url),'utf8');
const atomic=fs.readFileSync(new URL('../app-66-atomic-receipt-outbox.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

assert.ok(log.includes('Review / Retry Transaction'));
assert.ok(log.includes('atomicReceiptOutbox.openSettings()'));
assert.ok(attachments.includes('Could not load attachments.</b>'));
assert.ok(attachments.includes('renderAttachments('));
assert.ok(projects.includes("project.status==='Done'?(a.warnings.length?'Completed with Warning':'Completed')"));

for(const file of ['app-13-attachments.js','app-09-logbook.js','app-06-projects.js']){
  const escaped=file.replaceAll('.','\\.');
  assert.match(index,new RegExp(escaped+'\\?v=\\d+\\.\\d+\\.\\d+'),file+' must have an explicit semver cache-buster');
}

assert.ok(atomic.includes('Open Supervised Conflict Review'));
assert.ok(atomic.includes('function openConflictReview()'));
assert.ok(atomic.includes('nothing will be changed'));
assert.ok(atomic.includes('Download Safety Copy'));

console.log('recovery, attachment retry, closeout-status and supervised-review UX tests passed');

const inventoryWorkflow=fs.readFileSync(new URL('../app-42-inventory-workflow.js',import.meta.url),'utf8');
const workflow=fs.readFileSync(new URL('../app-20-workflow.js',import.meta.url),'utf8');

assert.ok(atomic.includes('Resolve Original Use + Keep Later Reservation'));
assert.ok(atomic.includes('function resolvePostStagedReservations()'));
assert.ok(atomic.includes('function postStagedReservationDrift(e)'));
assert.ok(inventoryWorkflow.includes('function blockWhileAtomicPending(action)'));
assert.ok(inventoryWorkflow.includes("blockWhileAtomicPending('adding or changing a reservation')"));
assert.ok(workflow.includes('function blockPendingProjectEdit(projectId)'));
assert.ok(projects.includes("atomicReceiptOutbox?.isPendingRecord?.('project',id)"));
