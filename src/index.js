require('dotenv').config();
const { Client, GatewayIntentBits, Partials, REST, Routes, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { createApplication, recordTransaction, summary } = require('./bank');
const { read, updateApplication } = require('./store');
const { rules } = require('./rules');
const { summaryText, transactionText, yen } = require('./format');

const token = process.env.DISCORD_TOKEN;
const adminIds = new Set((process.env.ADMIN_USER_IDS || '').split(',').map((id) => id.trim()).filter(Boolean));
const contactMessage = process.env.CONTACT_MESSAGE || '担当者が内容を確認してDMでご連絡します。';
if (!token) throw new Error('.env に DISCORD_TOKEN を設定してください。');

const transactionChoices = [
  ['預入', 'deposit'], ['融資', 'loan'], ['出資', 'investment'], ['返済', 'repayment'],
  ['預金引出', 'withdrawal'], ['債務整理', 'debt_restructuring'], ['出資引出', 'investment_withdrawal'], ['邪竜特別融資', 'evil_dragon_special_loan']
].map(([name, value]) => ({ name, value }));
const applicationChoices = [['預金', 'deposit'], ['融資', 'loan'], ['出資', 'investment'], ['返済', 'repayment'], ['預金引出', 'withdrawal'], ['債務整理', 'debt_restructuring'], ['その他', 'other']].map(([name, value]) => ({ name, value }));
const commands = [
  new SlashCommandBuilder().setName('apply').setDescription('銀行担当者への申請を送る（DMで利用）')
    .addStringOption((option) => option.setName('type').setDescription('申請種別').setRequired(true).addChoices(...applicationChoices))
    .addIntegerOption((option) => option.setName('amount').setDescription('希望金額（コイン）').setMinValue(1))
    .addStringOption((option) => option.setName('note').setDescription('担当者への補足')),
  new SlashCommandBuilder().setName('balance').setDescription('現在の銀行記録を確認する')
    .addUserOption((option) => option.setName('user').setDescription('管理者用: 確認する利用者')),
  new SlashCommandBuilder().setName('history').setDescription('取引履歴を確認する')
    .addUserOption((option) => option.setName('user').setDescription('管理者用: 確認する利用者')),
  new SlashCommandBuilder().setName('record').setDescription('管理者用: 取引を確定記録する')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((option) => option.setName('user').setDescription('対象利用者').setRequired(true))
    .addStringOption((option) => option.setName('type').setDescription('取引種別').setRequired(true).addChoices(...transactionChoices))
    .addIntegerOption((option) => option.setName('amount').setDescription('金額（コイン）').setRequired(true).setMinValue(1))
    .addIntegerOption((option) => option.setName('external_debt').setDescription('融資審査時の現在借金総額'))
    .addStringOption((option) => option.setName('due_date').setDescription('返済期日 YYYY-MM-DD'))
    .addStringOption((option) => option.setName('note').setDescription('根拠・特約・備考')),
  new SlashCommandBuilder().setName('applications').setDescription('管理者用: 保留中の申請を見る'),
  new SlashCommandBuilder().setName('application-status').setDescription('管理者用: 申請の状態を更新する')
    .addIntegerOption((option) => option.setName('id').setDescription('申請ID').setRequired(true))
    .addStringOption((option) => option.setName('status').setDescription('新しい状態').setRequired(true).addChoices(['承認', 'approved'], ['却下', 'rejected'], ['対応中', 'in_progress']))
].map((command) => command.toJSON());

function isAdmin(interaction) { return adminIds.has(interaction.user.id); }
function isDirectMessage(interaction) { return !interaction.guildId; }
async function audit(client, title, body) {
  const channelId = process.env.AUDIT_CHANNEL_ID;
  if (!channelId) return;
  const channel = await client.channels.fetch(channelId).catch(() => null);
  if (channel?.isTextBased()) await channel.send({ embeds: [{ title, description: body, color: 0x2b90d9, timestamp: new Date().toISOString() }] });
}
function chosenUser(interaction) { return interaction.options.getUser('user') || interaction.user; }

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages], partials: [Partials.Channel] });
client.once('ready', () => console.log(`ログインしました: ${client.user.tag}`));
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  try {
    const command = interaction.commandName;
    if (command === 'apply') {
      if (!isDirectMessage(interaction)) return interaction.reply({ content: 'この申請はBOTとのDMで送ってください。', ephemeral: true });
      const application = createApplication({ userId: interaction.user.id, username: interaction.user.tag, type: interaction.options.getString('type'), amount: interaction.options.getInteger('amount'), note: interaction.options.getString('note') || '' });
      await interaction.reply(`申請を受け付けました（受付番号: ${application.id}）。${contactMessage}`);
      await audit(client, `新規申請 #${application.id}`, `申請者: <@${application.userId}>\n種別: ${application.type}\n希望額: ${application.amount ? yen(application.amount) : '未指定'}\n備考: ${application.note || 'なし'}`);
      return;
    }
    if ((command === 'record' || command === 'applications' || command === 'application-status') && !isAdmin(interaction)) return interaction.reply({ content: 'この管理コマンドを実行する権限がありません。', ephemeral: true });
    if ((command === 'balance' || command === 'history') && interaction.options.getUser('user') && !isAdmin(interaction)) return interaction.reply({ content: '他の利用者の記録は確認できません。', ephemeral: true });
    if (command === 'balance') return interaction.reply({ content: summaryText(chosenUser(interaction), summary(chosenUser(interaction).id)), ephemeral: true });
    if (command === 'history') {
      const user = chosenUser(interaction), entries = summary(user.id).items.slice(-10).reverse();
      const content = entries.length ? entries.map((item) => `#${item.id} ${item.createdAt.slice(0, 10)} | ${item.type} | ${yen(item.amount)}${item.fee ? ` | 手数料 ${yen(item.fee)}` : ''}`).join('\n') : '取引記録はまだありません。';
      return interaction.reply({ content, ephemeral: true });
    }
    if (command === 'applications') {
      const pending = read().applications.filter((item) => item.status === 'pending').slice(-20).reverse();
      return interaction.reply({ content: pending.length ? pending.map((item) => `#${item.id} <@${item.userId}> ${item.type} ${item.amount ? yen(item.amount) : ''} — ${item.note || '備考なし'}`).join('\n') : '保留中の申請はありません。', ephemeral: true });
    }
    if (command === 'application-status') {
      const result = updateApplication(interaction.options.getInteger('id'), { status: interaction.options.getString('status'), handledBy: interaction.user.id });
      if (!result) return interaction.reply({ content: '該当する申請が見つかりません。', ephemeral: true });
      await audit(client, `申請状態を更新 #${result.id}`, `申請者: <@${result.userId}>\n状態: ${result.status}\n担当: <@${interaction.user.id}>`);
      return interaction.reply({ content: `申請 #${result.id} を「${result.status}」に更新しました。`, ephemeral: true });
    }
    if (command === 'record') {
      const user = interaction.options.getUser('user'), type = interaction.options.getString('type');
      const transaction = recordTransaction({ userId: user.id, username: user.tag, type, amount: interaction.options.getInteger('amount'), externalDebt: interaction.options.getInteger('external_debt') || 0, dueDate: interaction.options.getString('due_date'), note: interaction.options.getString('note') || '', recordedBy: interaction.user.id });
      await interaction.reply({ content: `取引 #${transaction.id} を確定記録しました。\n${transactionText(transaction)}`, ephemeral: true });
      await audit(client, `取引記録 #${transaction.id}`, `対象: <@${user.id}>\n記録者: <@${interaction.user.id}>\n${transactionText(transaction)}`);
    }
  } catch (error) {
    console.error(error);
    const message = `処理できませんでした: ${error.message}`;
    if (interaction.replied || interaction.deferred) await interaction.followUp({ content: message, ephemeral: true });
    else await interaction.reply({ content: message, ephemeral: true });
  }
});

async function main() {
  const rest = new REST().setToken(token);
  await client.login(token);
  const appId = client.user.id;
  if (process.env.GUILD_ID) await rest.put(Routes.applicationGuildCommands(appId, process.env.GUILD_ID), { body: commands });
  else await rest.put(Routes.applicationCommands(appId), { body: commands });
  console.log('スラッシュコマンドを登録しました。');
}
main();
