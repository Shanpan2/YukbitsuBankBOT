const { read, add } = require('./store');
const { depositWeeklyRate, earlyWithdrawalFee, loanRate, rules } = require('./rules');

function transactionsFor(userId) { return read().transactions.filter((item) => item.userId === userId); }
function amount(value) { return Number(value ?? 0); }

function summary(userId) {
  const items = transactionsFor(userId);
  let deposits = 0, investments = 0, loanPrincipal = 0, loanInterest = 0, repayments = 0;
  for (const item of items) {
    const value = amount(item.amount);
    if (item.type === 'deposit') deposits += value;
    if (item.type === 'withdrawal') deposits -= value;
    if (item.type === 'investment') investments += value;
    if (item.type === 'investment_withdrawal') investments -= value;
    if (item.type === 'loan') { loanPrincipal += value; loanInterest += amount(item.interestEstimate); }
    if (item.type === 'repayment') repayments += value;
  }
  const restructured = items.some((item) => item.type === 'debt_restructuring');
  if (restructured) loanInterest = 0;
  return { deposits, investments, loanPrincipal, loanInterest, repayments, loanBalance: Math.max(0, loanPrincipal + loanInterest - repayments), items };
}

function activeLoans(userId) { return summary(userId).loanBalance > 0; }

function recordTransaction(input) {
  const value = amount(input.amount);
  if (!Number.isFinite(value) || value <= 0) throw new Error('金額は1以上の数値で入力してください。');
  const current = summary(input.userId);
  const record = { ...input, amount: value, rulesSnapshot: { depositWeeklyRate: depositWeeklyRate(1), loanBaseRate: rules.loanBaseRate } };

  if (input.type === 'loan') {
    if (value > rules.maxLoanAmount) throw new Error(`融資は1回${rules.maxLoanAmount.toLocaleString()}コインまでです。`);
    if (activeLoans(input.userId)) throw new Error('銀行への借入残高があるため、追加融資は記録できません。');
    if (amount(input.externalDebt) >= rules.maxExistingDebtForNewLoan) throw new Error(`現在の借金総額が${rules.maxExistingDebtForNewLoan.toLocaleString()}コイン以上のため融資できません。`);
    if (!input.dueDate || Number.isNaN(new Date(input.dueDate).getTime())) throw new Error('融資には有効な返済期日（YYYY-MM-DD）が必要です。');
    const rate = loanRate({ investmentTotal: current.investments, dueDate: input.dueDate, debtRestructured: false });
    record.appliedInterestRate = rate;
    record.interestEstimate = Math.ceil(value * rate);
  }
  if (input.type === 'withdrawal') {
    if (value > current.deposits) throw new Error('預金残高を超える引出は記録できません。');
    const deposits = current.items.filter((item) => item.type === 'deposit').map((item) => ({ ...item, available: item.amount }));
    let priorWithdrawals = current.items.filter((item) => item.type === 'withdrawal').reduce((sum, item) => sum + item.amount, 0);
    for (const deposit of deposits) {
      const consumed = Math.min(deposit.available, priorWithdrawals);
      deposit.available -= consumed;
      priorWithdrawals -= consumed;
    }
    let remaining = value, fee = 0;
    for (const deposit of deposits) {
      const used = Math.min(remaining, deposit.available);
      fee += earlyWithdrawalFee(used, deposit.createdAt, input.occurredAt || new Date());
      remaining -= used;
      if (remaining <= 0) break;
    }
    record.fee = fee;
  }
  if (input.type === 'debt_restructuring') {
    record.appliedInterestRate = 0;
    record.note = `${input.note || ''}（債務整理後の利子: 0%）`.trim();
  }
  return add('transactions', record);
}

function createApplication(input) { return add('applications', { ...input, status: 'pending' }); }
module.exports = { summary, recordTransaction, createApplication };
