# Deploys the Fihrist satellite function to Azure (Flex Consumption, West Europe).
# Prerequisite: Azure CLI installed and `az login` done by the account owner. No secrets are stored in this repo.
# Usage: powershell -ExecutionPolicy Bypass -File azure/deploy.ps1 -Suffix <short-unique-lowercase>
param([Parameter(Mandatory = $true)][ValidatePattern('^[a-z0-9]{3,8}$')][string]$Suffix)
$ErrorActionPreference = 'Stop'
$rg = 'fihrist-rg'
$loc = 'westeurope'
$sa = "fihristsat$Suffix"
$app = "fihrist-sat-$Suffix"
$here = Split-Path -Parent $MyInvocation.MyCommand.Path

az group create -n $rg -l $loc -o none
az storage account create -n $sa -g $rg -l $loc --sku Standard_LRS --kind StorageV2 --allow-blob-public-access false --min-tls-version TLS1_2 --https-only true -o none
az functionapp create -g $rg -n $app --storage-account $sa --flexconsumption-location $loc --runtime node --runtime-version 22 --instance-memory 2048 -o none
# cost cap: at most 2 instances at once
az functionapp scale config set -g $rg -n $app --maximum-instance-count 2 -o none
az functionapp cors add -g $rg -n $app --allowed-origins https://app.fihrist.earth https://fihrist.pages.dev http://localhost:4174 -o none
az functionapp update -g $rg -n $app --set httpsOnly=true -o none

Push-Location "$here/sat-function"
try {
  npm ci --omit=dev --no-audit --no-fund
  Remove-Item -Force -ErrorAction SilentlyContinue sat.zip
  # tar writes forward-slash paths (Compress-Archive in PowerShell 5.1 writes backslashes, which Linux rejects)
  tar -a -c -f sat.zip host.json package.json src node_modules
  az functionapp deployment source config-zip -g $rg -n $app --src sat.zip -o none
} finally { Pop-Location }

$hostName = az functionapp show -g $rg -n $app --query defaultHostName -o tsv
"ENDPOINT https://$hostName/api/sat"
