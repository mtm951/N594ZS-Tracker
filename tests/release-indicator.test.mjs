import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8');
const seed=fs.readFileSync(new URL('../app-01-seed.js',import.meta.url),'utf8');
const version=seed.match(/\bconst APP_VERSION='([^']+)';/)?.[1];
assert.ok(version,'Application version is missing from canonical app-01-seed.js');

const footer=html.match(/<div class="footer">([\s\S]*?)<\/div>/)?.[1];
assert.ok(footer,'Version footer is missing');
assert.match(footer,/id="appVersionFooter"/,'Version footer is not bound to a running version');
assert.doesNotMatch(footer,/v\d+\.\d+\.\d+/,'Version footer is hardcoded and could mislead the owner again');
assert.ok(html.includes('app-01-seed.js?v='+version),
  'App entry-point cache-buster must match the real release version');

const inline=html.match(/<script>(document\.getElementById\("appVersionFooter"\)\.textContent=[^<]+)<\/script>/)?.[1];
assert.ok(inline,'Footer must update immediately after app-01-seed loads');
const run=runningVersion=>{
  const el={textContent:'Version loading…'};
  const ctx={APP_VERSION:runningVersion,document:{getElementById:id=>{
    assert.equal(id,'appVersionFooter');return el;
  }}};
  vm.runInNewContext(inline,ctx);
  return el.textContent;
};
assert.equal(run(version),'v'+version);
assert.equal(run('5.19.32'),'v5.19.32',
  'Version indicator must reflect an older bundle truthfully, not pretend it updated');
assert.equal(run('6.0.0'),'v6.0.0',
  'Future releases must never require manually editing the footer');

console.log('PASS: footer reports actual running APP_VERSION; no hardcoded 5.19.32, index cache-buster matches release.');
