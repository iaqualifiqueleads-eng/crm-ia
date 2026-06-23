param(
    [int]$WaitSeconds = 5
)

$wahaUrl    = "http://localhost:3000"
$apiKey     = "minha-chave-super-segura"
$backendUrl = "https://clskwf33f0imzlqdgav7wt0t.2.25.194.252.sslip.io"
$secret     = "secret_para_validar_entrada_de_mensagens"

Write-Host "Aguardando WAHA iniciar ($WaitSeconds s)..."
Start-Sleep -Seconds $WaitSeconds

$body = @{
    url    = "$backendUrl/api/whatsapp/webhook"
    events = @("message", "message.any")
    customHeaders = @(
        @{ name = "x-webhook-secret"; value = $secret }
    )
} | ConvertTo-Json -Depth 5

try {
    Invoke-RestMethod `
        -Uri "$wahaUrl/api/sessions/default/webhooks" `
        -Method POST `
        -Headers @{ "X-Api-Key" = $apiKey; "Content-Type" = "application/json" } `
        -Body $body

    Write-Host "Webhook configurado com sucesso." -ForegroundColor Green
} catch {
    Write-Host "Erro ao configurar webhook: $_" -ForegroundColor Red
}
