import assert from 'node:assert/strict';
import fs from 'node:fs';

const reportSource=fs.readFileSync(new URL('../app-71-records-reports.js',import.meta.url),'utf8');
const projectSource=fs.readFileSync(new URL('../app-06-projects.js',import.meta.url),'utf8');
const logSource=fs.readFileSync(new URL('../app-09-logbook.js',import.meta.url),'utf8');
const indexSource=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');

assert.match(reportSource,/window\.generateRecords=/,'records generator entrypoint missing');
assert.match(reportSource,/window\.openProjectRecords=/,'project records action missing');
assert.match(reportSource,/window\.openLogRecords=/,'work-log records action missing');
assert.match(reportSource,/window\.openMaintenanceRecordDraft=/,'maintenance-record draft action missing');
assert.match(reportSource,/Parts & Materials Used/,'parts/materials report section missing');
assert.match(reportSource,/Work Performed/,'work performed report section missing');
assert.match(reportSource,/Save PDF/,'PDF save path missing');
assert.match(reportSource,/Draft record notice/,'report must identify itself as a draft summary');
assert.match(reportSource,/does not by itself certify maintenance/,'report must not imply automatic maintenance certification');
assert.match(reportSource,/does not determine whether work is maintenance/,'maintenance draft must not make the regulatory classification automatically');

assert.match(projectSource,/openProjectRecords\(\$\{id\}\)/,'Project detail is missing Generate Records action');
assert.match(logSource,/openLogRecords\(\$\{id\}\)/,'Work Log detail is missing Generate Record action');
assert.match(logSource,/openMaintenanceRecordDraft\(\$\{id\}\)/,'Work Log detail is missing Draft Maintenance Record action');
assert.match(indexSource,/app-71-records-reports\\.js\\?v=\\d+\\.\\d+\\.\\d+/,'records report module must be loaded with an explicit semver cache-buster');

console.log('records/report generator wiring and safety wording tests passed');
