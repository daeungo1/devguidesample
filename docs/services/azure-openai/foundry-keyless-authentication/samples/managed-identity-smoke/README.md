---
title: Microsoft Foundry 관리 ID 스모크 테스트
description: 키 차단 전후의 관리 ID 모델 호출과 기존 키의 거부 여부를 확인합니다.
---

## 준비

Azure CLI(Bicep 포함)와 PowerShell 7.4 이상을 사용합니다. 리소스 생성 및 역할 할당 권한이 있는 **실습 전용 구독**에서 실행하세요. 기존 리소스 그룹이나 운영 계정을 재사용하지 않습니다.
이 샘플에는 Foundry 공개 엔드포인트에 접근할 수 있는 환경과 Microsoft Container Registry, PyPI로 나가는 연결이 필요합니다. 네트워크 정책이 이를 금지하는 환경의 접근 설정을 완화하지 마세요.

아래 컨테이너 인스턴스 절차 대신 AKS에서 실행하려면, [AKS Job으로 실행](#aks-job으로-실행)을 참고하세요.

### 1. 실습 리소스 만들기

아래 예제의 지역·모델 버전은 실행 전에 [모델 배포 화면](https://learn.microsoft.com/azure/foundry/foundry-models/how-to/deploy-foundry-models)에서 구독의 지원 여부와 `GlobalStandard` 할당량을 확인해 선택합니다. 샘플 디렉터리에서 실행합니다.

```powershell
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$subscription = '<lab-subscription-id>'
$location = '<supported-azure-region>'
$model = 'gpt-5-mini'
$modelVersion = '2025-08-07'
$deployment = 'keyless-smoke-model'
$identity = 'keyless-smoke-identity'
$suffix = [guid]::NewGuid().ToString('N').Substring(0, 10)
$rg = "rg-foundry-keyless-$suffix"
$account = "foundry-keyless-$suffix"

az login --output none
az group create --subscription $subscription --name $rg --location $location --output none
az cognitiveservices account create --subscription $subscription -g $rg -n $account `
  --location $location --kind AIServices --sku S0 --custom-domain $account --yes --output none
az cognitiveservices account deployment create --subscription $subscription -g $rg -n $account `
  --deployment-name $deployment --model-format OpenAI --model-name $model `
  --model-version $modelVersion --sku-name GlobalStandard --sku-capacity 1 --output none

$resourceId = az cognitiveservices account show --subscription $subscription -g $rg -n $account --query id -o tsv
$subdomain = az cognitiveservices account show --subscription $subscription -g $rg -n $account `
  --query properties.customSubDomainName -o tsv
$endpoint = "https://${subdomain}.services.ai.azure.com"
$principalId = az identity create --subscription $subscription -g $rg -n $identity --query principalId -o tsv
az role assignment create --subscription $subscription --scope $resourceId `
  --assignee-object-id $principalId --assignee-principal-type ServicePrincipal `
  --role 'Cognitive Services OpenAI User' --output none
```

### 2. 관리 ID 경로 먼저 검증하기

```powershell
function Start-KeylessSmoke([string]$run) {
    az deployment group create --subscription $subscription --resource-group $rg `
      --name $run --template-file .\main.bicep `
      --parameters runName=$run identityName=$identity endpoint=$endpoint modelDeployment=$deployment `
      --output none
}

function Read-KeylessSmoke([string]$run) {
    az container show --subscription $subscription -g $rg -n $run `
      --query 'containers[0].instanceView.currentState.{state:state,exitCode:exitCode}' -o json
    az container logs --subscription $subscription -g $rg -n $run --container-name smoke
}

$beforeRun = 'keyless-before'
Start-KeylessSmoke $beforeRun
Read-KeylessSmoke $beforeRun
```

아직 실행 중이면 `Read-KeylessSmoke $beforeRun`을 다시 호출하세요. `Terminated`, 종료 코드 `0`과 `OK auth=managed_identity http=200 response=completed`가 모두 필요합니다. 방금 만든 역할로 권한 오류가 나면 역할과 ID를 확인하고 전파 시간을 준 뒤 `$beforeRun`을 새 이름으로 바꿔 실행하세요.
`Never`로 설정해도 실패로 종료된 컨테이너는 플랫폼이 재시작할 수 있습니다. 반복 실패하는 그룹은 방치하지 말고 정리하세요.

### 3. 키 인증 차단 후 대조하기

아래 코드는 **실습용 계정의 키 하나**를 차단 전에 읽어서 전후 비교가 끝날 때까지 PowerShell 변수에만 보관합니다. `listKeys` 권한이 필요하며, 실습에서는 차단 후 키 조회도 거부됐습니다. 키를 출력하지 말고 CLI 디버그 로그나 HTTP 헤더를 기록하는 환경에서는 실행하지 마세요. 구독 정책상 처음부터 키 사용이 금지된 경우, 정책을 해제하지 말고 키 허용 상태의 대조는 생략합니다.

```powershell
$beforeExit = az container show --subscription $subscription -g $rg -n $beforeRun `
  --query 'containers[0].instanceView.currentState.exitCode' -o tsv
if ($beforeExit -ne '0') { throw 'The pre-cutover managed identity check has not passed.' }

$requestUri = "$($endpoint.TrimEnd('/'))/openai/v1/responses"
$body = @{
    model = $deployment
    input = 'Say hello in one sentence.'
    max_output_tokens = 300
    store = $false
} | ConvertTo-Json -Compress

function Invoke-KeyRequest([string]$key) {
    Invoke-WebRequest -Uri $requestUri -Method Post -MaximumRedirection 0 `
      -Headers @{ 'api-key' = $key } -ContentType 'application/json' -Body $body `
      -TimeoutSec 30 -SkipHttpErrorCheck
}

$labKey = $null
try {
    $labKey = az cognitiveservices account keys list --subscription $subscription `
      -g $rg -n $account --query key1 -o tsv
    if (-not $labKey) { throw 'No key was returned for the disposable account.' }

    $before = Invoke-KeyRequest $labKey
    if ($before.StatusCode -eq 429) {
        Start-Sleep -Seconds 60
        $before = Invoke-KeyRequest $labKey
    }
    if ($before.StatusCode -ne 200) { throw "Key baseline failed: HTTP $($before.StatusCode)." }

    az resource update --subscription $subscription --ids $resourceId `
      --set properties.disableLocalAuth=true --output none
    $disabled = az resource show --subscription $subscription --ids $resourceId `
      --query properties.disableLocalAuth -o tsv
    if ($disabled -ne 'true') { throw 'ARM did not report disableLocalAuth=true.' }

    Start-KeylessSmoke 'keyless-after'

    $deadline = [DateTime]::UtcNow.AddMinutes(8)
    do {
        $after = Invoke-KeyRequest $labKey
        if ($after.StatusCode -eq 401) { break }
        if ($after.StatusCode -notin 200, 429) { throw "Unexpected key response: HTTP $($after.StatusCode)." }
        Start-Sleep -Seconds 60
    } while ([DateTime]::UtcNow -lt $deadline)

    if ($after.StatusCode -ne 401) { throw 'Key rejection was not confirmed within the test window.' }
    'Key request: HTTP 200 before, HTTP 401 after.'
}
finally {
    Remove-Variable labKey
}
```

별도로 `Read-KeylessSmoke 'keyless-after'`를 실행해 관리 ID 호출 결과를 확인하세요. 기존 키가 거부되지 않아도 관리 ID 호출은 성공할 수 있습니다. 반대로 키 거부만으로 관리 ID가 성공했다고 판단할 수 없습니다.

차단 적용에는 더 오래 걸릴 수 있습니다. 제한 시간 안에 기존 키가 거부되지 않았다면 차단 성공으로 기록하지 않습니다. 더 긴 관측이 필요한 경우에는 실습용 키를 파일에 저장하지 말고, 실행 전에 `$deadline`을 조정해 같은 프로세스 안에서 확인하세요.

### 정리

아래 명령은 실습 리소스 그룹과 그 안의 모든 리소스를 삭제합니다. `$rg`가 위에서 새로 만든 그룹인지 확인한 뒤 실행하세요.

```powershell
az group delete --subscription $subscription --name $rg --yes
az group exists --subscription $subscription --name $rg
```

`false`가 반환되면 리소스 그룹 삭제가 완료된 것입니다.

## AKS Job으로 실행

모델이 배포된 실습용 Foundry 리소스, OIDC issuer와 Workload Identity가 활성화된 실습용 AKS 클러스터, Pod 전용 UAMI를 준비합니다. Foundry 키 인증을 다시 켤 필요는 없습니다. 이미 로그인한 Azure CLI와 실습용 클러스터를 가리키는 `kubectl` 컨텍스트를 사용하세요.

다음 명령은 샘플 디렉터리에서 실행합니다. `FOUNDRY_ENDPOINT`에는 `https://<resource>.services.ai.azure.com` 형식의 Foundry 리소스 URL을 사용합니다. `$identityGroup`에는 UAMI가 있는 그룹을, `$resourceId`에는 모델을 소유한 Foundry 리소스의 ARM ID를 설정합니다.

```powershell
$ErrorActionPreference = 'Stop'
$PSNativeCommandUseErrorActionPreference = $true
$subscription = '<lab-subscription-id>'
$aksGroup = '<aks-resource-group>'
$aksName = '<aks-cluster-name>'
$identityGroup = '<identity-resource-group>'
$identity = '<pod-identity-name>'
$resourceId = '<foundry-resource-id>'
$endpoint = 'https://<resource>.services.ai.azure.com'
$deployment = '<foundry-model-deployment>'
$context = '<lab-kubectl-context>'
$namespace = 'foundry-keyless'
$account = 'foundry-smoke'

$issuer = az aks show --subscription $subscription -g $aksGroup -n $aksName `
  --query oidcIssuerProfile.issuerUrl -o tsv
if (-not $issuer) { throw 'The AKS OIDC issuer is not enabled.' }
$principalId = az identity show --subscription $subscription -g $identityGroup -n $identity `
  --query principalId -o tsv
$clientId = az identity show --subscription $subscription -g $identityGroup -n $identity `
  --query clientId -o tsv

az identity federated-credential create --subscription $subscription -g $identityGroup `
  --identity-name $identity --name foundry-smoke --issuer $issuer `
  --subject "system:serviceaccount:${namespace}:${account}" --audiences 'api://AzureADTokenExchange' `
  --output none
az role assignment create --subscription $subscription --scope $resourceId `
  --assignee-object-id $principalId --assignee-principal-type ServicePrincipal `
  --role 'Cognitive Services OpenAI User' --output none

kubectl --context $context create namespace $namespace
kubectl --context $context -n $namespace create serviceaccount $account
kubectl --context $context -n $namespace annotate serviceaccount $account `
  "azure.workload.identity/client-id=$clientId"
kubectl --context $context -n $namespace create configmap foundry-smoke-code `
  --from-file=smoke.py --from-file=requirements.txt
kubectl --context $context -n $namespace create configmap foundry-smoke-settings `
  "--from-literal=FOUNDRY_ENDPOINT=$endpoint" "--from-literal=FOUNDRY_MODEL_DEPLOYMENT=$deployment"
kubectl --context $context -n $namespace apply -f .\aks-job.yml
kubectl --context $context -n $namespace wait --for=condition=complete `
  job/foundry-keyless-smoke --timeout=7m
kubectl --context $context -n $namespace logs job/foundry-keyless-smoke
```

예상 로그는 `OK auth=workload_identity http=200 response=completed`입니다. 실패하거나 시간이 초과되면 `kubectl --context $context -n $namespace logs job/foundry-keyless-smoke`와 Job의 이벤트를 확인하세요. Azure 역할이나 연합 자격 증명이 방금 만들어졌다면 전파 시간을 준 뒤 실습 Job을 새로 실행합니다.

실습 후에는 생성한 네임스페이스와 UAMI의 실습용 연합 자격 증명 및 Foundry 역할 할당을 정리하세요. 클러스터를 이 실습 전용으로 만들었다면 노드 비용이 계속 발생하지 않도록 중지하거나 삭제하세요.
