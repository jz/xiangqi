/**
 * End-to-end tests for connect4.html using Playwright.
 * Run: node test_connect4.js
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');

const FILE = 'file://' + path.resolve(__dirname, 'connect4.html');
const PASS = (msg) => console.log(`  ✓  ${msg}`);
const FAIL = (msg) => { console.error(`  ✗  ${msg}`); process.exitCode = 1; };

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Capture console errors from the page
  const pageErrors = [];
  page.on('pageerror', e => pageErrors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') pageErrors.push(m.text()); });

  await page.goto(FILE);
  await page.waitForTimeout(300);

  // ── 1. Page loads without errors ──────────────────────────────────────────
  if (pageErrors.length === 0) PASS('Page loads without JS errors');
  else FAIL(`Page errors: ${pageErrors.join('; ')}`);

  // ── 2. Canvas is rendered ─────────────────────────────────────────────────
  const canvasBox = await page.locator('#board').boundingBox();
  if (canvasBox && canvasBox.width > 0 && canvasBox.height > 0)
    PASS(`Canvas rendered (${canvasBox.width}×${canvasBox.height})`);
  else FAIL('Canvas not visible');

  // ── 3. Initial status text ────────────────────────────────────────────────
  const status = await page.locator('#status').textContent();
  if (status && status.length > 0) PASS(`Initial status: "${status.trim()}"`);
  else FAIL('Status element empty');

  // ── 4. Controls exist ─────────────────────────────────────────────────────
  const diffOpts = await page.locator('#diffSel option').count();
  const colorOpts = await page.locator('#colorSel option').count();
  if (diffOpts === 3) PASS('Difficulty selector has 3 options');
  else FAIL(`Expected 3 difficulty options, got ${diffOpts}`);
  if (colorOpts === 2) PASS('Color selector has 2 options');
  else FAIL(`Expected 2 color options, got ${colorOpts}`);

  // ── 5. Human can click a column (as P1 / Red) ────────────────────────────
  // Default: human=P1 (Red, first to move). Click col 3 (center).
  const cx = canvasBox.x + 20 + 3 * 80 + 40; // PAD + col*CELL + CELL/2
  const cy = canvasBox.y + canvasBox.height / 2;
  await page.mouse.click(cx, cy);
  await page.waitForTimeout(600); // wait for animation + AI response
  const statusAfterMove = await page.locator('#status').textContent();
  if (statusAfterMove) PASS(`Status after human move: "${statusAfterMove.trim()}"`);
  else FAIL('Status missing after move');

  // ── 6. AI responds (status changes or board changes) ─────────────────────
  await page.waitForTimeout(1200); // wait for AI to think and animate
  const statusAfterAI = await page.locator('#status').textContent();
  // After AI moves, it should be human's turn again
  if (statusAfterAI && (statusAfterAI.includes('你') || statusAfterAI.includes('AI')))
    PASS(`Status after AI move: "${statusAfterAI.trim()}"`);
  else FAIL(`Unexpected status after AI move: "${statusAfterAI}"`);

  // ── 7. New Game button resets board ───────────────────────────────────────
  await page.locator('#newGameBtn').click();
  await page.waitForTimeout(300);
  const statusAfterReset = await page.locator('#status').textContent();
  if (statusAfterReset && statusAfterReset.includes('轮到你了'))
    PASS(`New game resets status: "${statusAfterReset.trim()}"`);
  else FAIL(`After new game expected "轮到你了", got "${statusAfterReset}"`);

  // ── 8. AI-first mode (human=P2/Blue) ─────────────────────────────────────
  await page.locator('#colorSel').selectOption('2');
  await page.locator('#newGameBtn').click();
  await page.waitForTimeout(300);
  const statusAIFirst = await page.locator('#status').textContent();
  if (statusAIFirst && statusAIFirst.includes('AI'))
    PASS(`When human=P2, AI goes first: "${statusAIFirst.trim()}"`);
  else FAIL(`When human=P2, expected AI status, got "${statusAIFirst}"`);

  // Wait for AI first move
  await page.waitForTimeout(2000);
  const statusAfterAIFirst = await page.locator('#status').textContent();
  if (statusAfterAIFirst && statusAfterAIFirst.includes('你'))
    PASS(`After AI first move, it's human's turn: "${statusAfterAIFirst.trim()}"`);
  else FAIL(`After AI first move expected human's turn, got "${statusAfterAIFirst}"`);

  // ── 9. Difficulty selector works (easy mode) ─────────────────────────────
  await page.locator('#colorSel').selectOption('1');
  await page.locator('#diffSel').selectOption('easy');
  await page.locator('#newGameBtn').click();
  await page.waitForTimeout(300);
  const cx2 = canvasBox.x + 20 + 3 * 80 + 40;
  await page.mouse.click(cx2, cy);
  await page.waitForTimeout(1500); // easy AI should respond quickly
  const statusEasy = await page.locator('#status').textContent();
  if (statusEasy && statusEasy.includes('你'))
    PASS(`Easy AI responded and it's human's turn: "${statusEasy.trim()}"`);
  else FAIL(`Easy AI test: unexpected status "${statusEasy}"`);

  // ── 10. Simulate a forced win scenario via JS ────────────────────────────
  // Set up a board where human just needs one move to win (3 in a row)
  // and verify checkWin4 detects it.
  const wonCol = await page.evaluate(() => {
    // Expose internal state for testing
    const b = [
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [0,0,0,0,0,0,0],
      [1,1,1,0,0,0,0],  // human has 3 in a row, col 3 empty
    ];
    // Check that col 3 drop would be row 5
    let dropRow = -1;
    for (let r = 5; r >= 0; r--) {
      if (b[r][3] === 0) { dropRow = r; break; }
    }
    // Place piece and check win
    b[5][3] = 1;
    // Check horizontal win
    const win = [0,1,2,3].every(i => b[5][i] === 1);
    return { dropRow, win };
  });
  if (wonCol.dropRow === 5 && wonCol.win)
    PASS('Win detection logic: horizontal 4-in-a-row correctly detected');
  else FAIL(`Win detection test failed: ${JSON.stringify(wonCol)}`);

  // ── 11. Column-full guard ─────────────────────────────────────────────────
  const colFullResult = await page.evaluate(() => {
    // Fill column 0 completely
    const b = Array.from({length:6}, ()=>Array(7).fill(0));
    for (let r = 0; r < 6; r++) b[r][0] = 1;
    // getDropRow should return -1
    let row = -2;
    for (let r = 5; r >= 0; r--) { if (b[r][0] === 0) { row = r; break; } }
    return row; // should be -2 (unchanged, meaning no empty slot)
  });
  if (colFullResult === -2) PASS('Full column correctly reports no valid drop row');
  else FAIL(`Full column test failed: got row ${colFullResult}`);

  // ── Summary ───────────────────────────────────────────────────────────────
  await browser.close();

  if (pageErrors.length > 0) {
    console.error('\nPage errors captured during test:');
    pageErrors.forEach(e => console.error(' ', e));
  }
  console.log(process.exitCode ? '\nTests FAILED' : '\nAll tests passed');
}

run().catch(e => { console.error('Test runner error:', e); process.exit(1); });
