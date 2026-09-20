import { expect, test } from '@playwright/test';

test('cut, inspect, close, slider, rotate and reset work without runtime errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const viewport = page.locator('#viewport');
  await expect(viewport).toHaveAttribute('data-ready', 'true');
  await expect(page.locator('#scene-error')).toBeHidden();
  await page.screenshot({ path: 'test-results/apple-whole.png', fullPage: true });
  await page.getByRole('button', { name: '切开苹果', exact: true }).click();
  await expect(viewport).toHaveAttribute('data-cutting', 'true');
  await expect(viewport).toHaveAttribute('data-separation', '100');
  await expect(viewport).toHaveAttribute('data-actual-separation', '1.000', { timeout: 10000 });
  await expect(page.locator('#part-labels')).toBeVisible();
  await page.screenshot({ path: 'test-results/apple-cut.png', fullPage: true });
  await page.locator('.part[data-part="seed"]').click();
  await expect(page.locator('#discovery-title')).toHaveText('种子是竖着藏在里面的');
  await page.getByRole('button', { name: '◎ 看横截面' }).click();
  await expect(viewport).toHaveAttribute('data-view', 'section');
  await expect(page.locator('#separation')).toBeDisabled();
  await page.waitForTimeout(1600);
  await page.screenshot({ path: 'test-results/apple-section.png', fullPage: true });
  await page.getByRole('button', { name: '合拢苹果', exact: true }).click();
  await expect(viewport).toHaveAttribute('data-view', '3d');
  await expect(viewport).toHaveAttribute('data-separation', '0');
  await page.locator('#separation').fill('50');
  await expect(page.locator('#separation-value')).toHaveText('50%');
  await page.locator('#rotate').click();
  await expect(page.locator('#rotate')).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#reset').click();
  await expect(viewport).toHaveAttribute('data-separation', '0');
  await expect(page.locator('#rotate')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.locator('#discovery-title')).toHaveText('先看看它的外衣');
  expect(errors).toEqual([]);
});

test('narrow touch layout fits and reduced motion bypasses knife animation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#viewport')).toHaveAttribute('data-ready', 'true');
  await page.locator('#cut').click();
  await expect(page.locator('#viewport')).toHaveAttribute('data-cutting', 'false');
  await expect(page.locator('#viewport')).toHaveAttribute('data-actual-separation', '1.000');
  await page.screenshot({ path: 'test-results/apple-mobile.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.locator('#view-section').click();
  await page.screenshot({ path: 'test-results/apple-mobile-section.png', fullPage: true });
  await page.locator('#reset').click();
  await expect(page.locator('#viewport')).toHaveAttribute('data-actual-separation', '0.000');
});

test('changing views or resetting during a cut cancels the knife cleanly', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#viewport')).toHaveAttribute('data-ready', 'true');
  await page.locator('#cut').click();
  await page.locator('#reset').click();
  await expect(page.locator('#viewport')).toHaveAttribute('data-cutting', 'false');
  await page.waitForTimeout(1200);
  await expect(page.locator('#viewport')).toHaveAttribute('data-separation', '0');
  await page.locator('#cut').click();
  await page.locator('#view-section').click();
  await expect(page.locator('#viewport')).toHaveAttribute('data-view', 'section');
  await expect(page.locator('#viewport')).toHaveAttribute('data-cutting', 'false');
  await page.locator('#view-3d').click();
  await expect(page.locator('#separation')).toBeEnabled();
});

test('closed halves share the same equator and have opposite cap normals', async ({ page }) => {
  await page.goto('/');
  const result = await page.evaluate(async () => {
    // Import the exact application geometry in the browser via Vite, rather than a test duplicate.
    const path = '/src/apple.ts';
    const { makeSkinGeometry, makeCapGeometry, createApple } = await import(/* @vite-ignore */ path);
    const upper = makeSkinGeometry(true), lower = makeSkinGeometry(false);
    const u = upper.getAttribute('position'), l = lower.getAttribute('position');
    const rowSize = 145;
    let maxGap = 0;
    for (let i = 0; i < rowSize; i++) {
      const ui = u.count - rowSize + i;
      maxGap = Math.max(maxGap, Math.hypot(u.getX(ui) - l.getX(i), u.getY(ui) - l.getY(i), u.getZ(ui) - l.getZ(i)));
    }
    const upperCap = makeCapGeometry(true), lowerCap = makeCapGeometry(false);
    const model = createApple();
    const result = { maxGap, topNormal: upperCap.getAttribute('normal').getY(0), bottomNormal: lowerCap.getAttribute('normal').getY(0), upperIds: model.upperInterior.children.filter((c: { userData: { seedId?: string } }) => c.userData.seedId).map((c: { userData: { seedId: string } }) => c.userData.seedId), lowerIds: model.lowerInterior.children.filter((c: { userData: { seedId?: string } }) => c.userData.seedId).map((c: { userData: { seedId: string } }) => c.userData.seedId) };
    [upper, lower, upperCap, lowerCap].forEach(g => g.dispose());
    return result;
  });
  expect(result.maxGap).toBeLessThan(1e-6);
  expect(result.topNormal).toBe(-1); expect(result.bottomNormal).toBe(1);
  expect(result.upperIds).toEqual(result.lowerIds);
  expect(new Set([...result.upperIds, ...result.lowerIds]).size).toBe(10);
});

test('upright seeds are genuinely clipped; matching halves conserve each original seed', async ({ page }) => {
  await page.goto('/');
  const results = await page.evaluate(async () => {
    const path = '/src/apple.ts';
    const { SEED_SPECS, createWholeSeedGeometry, sliceSeedGeometry } = await import(/* @vite-ignore */ path);
    // Signed tetrahedron volumes include the planar caps (at y=0) and the exterior.
    function volume(geometry: any) {
      const g = geometry.index ? geometry.toNonIndexed() : geometry;
      const p = g.getAttribute('position'); let total = 0;
      for (let i = 0; i < p.count; i += 3) {
        const a = [p.getX(i), p.getY(i), p.getZ(i)], b = [p.getX(i + 1), p.getY(i + 1), p.getZ(i + 1)], c = [p.getX(i + 2), p.getY(i + 2), p.getZ(i + 2)];
        total += (a[0] * (b[1] * c[2] - b[2] * c[1]) + a[1] * (b[2] * c[0] - b[0] * c[2]) + a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
      }
      if (g !== geometry) g.dispose();
      return Math.abs(total);
    }
    const result = SEED_SPECS.map((spec: any) => {
      const source = createWholeSeedGeometry(spec);
      const upper = sliceSeedGeometry(source, true), lower = sliceSeedGeometry(source, false);
      source.computeBoundingBox(); upper.surface.computeBoundingBox(); lower.surface.computeBoundingBox();
      const box = source.boundingBox;
      const wholeVolume = volume(source), upperVolume = volume(upper.surface), lowerVolume = volume(lower.surface);
      const up = upper.section.getAttribute('position'), lp = lower.section.getAttribute('position');
      let contourGap = 0, offPlane = 0;
      // Opposite winding swaps vertices 1 and 2 in each triangle.
      for (let i = 0; i < up.count; i++) {
        const j = Math.floor(i / 3) * 3 + [0, 2, 1][i % 3];
        contourGap = Math.max(contourGap, Math.hypot(up.getX(i) - lp.getX(j), up.getZ(i) - lp.getZ(j)));
        offPlane = Math.max(offPlane, Math.abs(up.getY(i)), Math.abs(lp.getY(j)));
      }
      const data = {
        axisRatio: (box.max.y - box.min.y) / Math.max(box.max.x - box.min.x, box.max.z - box.min.z),
        upperMinY: upper.surface.boundingBox.min.y, lowerMaxY: lower.surface.boundingBox.max.y,
        volumeError: Math.abs(upperVolume + lowerVolume - wholeVolume) / wholeVolume,
        upperFraction: upperVolume / wholeVolume, lowerFraction: lowerVolume / wholeVolume,
        contourGap, offPlane, sectionVertices: up.count,
        upperNormal: upper.section.getAttribute('normal').getY(0), lowerNormal: lower.section.getAttribute('normal').getY(0),
      };
      [source, upper.surface, upper.section, lower.surface, lower.section].forEach(g => g.dispose());
      return data;
    });
    // A seed below the knife remains below; the other half gets neither a body nor a cross-section.
    const below = createWholeSeedGeometry({ ...SEED_SPECS[0], position: [.4, -.6, 0] });
    const empty = sliceSeedGeometry(below, true), retained = sliceSeedGeometry(below, false);
    const missed = { emptyBody: empty.surface.getAttribute('position').count, emptySection: empty.section.getAttribute('position').count, retainedFraction: volume(retained.surface) / volume(below) };
    [below, empty.surface, empty.section, retained.surface, retained.section].forEach(g => g.dispose());
    return { seeds: result, missed };
  });
  expect(results.seeds).toHaveLength(10);
  for (const seed of results.seeds) {
    expect(seed.axisRatio).toBeGreaterThan(2.5);
    expect(seed.upperMinY).toBeGreaterThanOrEqual(0);
    expect(seed.lowerMaxY).toBeLessThanOrEqual(0);
    expect(seed.volumeError).toBeLessThan(1e-5);
    expect(seed.upperFraction).toBeGreaterThan(.1); expect(seed.upperFraction).toBeLessThan(.9);
    expect(seed.lowerFraction).toBeGreaterThan(.1); expect(seed.lowerFraction).toBeLessThan(.9);
    expect(seed.contourGap).toBeLessThan(1e-6); expect(seed.offPlane).toBe(0);
    expect(seed.sectionVertices).toBeGreaterThan(0);
    expect(seed.upperNormal).toBe(-1); expect(seed.lowerNormal).toBe(1);
  }
  expect(results.missed.emptyBody).toBe(0); expect(results.missed.emptySection).toBe(0);
  expect(results.missed.retainedFraction).toBeCloseTo(1, 6);
});

test('seed direction view reunites the original seeds and exits safely into a cut', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#viewport')).toHaveAttribute('data-ready', 'true');
  await page.locator('#cut').click();
  await expect(page.locator('#viewport')).toHaveAttribute('data-actual-separation', '1.000');
  await page.getByRole('button', { name: '↕ 看种子方向', exact: true }).click();
  await expect(page.locator('#viewport')).toHaveAttribute('data-view', 'seeds');
  await expect(page.locator('#viewport')).toHaveAttribute('data-actual-separation', '0.000');
  await expect(page.locator('#seed-inspection-note')).toBeVisible();
  await expect(page.locator('#separation')).toBeDisabled();
  await expect(page.locator('#question-title')).toHaveText('一颗，不是两颗');
  await page.screenshot({ path: 'test-results/apple-seed-direction.png', fullPage: true });
  await page.locator('#cut').click();
  await expect(page.locator('#viewport')).toHaveAttribute('data-view', '3d');
  await expect(page.locator('#viewport')).toHaveAttribute('data-actual-separation', '1.000');
  await expect(page.locator('#section-note')).toBeVisible();
  await expect(page.locator('#seed-inspection-note')).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#view-seeds').click();
  await page.screenshot({ path: 'test-results/apple-mobile-seed-direction.png', fullPage: true });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#reset').click();
  await expect(page.locator('#viewport')).toHaveAttribute('data-view', '3d');
  await expect(page.locator('#view-seeds')).toHaveAttribute('aria-pressed', 'false');
  expect(errors).toEqual([]);
});

test('source page keeps the showcase return entry and shared style', async ({ page }) => {
  await page.goto('/');
  const navigation = page.getByRole('navigation', { name: '作品集导航' });
  await expect(navigation).toBeVisible();
  await expect(navigation.getByRole('link', { name: '← 返回小小作品集' })).toHaveAttribute('href', '../../');
  expect(await navigation.evaluate(el => getComputedStyle(el).display)).toBe('flex');
});

for (const size of [{ width: 320, height: 667 }, { width: 390, height: 844 }, { width: 768, height: 1024 }]) {
  test(`observation dock keeps controls with the canvas at ${size.width}px`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.setViewportSize(size);
    await page.goto('/');
    await expect(page.locator('#viewport')).toHaveAttribute('data-ready', 'true');
    const scene = await page.locator('.experiment').boundingBox();
    const canvas = await page.locator('#viewport').boundingBox();
    const discovery = await page.locator('.discovery').boundingBox();
    expect(scene!.y + scene!.height).toBeLessThanOrEqual(size.height);
    expect(canvas!.height).toBeGreaterThan(260);
    expect(discovery!.y).toBeGreaterThan(scene!.y + scene!.height);
    for (const id of ['cut', 'reset', 'separation', 'view-3d', 'view-seeds', 'view-section']) {
      const control = page.locator(`.experiment #${id}`);
      await expect(control).toBeVisible();
      const box = await control.boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(canvas!.y + canvas!.height);
      expect(box!.y + box!.height).toBeLessThanOrEqual(scene!.y + scene!.height);
      expect(box!.height).toBeGreaterThanOrEqual(44);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await page.locator('#separation').focus();
    await page.keyboard.press('End');
    await expect(page.locator('#viewport')).toHaveAttribute('data-actual-separation', '1.000');
    await page.keyboard.press('Home');
    await expect(page.locator('#viewport')).toHaveAttribute('data-actual-separation', '0.000');
    await page.locator('#view-seeds').click();
    await expect(page.locator('#separation-hint')).toHaveText('立体观察可调');
    await page.locator('#view-3d').click();
    await expect(page.locator('#separation')).toBeEnabled();
    await expect(page.locator('#separation-hint')).toHaveText('看清里面');
  });
}

test('touch dragging the in-scene slider adjusts separation without scrolling the page', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await context.newPage();
  try {
    await page.goto('http://127.0.0.1:5188/');
    await expect(page.locator('#viewport')).toHaveAttribute('data-ready', 'true');
    await page.locator('#rotate').tap();
    const box = (await page.locator('#separation').boundingBox())!;
    const beforeScroll = await page.evaluate(() => scrollY);
    const session = await context.newCDPSession(page);
    const y = box.y + box.height / 2;
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + 8, y }] });
    for (let step = 1; step <= 8; step++) {
      await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: box.x + 8 + (box.width - 16) * step / 8, y }] });
    }
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await expect(page.locator('#viewport')).toHaveAttribute('data-actual-separation', '1.000');
    await expect(page.locator('#rotate')).toHaveAttribute('aria-pressed', 'false');
    expect(await page.evaluate(() => scrollY)).toBe(beforeScroll);
    await page.screenshot({ path: 'test-results/apple-mobile-dock.png', fullPage: true });
    await page.locator('#reset').tap();
    await expect(page.locator('#viewport')).toHaveAttribute('data-actual-separation', '0.000');
  } finally {
    await context.close();
  }
});
