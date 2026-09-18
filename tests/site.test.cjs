const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const artifacts = path.join(root, 'test-results');
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg', '.png': 'image/png' };

// 同一份文件分别挂载于 / 和 /show/，验证项目级 GitHub Pages 相对路径。
const server = http.createServer(async (req, res) => {
  try {
    let pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    if (pathname.startsWith('/show/')) pathname = pathname.slice(5);
    let filename = path.resolve(root, `.${pathname}`);
    if (filename !== root && !filename.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
    if ((await fs.stat(filename)).isDirectory()) filename = path.join(filename, 'index.html');
    const data = await fs.readFile(filename);
    res.writeHead(200, { 'Content-Type': types[path.extname(filename)] || 'application/octet-stream' }).end(data);
  } catch { res.writeHead(404).end('Not found'); }
});

(async () => {
  await fs.mkdir(artifacts, { recursive: true });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ headless: true, args: ['--enable-unsafe-swiftshader'] });
    const errors = [], responses = [], external = [];
    const context = await browser.newContext({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
    context.on('page', page => {
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
      page.on('response', response => { if (response.status() >= 400) responses.push(`${response.status()} ${response.url()}`); });
      page.on('request', request => { if (!request.url().startsWith(origin) && /^https?:/.test(request.url())) external.push(request.url()); });
    });
    const page = await context.newPage();
    for (const prefix of ['/', '/show/']) {
      const base = origin + prefix;
      await page.goto(base);
      await page.waitForLoadState('networkidle');
      assert.equal(await page.title(), '小小作品集 · SHOW');
      assert.equal(await page.locator('.project-card:visible').count(), 2);
      assert.equal(await page.locator('#total-count').innerText(), '02');
      assert(await page.locator('.project-image').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)));
      await page.locator('[data-filter="game"]').click();
      assert.equal(await page.locator('.project-card:visible').count(), 1);
      assert.match(await page.locator('.project-card:visible').innerText(), /自由反弹/);
      assert.equal(await page.locator('[data-filter="game"]').getAttribute('aria-pressed'), 'true');
      await page.locator('[data-filter="demo"]').click();
      assert.match(await page.locator('.project-card:visible').innerText(), /苹果里面/);
      await page.locator('[data-filter="tool"]').click();
      assert(await page.locator('#empty-state').isVisible());
      await page.locator('#reset-filters').click();
      assert.equal(await page.locator('.project-card:visible').count(), 2);
      await page.keyboard.press('/');
      assert(await page.locator('#project-search').evaluate(el => el === document.activeElement));
      await page.locator('#project-search').fill('苹果');
      assert.equal(await page.locator('.project-card:visible').count(), 1);
      await page.locator('#project-search').fill('fReEfOrM');
      assert.match(await page.locator('.project-card:visible').innerText(), /自由反弹/);
      await page.locator('#project-search').fill('种子');
      assert.match(await page.locator('.project-card:visible').innerText(), /苹果里面/);
      await page.locator('#project-search').fill('不存在的项目');
      assert.equal(await page.locator('.project-card:visible').count(), 0);
      assert.match(await page.locator('#empty-title').innerText(), /还没找到/);
      await page.locator('#reset-filters').click();
      await page.locator('a.project-card').filter({ hasText: '苹果里面' }).click();
      assert.equal(page.url(), base + 'projects/apple-explorer/');
      await page.waitForFunction(() => document.querySelector('#viewport').dataset.ready === 'true');
      assert(await page.locator('#scene-error').isHidden());
      await page.locator('#cut').click();
      await page.waitForFunction(() => document.querySelector('#viewport').dataset.actualSeparation === '1.000');
      await page.locator('.part[data-part="seed"]').click();
      assert.match(await page.locator('#discovery-title').innerText(), /种子/);
      await page.locator('#view-section').click();
      assert.equal(await page.locator('#viewport').getAttribute('data-view'), 'section');
      assert(await page.locator('#separation').isDisabled());
      await page.locator('#view-seeds').click();
      assert.equal(await page.locator('#viewport').getAttribute('data-view'), 'seeds');
      assert(await page.locator('#seed-inspection-note').isVisible());
      await page.locator('#reset').click();
      await page.waitForFunction(() => document.querySelector('#viewport').dataset.actualSeparation === '0.000');
      await page.getByRole('link', { name: '← 返回小小作品集' }).click();
      assert.equal(page.url(), base);
      await page.locator('a.project-card').filter({ hasText: '自由反弹' }).click();
      assert.equal(page.url(), base + 'projects/freeform-breaker/');
      assert.equal(await page.evaluate(() => typeof window.__game), 'undefined');
      await page.locator('#primary').click();
      assert.equal(await page.locator('#status').innerText(), '游戏进行中');
      await page.locator('#pause').click();
      assert.equal(await page.locator('#status').innerText(), '已暂停');
      await page.locator('#game').focus();
      await page.keyboard.press('Space');
      await page.waitForFunction(() => document.querySelector('#status').textContent === '游戏进行中');
      await page.getByRole('link', { name: '← 返回小小作品集' }).click();
      assert.equal(page.url(), base);
      await page.locator('#random-project').click();
      assert([base + 'projects/apple-explorer/', base + 'projects/freeform-breaker/'].includes(page.url()));
      console.log(`PASS: ${prefix} navigation, filters, search, empty state, random, apple WebGL controls, game start/pause/resume, return links`);
    }
    for (const width of [1440, 768, 390, 320]) {
      await page.setViewportSize({ width, height: width >= 768 ? 1050 : 844 });
      for (const route of ['', 'projects/apple-explorer/', 'projects/freeform-breaker/']) {
        await page.goto(origin + '/show/' + route);
        await page.waitForLoadState('networkidle');
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow at ${width}: ${route}`);
        if (width === 1440 || width === 390) {
          const name = route.includes('apple') ? 'apple' : route.includes('breaker') ? 'breaker' : 'home';
          await page.screenshot({ path: path.join(artifacts, `${name}-${width}.png`), fullPage: true });
        }
      }
      console.log(`PASS: ${width}px responsive layout, all three pages`);
    }
    const mobile = await context.newPage({ viewport: { width: 390, height: 844 } });
    await mobile.goto(origin + '/show/projects/freeform-breaker/?test=1');
    await mobile.locator('#primary').click();
    await mobile.waitForFunction(() => __game.state === 'running');
    const box = await mobile.locator('#game').boundingBox();
    await mobile.mouse.move(box.x + box.width * .3, box.y + box.height * .5);
    await mobile.waitForTimeout(250);
    assert(await mobile.evaluate(() => Math.abs(__game.paddle.x - 312) < 20));
    await mobile.close();
    const touchContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
    const touch = await touchContext.newPage();
    touch.on('pageerror', error => errors.push(error.message));
    await touch.goto(origin + '/show/projects/freeform-breaker/?test=1');
    await touch.locator('#primary').tap();
    const touchBox = await touch.locator('#game').boundingBox();
    await touch.touchscreen.tap(touchBox.x + touchBox.width * .3, touchBox.y + touchBox.height * .5);
    await touch.waitForTimeout(250);
    assert(await touch.evaluate(() => Math.abs(__game.paddle.x - 312) < 20));
    await touch.goto(origin + '/show/projects/apple-explorer/');
    await touch.waitForFunction(() => document.querySelector('#viewport').dataset.ready === 'true');
    await touch.locator('#cut').tap();
    await touch.waitForFunction(() => document.querySelector('#viewport').dataset.actualSeparation === '1.000');
    await touchContext.close();
    console.log('PASS: mobile touch controls for game and apple');
    const noJS = await browser.newContext({ javaScriptEnabled: false });
    const fallback = await noJS.newPage();
    await fallback.goto(origin + '/show/');
    assert.equal(await fallback.locator('noscript a:visible').count(), 2);
    assert(await fallback.locator('#collection-toolbar').isHidden());
    await noJS.close();
    assert.deepEqual(errors, [], 'No browser runtime/console errors');
    assert.deepEqual(responses, [], 'No missing resources');
    assert.deepEqual(external, [], 'No external runtime requests');
    console.log('PASS: no-JS navigation fallback, no browser errors, no 404s, no external runtime requests');
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
