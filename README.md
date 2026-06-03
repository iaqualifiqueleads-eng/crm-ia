# CRM B2B — Material de Construção

CRM especializado em **gestão de carteira B2B com previsão automática de recompra**.
Foco no acompanhamento de clientes recorrentes (material de construção) e disparo
de follow-ups no momento certo, com IA conversacional no WhatsApp.

> **Status:** Backend completo (Fases 1.1 + 1.2) · Frontend completo (Fases 2.1 + 2.2).

---

## 📦 Stack

**Backend**
- NestJS 10 + TypeScript · Prisma + MySQL 8 · Redis + BullMQ
- JWT (access 15min + refresh 7d com rotação)
- Swagger em `/api/docs`

**Frontend**
- React 18 + TypeScript + Vite · TailwindCSS
- React Query + Zustand · React Router 6 + Axios
- Framer Motion + Recharts
- Fontes editoriais: Cormorant Garamond + Geist + JetBrains Mono

---

## ▶️ Como rodar (passo a passo)

### Pré-requisitos
- Node.js 20+
- Docker Desktop (ou Docker Engine + Compose)

### 1. Configurar os DOIS arquivos `.env`

Esta é a etapa onde a maioria dos erros aparece. Existem **dois `.env`**, em locais diferentes, que precisam estar **alinhados**:

```bash
# A) .env DA RAIZ — usado pelo Docker Compose para configurar o MySQL
cp .env.example .env

# B) .env DO BACKEND — usado pelo NestJS/Prisma para conectar no MySQL
cp backend/.env.example backend/.env
```

As senhas em `MYSQL_USER` / `MYSQL_PASSWORD` (raiz) devem aparecer iguais na `DATABASE_URL` (backend). Os arquivos `.env.example` já vêm com valores compatíveis — **se você só copiar e não alterar nada, vai funcionar**.

### 2. Subir a infra (MySQL + Redis + phpMyAdmin)

```bash
docker compose up -d
```

Aguarde uns 20-30 segundos na primeira vez (MySQL precisa inicializar o volume). Confira:

```bash
docker compose ps
# mysql deve aparecer como "healthy"
```

### 3. Backend

```bash
cd backend
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed
npm run start:dev
```

API: http://localhost:3000/api  ·  Swagger: http://localhost:3000/api/docs

### 4. Frontend (outro terminal)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

App: http://localhost:5173

### 5. Login inicial

```
email:    admin@crm.local
senha:    ChangeMe@123
```
Troque imediatamente em "Minha conta".

---

## 🤖 Fase 3 — Agentes de IA + WhatsApp não-oficial

A partir da Fase 3, o CRM tem **agentes conversacionais reais** que conversam com clientes via WhatsApp através da Evolution API. Esta seção explica como configurar.

### Componentes

```
┌──────────────────┐                ┌──────────────────────┐
│  Cliente         │                │  Backend NestJS      │
│  (WhatsApp)      │                │  + AgentRuntime      │
└────────┬─────────┘                └──────────┬───────────┘
         │                                     │
         │  msg                       webhook  │
         ▼                                     ▼
┌──────────────────┐    REST/send    ┌──────────────────────┐
│  Evolution API   │ ◄──────────────┤  Worker BullMQ        │
│  (Docker)        │                 │  AgentResponseWorker  │
└──────────────────┘                 └──────────┬───────────┘
                                                │
                                                ▼
                                     ┌──────────────────────┐
                                     │ Claude / OpenAI / Gemini │
                                     └──────────────────────┘
```

### A) Configurar chaves de IA

Edite `backend/.env` e adicione os providers que você vai usar:

```bash
ANTHROPIC_API_KEY=sk-ant-...    # https://console.anthropic.com/
OPENAI_API_KEY=sk-...           # https://platform.openai.com/api-keys
GEMINI_API_KEY=AIza...          # https://aistudio.google.com/apikey

USD_BRL_RATE=5.20  # cotação fixa pra mostrar custos em reais
```

**Você só precisa configurar as chaves dos providers que vai realmente usar** — cada agente escolhe o seu. Se você só usa Claude, deixe as outras vazias.

### B) Configurar Evolution API (WhatsApp)

O `docker-compose.yml` já inclui um container da Evolution. Ele sobe automaticamente em `docker compose up -d`. Os volumes/banco são separados do MySQL principal — não interferem.

Edite o `.env` da **raiz**:

```bash
EVOLUTION_API_KEY=mude-essa-chave-pra-algo-aleatorio
EVOLUTION_DB_PASSWORD=mude-essa-senha-tambem
```

E o `.env` do **backend**:

```bash
EVOLUTION_URL=http://localhost:8085
EVOLUTION_API_KEY=mude-essa-chave-pra-algo-aleatorio   # mesmo valor da raiz
EVOLUTION_INSTANCE=crm-principal                       # nome de sua escolha
EVOLUTION_WEBHOOK_SECRET=mude-esse-tambem               # segredo do webhook
```

### C) Conectar um chip ao WhatsApp

1. Abra http://localhost:8085/manager
2. Cole a `EVOLUTION_API_KEY` quando perguntar
3. Crie uma nova instância com o nome igual ao `EVOLUTION_INSTANCE` que você definiu
4. Escaneie o QR code com o WhatsApp do **chip dedicado** (NUNCA seu número pessoal — o WhatsApp pode banir números que usam API não oficial)
5. Configure o webhook na instância:
   - **URL**: `http://host.docker.internal:3000/api/whatsapp/webhook` (Windows/macOS) ou `http://172.17.0.1:3000/api/whatsapp/webhook` (Linux)
   - **Eventos**: marque `MESSAGES_UPSERT`
   - **Headers**: adicione `x-webhook-secret` com o valor de `EVOLUTION_WEBHOOK_SECRET`

### D) Como testar sem usar chip de WhatsApp

A tela **`/agents/:id/playground`** permite conversar com qualquer agente como se você fosse o cliente — sem enviar nada pelo WhatsApp e sem persistir nada no histórico. Use isso pra:

- Ajustar o `systemPrompt`
- Validar quais tools o agente está chamando
- Ver custo por mensagem

### E) Aviso importante de risco

WhatsApp pode **banir** o número usado em qualquer momento — é política deles, mesmo com Evolution/Baileys mascarando como cliente legítimo. Por isso:

1. **Use chip dedicado**, nunca número pessoal.
2. **Não envie spam.** O CRM dispara mensagens apenas dentro da cadência configurada.
3. **O histórico fica no nosso banco**, não no WhatsApp — se o chip for banido, basta conectar outro e a continuidade está garantida.

---

## 🚨 Troubleshooting

### Erro: `P3014` + `P1010` (shadow database) — `prisma migrate dev`

```
Error: P3014
Prisma Migrate could not create the shadow database.
Original error: P1010 - User `crm_user` was denied access on the database `crm_db`
```

**Causa:** `prisma migrate dev` cria um banco temporário (shadow database) para validar a migration antes de aplicar. O `crm_user` não tem permissão `CREATE DATABASE` — isso é proposital por segurança.

**Solução:** o `.env.example` do backend já vem com a `SHADOW_DATABASE_URL` apontando para o `root` do MySQL. Garanta que copiou o `.env.example` mais recente:

```bash
cd backend
cp .env.example .env
# verifique que existem AMBAS as linhas no .env:
#   DATABASE_URL="mysql://crm_user:crm_pass@127.0.0.1:3306/crm_db"
#   SHADOW_DATABASE_URL="mysql://root:rootpass@127.0.0.1:3306/crm_shadow_db"
```

A senha do root (`rootpass`) precisa bater com `MYSQL_ROOT_PASSWORD` do `.env` da raiz.

> **Em produção:** NÃO use `prisma migrate dev`. Use `npx prisma migrate deploy` — esse comando não precisa de shadow database, então pode deixar a `SHADOW_DATABASE_URL` em branco / comentada.

### Erro: `Access denied for user 'crm_user'@'...' (using password: YES)`

**Causa mais comum:** o volume do MySQL foi criado em uma execução anterior com senha diferente, e ele está se lembrando da senha antiga (o MySQL só lê as variáveis `MYSQL_USER`/`MYSQL_PASSWORD` na **primeira** inicialização do volume).

**Solução:** derrubar o volume e subir limpo.

```bash
# Na raiz do projeto:
docker compose down -v       # ATENÇÃO: -v apaga o volume (perde dados)
docker compose up -d
# aguarde ~20s
cd backend
npx prisma migrate dev --name init
npm run seed
```

Ou use o atalho:
```bash
cd backend
npm run db:reset
# aguarde a mensagem e rode:
npx prisma migrate dev --name init
npm run seed
```

### Erro: `Can't reach database server at '127.0.0.1:3306'`

Verifique se o MySQL subiu:
```bash
docker compose ps
docker compose logs mysql
```

Se aparecer `crm_mysql ... healthy`, o banco está OK e o problema é outro (firewall? VPN? porta 3306 ocupada por outro MySQL local?).

Para descobrir se outro processo está na porta:
```bash
# Windows
netstat -ano | findstr :3306
# macOS/Linux
lsof -i :3306
```

### Verificar se as configurações estão alinhadas

```bash
cd backend
npm run db:check
# Mostra: host: 127.0.0.1  port: 3306  db: crm_db  user: crm_user
```

Confira se o `user` mostrado bate com o `MYSQL_USER` do `.env` da raiz.

### Erro: `Authentication plugin 'caching_sha2_password' cannot be loaded`

Acontece com clientes MySQL antigos. Não afeta o Prisma normalmente, mas se aparecer:
- Confirme que está usando a imagem `mysql:8.0.36` (já configurada no docker-compose)
- Não precisa mais da flag `--default-authentication-plugin=mysql_native_password` (foi removida)

---

## 🏗 Arquitetura — papéis e visibilidade

```
MANAGER  (1)
  ├── SUPERVISOR (N)
  │      └── SALESPERSON (N)   ← cada um com sua carteira
  └── SUPERVISOR (N)
         └── SALESPERSON (N)
```

| Ação                          | MANAGER | SUPERVISOR (sobre subordinados) | SALESPERSON (próprios) |
|-------------------------------|:-------:|:-------------------------------:|:----------------------:|
| Criar supervisor              |    ✅    |               ❌                |          ❌            |
| Criar vendedor                |    ✅    |               ✅                |          ❌            |
| Ver clientes                  |  Todos  |        Da sua equipe            |    Só seus             |
| Criar/editar cliente          |    ✅    |               ✅                |          ✅            |
| Transferir cliente            |    ✅    |        Entre seus               |          ❌            |
| Registrar pedido              |    ✅    |               ✅                |          ✅            |
| Ajustar previsão manual       |    ✅    |               ✅                |          ✅            |
| Criar templates de mensagem   |    ✅    |               ✅                |          ❌            |
| Configurar cadência           |    ✅    |               ❌                |          ❌            |

---

## 🎨 Estética — "Editorial Luxury Operational"

| Cor       | Hex      | Uso |
|-----------|----------|-----|
| Onyx      | #0A0A0B  | Texto principal, sidebar, botões primários |
| Pearl     | #FAFAF7  | Background quente |
| Platinum  | #E8E6E1  | Bordas e divisores |
| Champagne | #C9A961  | Acento de luxo (1 por vista) |
| Signal    | #C8553D  | Apenas alertas e atrasos |
| Forest    | #3D5A4A  | Sucesso e métricas positivas |

---

## 🧠 Previsão de recompra

```
forecastMode = AUTO     →  média dos intervalos entre pedidos passados
forecastMode = MANUAL   →  manualIntervalDays (sobrescreve a média)
```

A cada novo pedido, o backend recalcula `nextReplenishmentAt` e `daysOverdue`.

### Cadência automática (workers BullMQ)

| Worker | Quando roda | O que faz |
|--------|-------------|-----------|
| Replenishment | Diário 09:00 | Varre clientes com previsão hoje, dispara IA |
| Message Retry | 1h / 3h / 24h após envio | Checa resposta; se não, reenvia |
| Overdue Escalation | Diário 09:15 | Cria task urgente após 1 dia, escala após 3 |

Configurável em `/automation` (somente gerente).

---

## 💬 Histórico de conversas

**Princípio:** o histórico fica no CRM (tabela `interactions`), **nunca no WhatsApp**.
Se o chip for bloqueado e trocado, o novo chip continua de onde parou.

---

## 🗺️ Páginas do frontend

| Rota                   | Função |
|------------------------|--------|
| `/login`               | Login editorial com painel onyx + manifesto |
| `/`                    | Dashboard com drill-down clicável |
| `/customers`           | Lista da carteira com filtros |
| `/customers/:id`       | Dossiê: timeline, métricas, previsão |
| `/orders`              | Pedidos com criação dinâmica de itens |
| `/tasks`               | Agenda com abas hoje/vencidas/próximas |
| `/templates`           | CRUD de templates com preview em tempo real |
| `/team`                | Hierarquia em 3 colunas |
| `/automation`          | Configuração da cadência + diagrama do fluxo |
| `/notifications`       | Inbox interna |
| `/account`             | Troca de senha + logout |

---

## 🛡 Segurança

- Senhas com bcryptjs (rounds = 12)
- JWT com segredos diferentes (access + refresh) · rotação a cada uso · hash SHA-256
- `JwtStrategy` revalida o usuário a cada request
- Validação rigorosa: `whitelist` + `forbidNonWhitelisted`
- CORS restrito ao `FRONTEND_URL`
- Rate limit: 120 reqs/min por IP
- Swagger desabilitado em produção

---

## 🚧 Próximas fases

- **Fase 3:** trocar mock por WhatsApp não-oficial real (Baileys/Evolution) + Claude/ChatGPT
- **Fase 4:** servidor MCP

---

## 📝 Licença

Privado — Klaus Toneto / TONETO TREINAMENTO E VENDAS EM TECNOLOGIA LTDA.
