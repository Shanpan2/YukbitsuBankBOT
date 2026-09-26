const DAY_MS = 24 * 60 * 60 * 1000;

const rules = {
  currencyName: 'コイン',
  minimumDepositDays: 7,
  earlyWithdrawalFeeRate: 0.05,
  maxLoanAmount: 100_000,
  maxExistingDebtForNewLoan: 200_000,
  loanBaseRate: 0.05,
  loanOnTimeDiscount: 0.01,
  lateRateAdjustments: [
    { minDays: 10, adjustment: 0.07 },
    { minDays: 7, adjustment: 0.05 },
    { minDays: 5, adjustment: 0.03 }
  ],
  investmentDiscounts: [
    { minimum: 500_000, discount: 0.01 },
    { minimum: 250_000, discount: 0.007 },
    { minimum: 100_000, discount: 0.004 },
    { minimum: 50_000, discount: 0.002 }
  ],
  loanMinimumRate: 0.02
};

function depositWeeklyRate(weeks) {
  return Math.min(0.01 + Math.max(0, weeks - 1) * 0.001, 0.05);
}

function investmentDiscount(investmentTotal) {
  return rules.investmentDiscounts.find((tier) => investmentTotal >= tier.minimum)?.discount ?? 0;
}

function loanRate({ loanAmount, investmentTotal = 0, dueDate, repaidAt = new Date(), debtRestructured = false }) {
  if (debtRestructured) return 0;
  let rate = rules.loanBaseRate - investmentDiscount(investmentTotal);
  const due = new Date(dueDate);
  const lateDays = Math.floor((new Date(repaidAt) - due) / DAY_MS);
  if (lateDays <= 0) rate -= rules.loanOnTimeDiscount;
  else rate += rules.lateRateAdjustments.find((tier) => lateDays >= tier.minDays)?.adjustment ?? 0;
  return Math.max(rules.loanMinimumRate, rate);
}

function earlyWithdrawalFee(amount, depositedAt, withdrawnAt = new Date()) {
  const ageDays = (new Date(withdrawnAt) - new Date(depositedAt)) / DAY_MS;
  return ageDays < rules.minimumDepositDays ? Math.ceil(amount * rules.earlyWithdrawalFeeRate) : 0;
}

module.exports = { DAY_MS, rules, depositWeeklyRate, investmentDiscount, loanRate, earlyWithdrawalFee };
