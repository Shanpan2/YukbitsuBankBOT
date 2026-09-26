const test = require('node:test');
const assert = require('node:assert/strict');
const { depositWeeklyRate, earlyWithdrawalFee, loanRate } = require('../src/rules');

test('預金金利は週数に応じて増え、5%で上限になる', () => {
  assert.equal(depositWeeklyRate(1), 0.01);
  assert.equal(depositWeeklyRate(3), 0.012);
  assert.equal(depositWeeklyRate(100), 0.05);
});
test('一週間未満の引出には5%手数料がかかる', () => {
  assert.equal(earlyWithdrawalFee(1000, '2026-01-01', '2026-01-07'), 50);
  assert.equal(earlyWithdrawalFee(1000, '2026-01-01', '2026-01-08'), 0);
});
test('債務整理後の利子は0%', () => {
  assert.equal(loanRate({ dueDate: '2026-01-01', debtRestructured: true }), 0);
});
