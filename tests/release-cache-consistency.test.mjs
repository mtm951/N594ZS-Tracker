import assert from 'node:assert/strict';
import fs from 'node:fs';

const seed=fs.readFileSync(new URL('../app-01-seed.js',import.meta.url),'utf8');
const index=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');

const appVersion=seed.match(/const APP_VERSION='([^']+)'/)?.[1];
assert.ok(appVersion,'APP_VERSION missing');

const seedTag=index.match(/app-01-seed\.js\?v=([0-9.]+)/)?.[1];
const atomicTag=index.match(/app-66-atomic-receipt-outbox\.js\?v=([0-9.]+)/)?.[1];
const swVersion=sw.match(/n594zs-v([0-9-]+)-shell/)?.[1]?.replaceAll('-','.');

assert.equal(seedTag,appVersion,'seed cache-buster must match visible APP_VERSION');
assert.equal(atomicTag,appVersion,'atomic recovery cache-buster must match visible APP_VERSION');
assert.equal(swVersion,appVersion,'service-worker shell version must match visible APP_VERSION');

console.log('release/cache version consistency passed:',appVersion);
