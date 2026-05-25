# CRM B2B — Material de Construção

CRM especializado em **gestão de carteira B2B com previsão automática de recompra**.
Foco no acompanhamento de clientes recorrentes (material de construção) e disparo
de follow-ups no momento certo, com IA conversacional no WhatsApp.

> **Status:** Backend completo (Fases 1.1 + 1.2) · Frontend completo (Fases 2.1 + 2.2).

---

## 📦 Stack

**Backend**
- NestJS 10 + TypeScript
- Prisma + MySQL 8
- Redis + BullMQ (jobs de cadência e retry)
- JWT (access 15min + refresh 7d com rotação)
- Swagger em `/api/docs`

**Frontend**
- React 18 + TypeScript + Vite
- TailwindCSS (paleta acromática + dourado discreto)
- React Query + Zustand
- React Router 6 + Axios (com refresh transparente)
- Framer Motion + Recharts
- Fontes editoriais: Cormorant Garamond + Geist + JetBrains Mono

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

## ▶️ Como rodar (desenvolvimento)

### 1. Pré-requisitos
- Node.js 20+
- Docker + Docker Compose

### 2. Subir infra (MySQL + Redis + phpMyAdmin)
```bash
docker compose up -d
```
Serviços:
- MySQL → `localhost:3306`
- Redis → `localhost:6379`
- phpMyAdmin → http://localhost:8080

### 3. Backend
```bash
cd backend
cp .env.example .env

npm install
npx prisma generate
npx prisma migrate dev --name init
npm run seed      # cria gerente + 5 templates + config inicial

npm run start:dev
```
API: http://localhost:3000/api
Swagger: http://localhost:3000/api/docs

### 4. Frontend
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

## 🎨 Estética — "Editorial Luxury Operational"

Mistura **densidade Salesforce** + **calma Notion** + **paleta Mercedes/Apple**:

| Cor       | Hex      | Uso |
|-----------|----------|-----|
| Onyx      | #0A0A0B  | Texto principal, sidebar, botões primários |
| Pearl     | #FAFAF7  | Background quente |
| Platinum  | #E8E6E1  | Bordas e divisores |
| Champagne | #C9A961  | Acento de luxo (1 por vista) |
| Signal    | #C8553D  | Apenas alertas e atrasos |
| Forest    | #3D5A4A  | Sucesso e métricas positivas |

- **Tipografia**: Cormorant Garamond (serif editorial nos títulos) + Geist (UI) + JetBrains Mono (números)
- **Bordas**: 2px (sharp) em vez de cantos arredondados
- **Animações**: fade-up com easing `[0.16, 1, 0.3, 1]`
- **Assinatura visual**: linha vertical dourada à esquerda do item ativo da sidebar; divisor com losango dourado

---

## 🧠 O coração do sistema: previsão de recompra

```
forecastMode = AUTO     →  pega a média dos intervalos entre pedidos passados
forecastMode = MANUAL   →  usa manualIntervalDays (sobrescreve a média)
```

A cada novo pedido:
1. Backend grava o pedido.
2. Dispara `ForecastService.recalculateForCustomer()`.
3. Calcula `nextReplenishmentAt` e `daysOverdue` (cache no Customer).

### Cadência automática (workers BullMQ)

| Worker | Quando roda | O que faz |
|--------|-------------|-----------|
| Replenishment | Diário 09:00 | Varre clientes com previsão hoje, dispara IA |
| Message Retry | 1h / 3h / 24h após envio | Checa resposta; se não, reenvia |
| Overdue Escalation | Diário 09:15 | Cria task urgente após 1 dia, escala após 3 |

Tudo configurável em `/automation` (somente gerente).

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
| `/customers/:id`       | Dossiê do cliente: timeline, métricas, previsão |
| `/orders`              | Pedidos com criação dinâmica de itens |
| `/tasks`               | Agenda com abas hoje/vencidas/próximas |
| `/templates`           | CRUD de templates com preview em tempo real |
| `/team`                | Hierarquia em 3 colunas (Gerente/Supervisor/Vendedor) |
| `/automation`          | Configuração da cadência com diagrama visual |
| `/notifications`       | Inbox interna com filtro de não lidas |
| `/account`             | Troca de senha + logout |

---

## 🛡 Segurança

- Senhas com bcryptjs (rounds = 12)
- JWT com segredos diferentes para access (15min) e refresh (7d)
- Refresh token rotacionado a cada uso, hash SHA-256
- `JwtStrategy` revalida o usuário a cada request
- Validação rigorosa: `whitelist` + `forbidNonWhitelisted`
- CORS restrito ao `FRONTEND_URL`
- Rate limit: 120 reqs/min por IP
- Swagger desabilitado em produção
- Frontend com refresh transparente via Axios interceptor

---

## 🚧 Próximas fases

- **Fase 3:** Trocar conector mock por WhatsApp não-oficial real (Baileys/Evolution) + Claude/ChatGPT
- **Fase 4:** Servidor MCP para exposição via agentes

---

## 📝 Licença

Privado — Klaus Toneto / TONETO TREINAMENTO E VENDAS EM TECNOLOGIA LTDA.
