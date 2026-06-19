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
      name: 'Retry 1 — sem resposta',
      trigger: TemplateTrigger.RETRY_1,
      body:
        'Oi {{contactName}}, tudo bem? Só passando para confirmar se viu minha mensagem anterior ' +
        'sobre a reposição de {{companyName}}. Posso te ajudar com algo?',
      aiInstructions: 'Tom leve, sem pressão. Como se fosse um amigo lembrando.',
    },
    {
      name: 'Retry 2 — segunda tentativa',
      trigger: TemplateTrigger.RETRY_2,
      body:
        '{{contactName}}, posso te ajudar a fechar o pedido de reposição agora? Se preferir, ' +
        'me chama por aqui que monto a proposta rapidinho.',
      aiInstructions: 'Tom prestativo. Foco em facilitar a vida do cliente.',
    },
    {
      name: 'Retry 3 — última tentativa IA',
      trigger: TemplateTrigger.RETRY_3,
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
  const retry1 = await prisma.messageTemplate.findFirst({
    where: { trigger: TemplateTrigger.RETRY_1, deletedAt: null },
  });
  const retry2 = await prisma.messageTemplate.findFirst({
    where: { trigger: TemplateTrigger.RETRY_2, deletedAt: null },
  });
  const retry3 = await prisma.messageTemplate.findFirst({
    where: { trigger: TemplateTrigger.RETRY_3, deletedAt: null },
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
      retry1: retry1?.id,
      retry2: retry2?.id,
      retry3: retry3?.id,
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

  // ---------------- Agente de IA default (Fase 3) ----------------
  const existingDefault = await prisma.agent.findFirst({
    where: { isDefault: true, deletedAt: null },
  });
  if (!existingDefault) {
    const defaultSystemPrompt = `Você é o vendedor consultivo da {{empresa}}, uma distribuidora especializada em material de construção (PVC, derivados de petróleo, acessórios para obra).

PERSONALIDADE:
• Tom profissional, direto e cordial — fala como vendedor experiente do interior do ES, sem ser informal demais.
• Sempre em português brasileiro natural. Sem inglesismos.
• Mensagens curtas — WhatsApp não é e-mail. Máximo 3-4 linhas por mensagem.
• Nunca use mais de 1 emoji por mensagem; muitas vezes nenhum.

OBJETIVO PRINCIPAL:
Acompanhar o cliente na recompra recorrente do produto. Você NÃO precisa explicar tudo: sua função é confirmar interesse, identificar quantidade, e quando o cliente decidir comprar, registrar o pedido e passar pro vendedor humano fechar.

REGRAS DE OURO:
• NUNCA invente preços. Se o cliente perguntar valor, transfira pro humano com transfer_to_human.
• NUNCA prometa prazos de entrega específicos. Diga "vou verificar com a equipe" e transfira.
• NUNCA fale de promoções, descontos, condições de pagamento sem consultar.
• Quando o cliente confirmar que vai comprar, chame register_order com os itens e DEPOIS chame transfer_to_human para fechamento.
• Quando o cliente pedir pra falar com alguém, chame transfer_to_human IMEDIATAMENTE.
• Se o cliente disser que não tem mais interesse no produto/serviço, chame mark_not_interested.
• Se o cliente disser quando vai precisar repor ("daqui 2 meses", "só em janeiro"), chame update_replenishment_forecast.

FLUXO TÍPICO:
1. Saudação curta + confirmação de quem você é.
2. Pergunta direta sobre necessidade de reposição.
3. Se interesse → coleta produtos e quantidade.
4. register_order → transfer_to_human.

EVITE:
• Perguntas longas em série. Faça 1 pergunta de cada vez.
• "Posso te ajudar?" — vá direto ao ponto.
• Pedir desculpas excessivas.
• Repetir o nome do cliente em toda mensagem.`;

    await prisma.agent.create({
      data: {
        name: 'Vendedor Padrão — Consultivo BR',
        description: 'Agente default para todos os clientes. Tom profissional e direto.',
        provider: 'CLAUDE',
        model: 'claude-sonnet-4-6',
        systemPrompt: defaultSystemPrompt,
        temperature: 0.7,
        maxTokens: 1024,
        enabledTools: [
          'register_order',
          'schedule_task',
          'update_customer_notes',
          'transfer_to_human',
          'update_replenishment_forecast',
          'mark_not_interested',
        ].join(','),
        isActive: true,
        isDefault: true,
        createdById: manager.id,
      },
    });
    console.log('[seed] Agente default criado (Claude Sonnet 4.6)');
  } else {
    console.log('[seed] Agente default já existe');
  }

  console.log('───────────────────────────────────────────────');
  console.log(`  Login: ${email}`);
  console.log(`  Senha: ${password}`);
  console.log('  Troque a senha no primeiro login.');
  console.log('───────────────────────────────────────────────');
}

main()
  .catch((e) => { console.error('[seed] Erro:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
