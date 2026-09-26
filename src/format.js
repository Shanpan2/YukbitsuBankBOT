function yen(value) { return `${Number(value || 0).toLocaleString()} コイン`; }
function summaryText(user, data) {
  return [
    `**${user.username} さんの記録**`,
    `預金残高: ${yen(data.deposits)}`,
    `出資残高: ${yen(data.investments)}`,
    `借入元金: ${yen(data.loanPrincipal)}`,
    `見込利子: ${yen(data.loanInterest)}`,
    `返済済み: ${yen(data.repayments)}`,
    `借入残高: ${yen(data.loanBalance)}`
  ].join('\n');
}
function transactionText(transaction) {
  const details = [`種別: ${transaction.type}`, `金額: ${yen(transaction.amount)}`];
  if (transaction.appliedInterestRate !== undefined) details.push(`適用利率: ${(transaction.appliedInterestRate * 100).toFixed(1)}%`);
  if (transaction.interestEstimate) details.push(`見込利子: ${yen(transaction.interestEstimate)}`);
  if (transaction.fee) details.push(`早期引出手数料: ${yen(transaction.fee)}`);
  if (transaction.dueDate) details.push(`返済期日: ${transaction.dueDate}`);
  if (transaction.note) details.push(`備考: ${transaction.note}`);
  return details.join('\n');
}
module.exports = { yen, summaryText, transactionText };
