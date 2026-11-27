---
title: AKS Workload Identity로 Foundry 키리스 호출
description: AKS Pod의 Kubernetes 서비스 계정 토큰을 Entra 토큰으로 교환해 Microsoft Foundry 모델을 호출합니다.
document_type: guide
topic_order: 1
services: [azure-openai, azure-kubernetes-service, microsoft-foundry, microsoft-entra-id]
technologies: [kubernetes, python, azure-cli, powershell]
tags: [migrate, secure, identity]
status: current
verification_status: verified
sources_checked_at: 2026-11-27
last_verified: 2026-11-27
review_cycle_days: 180
applies_to: [AKS Standard, Microsoft Entra Workload ID, Microsoft Foundry 리소스의 v1 Responses API]
official_sources:
  - title: Deploy and configure Microsoft Entra Workload ID on an Azure Kubernetes Service (AKS) cluster
    url: https://learn.microsoft.com/azure/aks/workload-identity-deploy-cluster
  - title: Use Microsoft Entra Workload ID with Azure Kubernetes Service (AKS)
    url: https://learn.microsoft.com/azure/aks/workload-identity-overview
  - title: WorkloadIdentityCredential Class
    url: https://learn.microsoft.com/python/api/azure-identity/azure.identity.workloadidentitycredential
  - title: Azure OpenAI in Microsoft Foundry Models v1 API
    url: https://learn.microsoft.com/azure/foundry/openai/api-version-lifecycle
  - title: Assign Azure roles using Azure CLI
    url: https://learn.microsoft.com/azure/role-based-access-control/role-assignments-cli
  - title: Configure Service Accounts for Pods
    url: https://kubernetes.io/docs/tasks/configure-pod-container/configure-service-account/
  - title: Jobs
    url: https://kubernetes.io/docs/concepts/workloads/controllers/job/
  - title: kubectl create configmap
    url: https://kubernetes.io/docs/reference/kubectl/generated/kubectl_create/kubectl_create_configmap/
---

# AKS Workload Identity로 Foundry 키리스 호출

> 시나리오: AKS Pod에서 Python으로 **Microsoft Foundry 리소스**(`AIServices`)에 배포한 GPT 모델을 호출합니다.
> API 키나 클라이언트 시크릿을 저장하지 않고, **Pod의 서비스 계정이 앱 전용 사용자 할당 관리 ID(UAMI)로 인증**합니다.

## TL;DR: Pod 토큰을 Foundry 토큰으로 바꿉니다 { #tldr }

AKS에서 바뀌는 것은 **SDK가 토큰을 받는 방법**입니다. [컨테이너 인스턴스 예제](../index.md)는 `ManagedIdentityCredential`을 사용합니다.
AKS에서는 `WorkloadIdentityCredential()`이 Pod에 투영된 Kubernetes 서비스 계정 JWT를 읽어, UAMI를 나타내는 Microsoft Entra 액세스 토큰으로 교환합니다. Foundry로 보내는 것은 **Kubernetes JWT가 아니라 교환한 Entra 토큰**입니다.

```python
credential = WorkloadIdentityCredential()
token_provider = get_bearer_token_provider(credential, "https://ai.azure.com/.default")
client = OpenAI(base_url=f"{foundry_endpoint}/openai/v1/", api_key=token_provider)
```

## 인증 체인 { #auth-flow }

```text
AKS Job Pod (serviceAccountName: foundry-smoke)
  | Pod label → webhook이 토큰 파일과 AZURE_* 환경 변수 주입
  v
Kubernetes 서비스 계정 JWT
  | issuer = AKS OIDC issuer
  | subject = system:serviceaccount:foundry-keyless:foundry-smoke
  | audience = api://AzureADTokenExchange
  v
Microsoft Entra ID: UAMI의 Federated Identity Credential과 대조
  | WorkloadIdentityCredential → https://ai.azure.com/.default 범위로 토큰 요청
  v
OpenAI SDK: Authorization: Bearer <Entra 액세스 토큰>
  | POST <Foundry 리소스 URL>/openai/v1/responses
  v
Microsoft Foundry: UAMI의 리소스 범위 RBAC 확인 → 모델 추론
```

두 설정은 역할이 다릅니다. **Federated Identity Credential**은 어느 Pod의 서비스 계정이 UAMI로 인증할 수 있는지 정하고, **Foundry 리소스의 Azure RBAC**는 그 UAMI가 모델을 호출할 수 있는지 정합니다. Node 또는 kubelet의 관리 ID에는 Foundry 권한을 부여하지 않습니다.

## 1. AKS, 서비스 계정, 관리 ID 연결 { #configure-federation }

AKS Standard 클러스터의 OIDC issuer와 Workload Identity를 활성화합니다. 기존 운영 클러스터라면 변경 전에 적용 범위를 검토하세요.
`$aksGroup`, `$aksName`, `$identityGroup`, `$identityName`에는 승인된 실습 리소스 이름을 설정합니다. `kubectl`은 해당 클러스터의 컨텍스트를 사용해야 합니다.

```powershell
az aks update --resource-group $aksGroup --name $aksName `
  --enable-oidc-issuer --enable-workload-identity
$issuer = az aks show --resource-group $aksGroup --name $aksName `
  --query oidcIssuerProfile.issuerUrl -o tsv
az identity federated-credential create --resource-group $identityGroup `
  --identity-name $identityName --name foundry-smoke --issuer $issuer `
  --subject 'system:serviceaccount:foundry-keyless:foundry-smoke' `
  --audiences 'api://AzureADTokenExchange'
```

| 설정 | 연결하는 값 |
|---|---|
| 서비스 계정 annotation `azure.workload.identity/client-id` | UAMI의 `clientId`: SDK가 선택할 ID |
| Job의 `spec.template.metadata.labels` | `azure.workload.identity/use: "true"`: Pod에 주입을 요청 |
| Job의 `spec.template.spec.serviceAccountName` | `foundry-smoke`: 연합 자격 증명의 subject와 일치 |
| Azure 역할 할당의 `--assignee-object-id` | UAMI의 `principalId`: 역할을 부여받는 주체 |
| Azure 역할 할당의 `--scope` | 모델이 배포된 **Foundry 리소스** ARM ID |

실습 모델은 GPT이므로 UAMI에 `Cognitive Services OpenAI User`를 부여합니다. 다른 모델 또는 프로젝트 API에 적용할 때는 그 API에 맞는 역할을 확인하세요.

## 2. Pod에서 토큰 공급자 사용 { #app-code }

Webhook은 `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, `AZURE_FEDERATED_TOKEN_FILE`을 주입합니다. `WorkloadIdentityCredential()`이 이 값을 읽으므로 Python에서 토큰 파일 경로를 하드코딩할 필요가 없습니다. 이 예제는 다른 인증 방식이나 API 키로 폴백하지 않습니다.

```python
import os

from azure.identity import WorkloadIdentityCredential, get_bearer_token_provider
from openai import OpenAI

endpoint = os.environ["FOUNDRY_ENDPOINT"].rstrip("/")
scope = "https://ai.azure.com/.default"

with WorkloadIdentityCredential() as credential:
    provider = get_bearer_token_provider(credential, scope)
    with OpenAI(base_url=f"{endpoint}/openai/v1/", api_key=provider) as client:
        result = client.responses.create(
            model=os.environ["FOUNDRY_MODEL_DEPLOYMENT"],
            input="Say hello in one sentence.",
            max_output_tokens=300,
            store=False,
        )
        print(result.status)
```

`api_key=provider`의 `provider`는 문자열 비밀이 아니라 토큰 공급 함수입니다. `api://AzureADTokenExchange`는 **Kubernetes 토큰**의 교환 대상이고, `https://ai.azure.com/.default`는 **Entra 토큰** 요청 범위입니다. 둘을 바꿔 쓰지 않습니다.

## 3. Job으로 호출 검증 { #verify-job }

이 페이지의 실행 샘플에서 AKS 절차를 따라 `aks-job.yml`을 실행합니다. 매니페스트는 아래 Pod 템플릿을 사용합니다. 라벨은 Job 자체가 아닌 **Pod 템플릿**에 붙입니다.
`automountServiceAccountToken: false`는 기본 Kubernetes API 토큰 자동 마운트를 끄는 설정이며, 이 Job은 Workload Identity webhook이 별도로 주입하는 토큰을 사용합니다.

```yaml
spec:
  template:
    metadata:
      labels:
        azure.workload.identity/use: "true"
    spec:
      serviceAccountName: foundry-smoke
      automountServiceAccountToken: false
      restartPolicy: Never
```

Job 상태가 `Complete`이고 로그에 `OK auth=workload_identity http=200 response=completed`가 나타나면 통과입니다. 테스트는 토큰과 모델 응답 본문을 출력하지 않습니다. 키 인증 차단 자체의 검증과는 별개입니다.

### Azure 실측

2026-11-27에 AKS Standard 1.36의 단일 노드와 Microsoft Foundry(`AIServices`)의 `gpt-5-mini` 배포로 확인했습니다. Foundry의 관리 평면은 `disableLocalAuth=true` 상태였으며, 두 Job에는 API 키를 전달하지 않았습니다.

| 테스트 | 관측 결과 |
|---|---|
| 정상 Job: Workload Identity 라벨 사용 | Pod에 토큰 파일 경로·클라이언트 ID·테넌트 ID와 연합용 projected volume이 주입됐습니다. 모델 호출은 HTTP `200`, 응답 상태는 `completed`였고 Job은 `Complete`였습니다. |
| 대조 Job: 같은 서비스 계정에서 라벨만 제거 | `AZURE_CLIENT_ID`가 주입되지 않아 앱이 종료 코드 `2`로 중단했습니다. 다른 자격 증명으로 폴백하거나 모델을 호출하지 않았습니다. |

### 문제 해결

| 증상 | 먼저 확인할 항목 |
|---|---|
| `AZURE_FEDERATED_TOKEN_FILE` 또는 `AZURE_CLIENT_ID` 없음 | 실제 Pod의 라벨, 서비스 계정 annotation, 새 Pod에 대한 webhook 주입 여부 |
| Entra 토큰 발급 실패 | 발급자 URL, 네임스페이스와 서비스 계정 이름, `api://AzureADTokenExchange` |
| Entra 토큰은 발급되지만 Foundry 호출이 거부됨 | UAMI의 `principalId`에 올바른 역할과 Foundry 리소스 범위를 할당했는지, 권한이 전파됐는지 확인 |
| `404` 또는 연결 실패 | Foundry 리소스 URL과 모델 배포 이름, Pod의 DNS 및 네트워크 경로 |
