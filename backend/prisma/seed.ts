/* eslint-disable no-console */
import { PrismaClient, UserRole, TemplateTrigger } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const name = process.env.SEED_MANAGER_NAME || 'Klaus Toneto';
  const email = process.env.SEED_MANAGER_EMAIL || 'admin@crm.local';
  const password = process.env.SEED_MANAGER_PASSWORD || 'ChangeMe@123';
  const rounds = Number(process.env.BCRYPT_SALT_ROUNDS || 12);

  // ---------------- Gerente inicial ----------------
  let manager = await prisma.user.findUnique({ where: { email } });
  if (!manager) {
    const passwordHash = await bcrypt.hash(password, rounds);
    manager = await prisma.user.create({
      data: { name, email, passwordHash, role: UserRole.MANAGER, isActive: true },
    });
    console.log(`[seed] Gerente criado: ${email}`);
  } else {
    console.log(`[seed] Gerente já existe: ${email}`);
  }

  // ---------------- Templates de mensagem ----------------
  const seedTemplates = [
    {
      name: 'Lembrete de Reposição (padrão)',
      trigger: TemplateTrigger.REPLENISHMENT_REMINDER,
      body:
        'Olá {{contactName}}, tudo bem? Aqui é da equipe e estou passando para acompanhar a ' +
        '{{companyName}}. Notei que faz aproximadamente {{forecastIntervalDays}} dias desde a ' +
        'última compra ({{lastOrderAt}}). Gostaria de já agendar a reposição ou tirar alguma dúvida?',
      aiInstructions: 'Tom profissional, cordial e direto. Sem emojis em excesso.',
    },
    {
      name: 'Retry 1h — sem resposta',
      trigger: TemplateTrigger.RETRY_1H,
      body:
        'Oi {{contactName}}, tudo bem? Só passando para confirmar se viu minha mensagem anterior ' +
        'sobre a reposição de {{companyName}}. Posso te ajudar com algo?',
      aiInstructions: 'Tom leve, sem pressão. Como se fosse um amigo lembrando.',
    },
    {
      name: 'Retry 3h — segunda tentativa',
      trigger: TemplateTrigger.RETRY_3H,
      body:
        '{{contactName}}, posso te ajudar a fechar o pedido de reposição agora? Se preferir, ' +
        'me chama por aqui que monto a proposta rapidinho.',
      aiInstructions: 'Tom prestativo. Foco em facilitar a vida do cliente.',
    },
    {
      name: 'Retry 24h — última tentativa IA',
      trigger: TemplateTrigger.RETRY_24H,
      body:
        'Oi {{contactName}}, vou te ligar nas próximas horas para falar sobre a reposição da ' +
        '{{companyName}}. Caso prefira responder por aqui, fico no aguardo.',
      aiInstructions: 'Tom de encerramento — avisar que o vendedor vai entrar em contato.',
    },
    {
      name: 'Cliente atrasado',
      trigger: TemplateTrigger.REPLENISHMENT_OVERDUE,
      body:
        'Olá {{contactName}}, sentimos sua falta na {{companyName}}! Já se passaram ' +
        '{{daysOverdue}} dias além do prazo estimado de reposição. Como podemos te ajudar?',
      aiInstructions: 'Tom amigável, sem culpabilizar.',
    },
  ];

  let createdTemplates = 0;
  for (const t of seedTemplates) {
    const exists = await prisma.messageTemplate.findFirst({
      where: { name: t.name, deletedAt: null },
    });
    if (exists) continue;
    await prisma.messageTemplate.create({
      data: {
        name: t.name,
        trigger: t.trigger,
        body: t.body,
        aiInstructions: t.aiInstructions,
        channel: 'whatsapp',
        isActive: true,
        createdById: manager.id,
      },
    });
    createdTemplates++;
  }
  console.log(`[seed] Templates criados: ${createdTemplates}`);

  // ---------------- Configuração de automação ----------------
  const replenishmentTemplate = await prisma.messageTemplate.findFirst({
    where: { trigger: TemplateTrigger.REPLENISHMENT_REMINDER, deletedAt: null },
  });
  const retry1h = await prisma.messageTemplate.findFirst({
    where: { trigger: TemplateTrigger.RETRY_1H, deletedAt: null },
  });
  const retry3h = await prisma.messageTemplate.findFirst({
    where: { trigger: TemplateTrigger.RETRY_3H, deletedAt: null },
  });
  const retry24h = await prisma.messageTemplate.findFirst({
    where: { trigger: TemplateTrigger.RETRY_24H, deletedAt: null },
  });
  const overdueTpl = await prisma.messageTemplate.findFirst({
    where: { trigger: TemplateTrigger.REPLENISHMENT_OVERDUE, deletedAt: null },
  });

  const config = {
    enabled: true,
    remindBeforeDays: 0,
    retryDelaysHours: [1, 3, 24],
    overdueTaskAfterDays: 1,
    escalateToManagementAfterDays: 3,
    defaultReminderTemplateId: replenishmentTemplate?.id,
    overdueTemplateId: overdueTpl?.id,
    retryTemplateIds: {
      retry1h: retry1h?.id,
      retry3h: retry3h?.id,
      retry24h: retry24h?.id,
    },
  };

  await prisma.automationRule.upsert({
    where: { key: 'REPLENISHMENT_FLOW' },
    create: {
      key: 'REPLENISHMENT_FLOW',
      description: 'Cadência automática de reposição',
      config: JSON.stringify(config),
      isActive: true,
    },
    update: { config: JSON.stringify(config), isActive: true },
  });
  console.log('[seed] Configuração de automação aplicada');

  console.log('───────────────────────────────────────────────');
  console.log(`  Login: ${email}`);
  console.log(`  Senha: ${password}`);
  console.log('  Troque a senha no primeiro login.');
  console.log('───────────────────────────────────────────────');
}

main()
  .catch((e) => { console.error('[seed] Erro:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
