// 仅管理苹果演示的生成目录；其他项目（如原生 JS 游戏）不会被改动。
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'sources/apple-explorer');
const dist = path.join(source, 'dist');
const target = path.join(root, 'projects/apple-explorer');

async function files(dir, prefix = '') {
  const result = [];
  for (const entry of await fs.readdir(path.join(dir, prefix), { withFileTypes: true })) {
    const name = path.join(prefix, entry.name);
    if (entry.isDirectory()) result.push(...await files(dir, name));
    else if (entry.isFile()) result.push(name);
    else throw new Error(`不允许构建产物包含符号链接或特殊文件: ${name}`);
  }
  return result.sort();
}

(async () => {
  const flags = process.argv.slice(2);
  assert(flags.every(flag => flag === '--check'), '支持的参数只有 --check');
  // 必须成功构建、验证后才能触及当前发布目录。
  const result = spawnSync('npm', ['run', 'build'], { cwd: source, stdio: 'inherit' });
  if (result.error) throw result.error;
  assert.equal(result.status, 0, '苹果构建失败，原发布目录保持不变');
  const output = await files(dist);
  const html = await fs.readFile(path.join(dist, 'index.html'), 'utf8');
  assert(html.includes('class="show-project-nav"') && html.includes('href="../../"'), '缺少源码中的返回首页入口');
  assert(output.includes('THREE-LICENSE.txt'), '缺少 Three.js 许可证');
  assert(output.includes('部署说明.txt'), '缺少静态部署说明');
  assert(output.some(file => file.endsWith('.js')), '缺少 JavaScript 构建产物');
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = match[1];
    if (url === '../../') continue;
    assert(url.startsWith('./'), `构建资源必须使用相对路径: ${url}`);
    await fs.access(path.join(dist, url));
  }
  if (flags.includes('--check')) {
    assert.deepEqual(await files(target), output, '发布文件列表与源码构建结果不一致，请运行 npm run build');
    for (const file of output) {
      assert((await fs.readFile(path.join(target, file))).equals(await fs.readFile(path.join(dist, file))), `发布文件过期: ${file}，请运行 npm run build`);
    }
    console.log('PASS: 苹果发布目录与当前源码构建结果逐字节一致');
    return;
  }
  // 在同一文件系统中先准备完整目录，再替换；失败时恢复原目录。
  const temp = await fs.mkdtemp(path.join(root, 'projects/.apple-build-'));
  const next = path.join(temp, 'next');
  const previous = path.join(temp, 'previous');
  let backedUp = false;
  try {
    await fs.cp(dist, next, { recursive: true });
    try { await fs.rename(target, previous); backedUp = true; }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    try { await fs.rename(next, target); }
    catch (error) {
      if (backedUp) { await fs.rename(previous, target); backedUp = false; }
      throw error;
    }
    backedUp = false;
    console.log(`已同步 ${output.length} 个文件到 projects/apple-explorer/（旧哈希资源已移除）`);
  } finally {
    // 若恢复过程失败，保留备份供排查，不能删除用户最后一份可用产物。
    if (!backedUp) await fs.rm(temp, { recursive: true, force: true });
    else console.error(`发布未完成，保留恢复备份: ${previous}`);
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
