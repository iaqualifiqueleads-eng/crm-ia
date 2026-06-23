# WAHA — WhatsApp HTTP API

Container local do WAHA rodando na máquina do desenvolvedor.
O WAHA precisa rodar localmente pois o IP da VPS é bloqueado pelo WhatsApp.

---

## Pré-requisitos

- Docker Desktop instalado e rodando
- ngrok instalado e autenticado
- PowerShell

---

## Subindo o ambiente

### 1. Iniciar o ngrok

O ngrok expõe o WAHA localmente para que o backend na VPS consiga enviar mensagens.

```powershell
ngrok http 3000 --domain=devotion-sports-civil.ngrok-free.dev
```

> Mantenha o ngrok rodando enquanto o sistema estiver em uso.

### 2. Subir o container e configurar o webhook

```powershell
docker compose -f "C:\Users\celis\Documents\GitHub\crm-ia\waha\docker-compose.yml" up -d; .\waha\init-webhook.ps1
```

> O webhook precisa ser reconfigurado toda vez que o container reiniciar.

---

## Parar o container

```powershell
docker compose -f "C:\Users\celis\Documents\GitHub\crm-ia\waha\docker-compose.yml" down
```

---

## Acessar o dashboard

Com o container rodando, acesse:

- **Dashboard:** http://localhost:3000/dashboard
  - Usuário: `admin`
  - Senha: `admin123`
- **Swagger:** http://localhost:3000/docs

---

## Variáveis de ambiente (VPS — Coolify)

| Variável | Valor |
|---|---|
| `WAHA_URL` | `https://devotion-sports-civil.ngrok-free.dev` |
| `WAHA_API_KEY` | `minha-chave-super-segura` |
| `WAHA_WEBHOOK_SECRET` | `secret_para_validar_entrada_de_mensagens` |
| `MAKE_WEBHOOK_URL` | `https://ra-bcknd.com/v1/api-trigger/vdpgr7sb66lp3sbh6wd6` |

> Se a URL do ngrok mudar, atualize `WAHA_URL` no Coolify e faça redeploy do backend.

---

## Fluxo de mensagens

```
Cliente (WhatsApp) → WAHA (local) → ngrok → Backend (VPS) → IA → WAHA → Cliente
```

### Webhook de mensagens recebidas
- **URL:** `https://clskwf33f0imzlqdgav7wt0t.2.25.194.252.sslip.io/api/whatsapp/webhook`
- **Eventos:** `message`, `message.any`
- **Header:** `x-webhook-secret: secret_para_validar_entrada_de_mensagens`

### Webhook de status da sessão
- **URL:** `https://clskwf33f0imzlqdgav7wt0t.2.25.194.252.sslip.io/api/whatsapp/session-status`
- **Eventos:** `session.status`
- Quando a sessão desconectar, o backend notifica via Make para `+5527992788660`

---

## Reconectar o WhatsApp

Se a sessão desconectar:

1. Acesse http://localhost:3000/dashboard
2. Clique na sessão `default` e escaneie o QR code
3. Reconfigure o webhook:
   ```powershell
   .\waha\init-webhook.ps1
   ```
