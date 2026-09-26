const { write } = require('./store');
const now = new Date();
const daysAgo = (days) => new Date(now.getTime() - days * 86400000).toISOString();
write({
  nextId: 5,
  applications: [{ id: 1, createdAt: daysAgo(1), userId: 'TEST_USER_ID', username: 'demo-user', type: 'loan', amount: 50000, note: 'テスト申請', status: 'pending' }],
  transactions: [
    { id: 2, createdAt: daysAgo(10), userId: 'TEST_USER_ID', username: 'demo-user', type: 'deposit', amount: 30000 },
    { id: 3, createdAt: daysAgo(8), userId: 'TEST_USER_ID', username: 'demo-user', type: 'investment', amount: 50000 },
    { id: 4, createdAt: daysAgo(2), userId: 'TEST_USER_ID', username: 'demo-user', type: 'loan', amount: 50000, dueDate: '2026-10-10', appliedInterestRate: 0.048, interestEstimate: 2400 }
  ]
});
console.log('data/bank.json にデモデータを作成しました。TEST_USER_ID は実際のDiscord IDに置き換えてください。');
