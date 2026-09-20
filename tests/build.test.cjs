const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

// 使用独立临时仓库和假的 npm 验证同步逻辑，不修改真实源码或发布包。
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'show-build-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const dist = path.join(root, 'sources/apple-explorer/dist');
  const target = path.join(root, 'projects/apple-explorer');
  await fs.mkdir(path.join(root, 'scripts'), { recursive: true });
  await fs.mkdir(path.join(root, 'bin'));
  await fs.mkdir(dist, { recursive: true });
  await fs.mkdir(target, { recursive: true });
  await fs.mkdir(path.join(root, 'projects/freeform-breaker'));
  await fs.writeFile(path.join(root, 'projects/freeform-breaker/engine.js'), 'original-game');
  await fs.copyFile(path.join(__dirname, '../scripts/build-projects.cjs'), path.join(root, 'scripts/build-projects.cjs'));
  await fs.writeFile(path.join(root, 'bin/npm'), '#!/bin/sh\nexit "${FAKE_BUILD_EXIT:-0}"\n', { mode: 0o755 });
  const html = '<nav class="show-project-nav"><a href="../../">返回首页</a></nav><script src="./app.js"></script>';
  for (const [name, text] of Object.entries({ 'index.html': html, 'app.js': 'new-build', 'THREE-LICENSE.txt': 'license', '部署说明.txt': 'notes' })) {
    await fs.writeFile(path.join(dist, name), text);
  }
  await fs.writeFile(path.join(target, 'old.js'), 'old-working-build');
  return { root, dist, target, run: (args = [], env = {}) => spawnSync(process.execPath, [path.join(root, 'scripts/build-projects.cjs'), ...args], {
    encoding: 'utf8', cwd: os.tmpdir(), env: { ...process.env, PATH: path.join(root, 'bin') + path.delimiter + process.env.PATH, ...env },
  }) };
}

test('sync replaces only generated project, removes stale files, and works outside repo cwd', async t => {
  const f = await fixture(t);
  const result = f.run(); assert.equal(result.status, 0, result.stderr);
  assert.equal(await fs.readFile(path.join(f.target, 'app.js'), 'utf8'), 'new-build');
  await assert.rejects(fs.access(path.join(f.target, 'old.js')));
  assert.equal(await fs.readFile(path.join(f.root, 'projects/freeform-breaker/engine.js'), 'utf8'), 'original-game');
  assert(!(await fs.readdir(path.join(f.root, 'projects'))).some(name => name.startsWith('.apple-build-')));
  assert.equal(f.run(['--check']).status, 0);
});

test('failed compiler leaves last working release untouched', async t => {
  const f = await fixture(t);
  assert.notEqual(f.run([], { FAKE_BUILD_EXIT: '1' }).status, 0);
  assert.deepEqual(await fs.readdir(f.target), ['old.js']);
  assert.equal(await fs.readFile(path.join(f.target, 'old.js'), 'utf8'), 'old-working-build');
});

test('check detects stale content without overwriting release', async t => {
  const f = await fixture(t); assert.equal(f.run().status, 0);
  await fs.writeFile(path.join(f.target, 'app.js'), 'hand-edited');
  assert.notEqual(f.run(['--check']).status, 0);
  assert.equal(await fs.readFile(path.join(f.target, 'app.js'), 'utf8'), 'hand-edited');
  await fs.writeFile(path.join(f.target, 'extra.js'), 'stale');
  assert.notEqual(f.run(['--check']).status, 0);
  assert.equal(await fs.readFile(path.join(f.target, 'extra.js'), 'utf8'), 'stale');
});

test('missing return navigation, invalid paths, missing assets/license fail before sync', async t => {
  const f = await fixture(t);
  const original = await fs.readFile(path.join(f.dist, 'index.html'), 'utf8');
  for (const html of [original.replace('show-project-nav', 'missing'), original.replace('./app.js', '/app.js'), original.replace('./app.js', './missing.js')]) {
    await fs.writeFile(path.join(f.dist, 'index.html'), html);
    assert.notEqual(f.run().status, 0);
    assert.deepEqual(await fs.readdir(f.target), ['old.js']);
  }
  await fs.writeFile(path.join(f.dist, 'index.html'), original);
  await fs.unlink(path.join(f.dist, 'THREE-LICENSE.txt'));
  assert.notEqual(f.run().status, 0);
  assert.deepEqual(await fs.readdir(f.target), ['old.js']);
});
