// Real Hermes controls and styles with an isolated production Store fixture.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { writeFile } from 'node:fs/promises';
const out = process.env.ISSUE4_OUT;
assert(out && process.env.TMPDIR?.startsWith(out));
const require = createRequire(process.cwd() + '/.local/host/.build/webapp-workspace/apps/desktop/package.json');
const { chromium } = require('@playwright/test');
const browser = await chromium.launch({ headless: true, chromiumSandbox: true,
  executablePath: '/home/mike/.cache/ms-playwright/chromium-1234/chrome-linux64/chrome' });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [], cases = [];
page.on('pageerror', e => errors.push(e.message));
const button = (name, scope = page) => scope.getByRole('button', { name, exact: true });
const dataset = async name => {
  await page.goto('http://127.0.0.1:' + (process.env.ISSUE4_PORT ?? '19571'));
  await page.getByRole('heading', { name: 'Field observations', exact: true }).waitFor();
  await page.getByLabel('Fixture dataset').selectOption({ label: name });
  await page.getByRole('heading', { name, exact: true }).waitFor();
};
const recordForm = () => page.getByRole('form', { name: 'New record', exact: true });
const propertyForm = () => page.getByRole('form', { name: 'New property', exact: true });
const chooseNew = async name => {
  await button('New').click();
  await button(name, page.getByRole('group', { name: 'Create new', exact: true })).click();
};
try {
  for (const width of [1280, 420]) {
    await page.setViewportSize({ width, height: width === 420 ? 540 : 800 });
    await dataset('Long observations');
    await page.locator('.ws-table-wrap').evaluate(e => { e.scrollLeft = e.scrollWidth; e.scrollTop = e.scrollHeight; });
    await page.locator('.ws-work').evaluate(e => { e.style.height = '280px'; e.style.maxHeight = '280px'; e.scrollTop = 140; });
    assert(await page.locator('.ws-work').evaluate(e => e.scrollTop) > 0, 'Outer pane actually scrolled');
    const sticky = await button('New').boundingBox(), scrollPane = await page.locator('.ws-work').boundingBox();
    assert(sticky.y >= scrollPane.y && sticky.y + sticky.height <= scrollPane.y + scrollPane.height, 'New stays visible after outer-pane scrolling');
    await page.locator('.ws-work').evaluate(e => { e.style.height = ''; e.style.maxHeight = ''; e.scrollTop = 0; });
    for (const theme of ['light', 'dark']) {
      await page.evaluate(theme => window.issue4Theme(theme), theme);
      const before = await button('New').boundingBox();
      const pane = await page.locator('.ws-work').boundingBox();
      assert(before.x >= pane.x && before.x + before.width <= pane.x + pane.width + 1);
      await page.locator('.ws-work').evaluate(e => { e.scrollTop = 100; });
      const after = await button('New').boundingBox();
      assert(after.y >= pane.y && after.y + after.height <= pane.y + pane.height);
      assert.equal(await button('New').evaluate(e => getComputedStyle(e.parentElement).position), 'sticky');
      await button('New').focus(); await page.keyboard.press('Enter');
      const group = page.getByRole('group', { name: 'Create new', exact: true });
      await group.waitFor();
      assert.equal(await button('New record', group).evaluate(e => e === document.activeElement), true);
      await page.keyboard.press('Enter');
      const form = recordForm(), input = form.getByRole('textbox', { name: 'New record title', exact: true });
      await input.waitFor();
      assert.equal(await input.evaluate(e => e === document.activeElement), true);
      await input.fill(`Visible ${width} ${theme}`);
      const box = await form.boundingBox();
      assert(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= (width === 420 ? 540 : 800));
      await page.screenshot({ path: out + `/screenshots/new-record-${width}-${theme}.png` });
      await page.keyboard.press('Enter');
      await form.getByRole('status').filter({ hasText: 'Created' }).waitFor();
      await button('Cancel new record', form).click();
      assert.equal(await button('New').evaluate(e => e === document.activeElement), true);
      await chooseNew('New property');
      const property = propertyForm(), name = property.getByRole('textbox', { name: 'Property name', exact: true });
      await name.fill(`Property ${width} ${theme}`);
      await page.screenshot({ path: out + `/screenshots/new-property-${width}-${theme}.png` });
      const pbox = await property.boundingBox();
      assert(pbox.x >= 0 && pbox.x + pbox.width <= width + 1);
      await button('Add property', property).click(); await property.waitFor({ state: 'hidden' });
      assert.equal(await button('New').evaluate(e => e === document.activeElement), true);
      cases.push({ name: `scroll, keyboard, record and property ${width} ${theme}`, result: 'PASS', newButton: after });
    }
  }
  await dataset('Field observations');
  await page.getByRole('combobox', { name: 'View', exact: true }).click();
  await page.getByRole('option', { name: 'Board', exact: true }).click();
  await chooseNew('New record');
  await recordForm().getByRole('textbox', { name: 'New record title', exact: true }).fill('Top board record');
  await button('Create record', recordForm()).click();
  await button('Top board record', page.getByRole('region', { name: 'Board group: Unassigned', exact: true })).waitFor();
  await button('Cancel new record').click();
  await chooseNew('New property'); await propertyForm().waitFor(); await button('Cancel', propertyForm()).click();
  cases.push({ name: 'board creation without scrolling to a group', result: 'PASS' });
  await dataset('Locked observations'); assert.equal(await button('New').isDisabled(), true);
  cases.push({ name: 'locked database disables New', result: 'PASS' });
  assert.deepEqual(errors, []);
} catch (error) {
  await page.screenshot({ path: out + '/screenshots/new-menu-failure.png' }).catch(() => {});
  cases.push({ name: 'browser run', result: 'FAIL', message: error.stack });
  throw error;
} finally {
  await writeFile(out + '/logs/new-menu.json', JSON.stringify({ cases, errors,
    scope: 'Headless Chromium, real pinned Hermes UI controls/styles, synthetic local adapter and production Store. Installed Electron rendering remains separate.' }, null, 2));
  await browser.close();
}
console.log(JSON.stringify({ cases, errors }));
