param(
    [int]$TimeoutSeconds = 60
)

$wahaUrl    = "http://localhost:3000"
$apiKey     = "minha-chave-super-segura"
$backendUrl = "https://clskwf33f0imzlqdgav7wt0t.2.25.194.252.sslip.io"
$secret     = "secret_para_validar_entrada_de_mensagens"

# Aguarda o WAHA responder ao /ping
Write-Host "Aguardando WAHA ficar pronto..."
$elapsed = 0
$ready = $false
while ($elapsed -lt $TimeoutSeconds) {
    try {
        $ping = Invoke-RestMethod -Uri "$wahaUrl/ping" -Method GET -ErrorAction Stop
        $ready = $true
        Write-Host "WAHA pronto!" -ForegroundColor Green
        break
    } catch {
        Start-Sleep -Seconds 2
        $elapsed += 2
    }
}

if (-not $ready) {
    Write-Host "Timeout: WAHA nao respondeu em $TimeoutSeconds segundos." -ForegroundColor Red
    exit 1
}

# Configura webhook via PUT /api/sessions/default
$body = @{
    config = @{
        webhooks = @(
            @{
                url    = "$backendUrl/api/whatsapp/webhook"
                events = @("message", "message.any")
                customHeaders = @(
                    @{ name = "x-webhook-secret"; value = $secret }
                )
            },
            @{
                url    = "$backendUrl/api/whatsapp/session-status"
                events = @("session.status")
            }
        )
    }
} | ConvertTo-Json -Depth 10

try {
    Invoke-RestMethod `
        -Uri "$wahaUrl/api/sessions/default" `
        -Method PUT `
        -Headers @{ "X-Api-Key" = $apiKey; "Content-Type" = "application/json" } `
        -Body $body

    Write-Host "Webhook configurado com sucesso." -ForegroundColor Green
} catch {
    Write-Host "Erro ao configurar webhook: $_" -ForegroundColor Red
}
