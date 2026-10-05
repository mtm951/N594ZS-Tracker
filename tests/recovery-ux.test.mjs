import assert from 'node:assert/strict';
import fs from 'node:fs';

const log=fs.readFileSync(new URL('../app-09-logbook.js',import.meta.url),'utf8');
const attachments=fs.readFileSync(new URL('../app-13-attachments.js',import.meta.url),'utf8');
const projects=fs.readFileSync(new URL('../app-06-projects.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

assert.ok(log.includes('Review / Retry Transaction'));
assert.ok(log.includes('atomicReceiptOutbox.openSettings()'));
assert.ok(attachments.includes('Could not load attachments.</b>'));
assert.ok(attachments.includes('renderAttachments('));
assert.ok(projects.includes("project.status==='Done'?(a.warnings.length?'Completed with Warning':'Completed')"));
assert.ok(index.includes('app-13-attachments.js?v=5.19.67'));
assert.ok(index.includes('app-09-logbook.js?v=5.19.67'));
assert.ok(index.includes('app-06-projects.js?v=5.19.67'));
console.log('v5.19.66 recovery UX tests passed');

const atomic=fs.readFileSync(new URL('../app-66-atomic-receipt-outbox.js',import.meta.url),'utf8');
assert.ok(atomic.includes('Open Supervised Conflict Review'));
assert.ok(atomic.includes('function openConflictReview()'));
assert.ok(atomic.includes('nothing will be changed'));
assert.ok(atomic.includes('Download Safety Copy'));
