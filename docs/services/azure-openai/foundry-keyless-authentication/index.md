---
title: Foundry Keyless 인증
description: Microsoft Foundry 모델 호출을 API 키에서 Managed Identity로 전환하고 키 차단 전후를 확인합니다.
document_type: guide
services: [azure-openai, microsoft-foundry, microsoft-entra-id]
technologies: [python, azure-cli, powershell, bicep, rest-api]
tags: [migrate, secure, identity]
status: needs-review
verification_status: needs-review
sources_checked_at: 2026-11-27
last_verified: null
review_cycle_days: 180
applies_to: [Microsoft Foundry 리소스의 모델 추론 엔드포인트, OpenAI v1 Responses API, Azure Container Instances]
official_sources:
  - title: Microsoft Foundry architecture
    url: https://learn.microsoft.com/azure/foundry/concepts/architecture
  - title: "Quickstart: Set up your first Foundry resource"
    url: https://learn.microsoft.com/azure/ai-services/multi-service-resource
  - title: What is managed identities for Azure resources?
    url: https://learn.microsoft.com/entra/identity/managed-identities-azure-resources/overview
  - title: Use Microsoft Entra Workload ID with Azure Kubernetes Service (AKS)
    url: https://learn.microsoft.com/azure/aks/workload-identity-overview
  - title: identity Package
    url: https://learn.microsoft.com/python/api/azure-identity/azure.identity
  - title: Configure keyless authentication with Microsoft Entra ID
    url: https://learn.microsoft.com/azure/foundry/foundry-models/how-to/configure-entra-id
  - title: Authentication and authorization in Microsoft Foundry
    url: https://learn.microsoft.com/azure/foundry/concepts/authentication-authorization-foundry
  - title: Azure OpenAI in Microsoft Foundry Models v1 API
    url: https://learn.microsoft.com/azure/foundry/openai/api-version-lifecycle
  - title: Get started with Azure OpenAI and the Responses API
    url: https://learn.microsoft.com/azure/developer/ai/get-started-azure-openai-starter-kit
  - title: Use the Azure OpenAI Responses API
    url: https://learn.microsoft.com/azure/foundry/openai/how-to/responses
  - title: Authenticate Azure-hosted Python apps to Azure resources using a user-assigned managed identity
    url: https://learn.microsoft.com/azure/developer/python/sdk/authentication/user-assigned-managed-identity
  - title: Assign Azure roles using Azure CLI
    url: https://learn.microsoft.com/azure/role-based-access-control/role-assignments-cli
  - title: Use managed identities with Azure Container Instances
    url: https://learn.microsoft.com/azure/container-instances/container-instances-managed-identity
  - title: Run containerized tasks with restart policies
    url: https://learn.microsoft.com/azure/container-instances/container-instances-restart-policy
  - title: Microsoft.ContainerInstance containerGroups 2023-05-01
    url: https://learn.microsoft.com/azure/templates/microsoft.containerinstance/2023-05-01/containergroups
  - title: Deploy Bicep files with the Azure CLI
    url: https://learn.microsoft.com/azure/azure-resource-manager/bicep/deploy-cli
  - title: az cognitiveservices account deployment
    url: https://learn.microsoft.com/cli/azure/cognitiveservices/account/deployment
  - title: az resource
    url: https://learn.microsoft.com/cli/azure/resource
  - title: Disable local authentication in Foundry Tools
    url: https://learn.microsoft.com/azure/ai-services/disable-local-auth
  - title: Rotate API keys
    url: https://learn.microsoft.com/azure/ai-services/rotate-keys
---

# Foundry Keyless 인증

> 시나리오: Azure에서 실행하는 Python 앱이 **Microsoft Foundry 리소스**(`kind: AIServices`)의 모델을 API 키로 호출하고 있습니다.
> 키 없이 모델 호출이 되는지 먼저 확인하고, 그다음 Foundry 리소스의 키 인증을 끕니다.
> 실습은 Foundry 리소스의 OpenAI 호환 v1 Responses API를 호출합니다. 독립 Azure OpenAI 리소스(`kind: OpenAI`)나 Foundry 프로젝트·Agent API는 사용하지 않습니다.

## TL;DR: 관리 ID가 코드에서 하는 일 { #tldr }

**Managed Identity(MI, 관리 ID)는 Azure가 자격 증명을 관리하는 앱의 신원입니다.** 앱 설정에 넣는 `clientId`는 어떤 관리 ID로 실행할지 가리키는 **식별자**이지 비밀 키가 아닙니다. ID를 컨테이너에 연결하면 Azure Identity SDK가 실행 환경의 관리 ID 기능을 통해 Microsoft Entra 액세스 토큰을 받아옵니다.

```python
credential = ManagedIdentityCredential(client_id=os.environ["AZURE_CLIENT_ID"])
token_provider = get_bearer_token_provider(credential, "https://ai.azure.com/.default")
client = OpenAI(base_url=f"{foundry_endpoint}/openai/v1/", api_key=token_provider)
```

여기서 `api_key`에 넘기는 것은 **키나 토큰 문자열이 아니라 함수**입니다. 모델을 호출할 때 OpenAI SDK가 이 함수를 호출해 유효한 토큰을 얻고 `Authorization: Bearer <token>`을 보냅니다. Azure Identity가 토큰 캐시와 갱신을 처리합니다. Foundry는 토큰으로 **누가 요청했는지**를 확인하고, 이 ID에 모델 호출 역할이 있는지는 **Azure RBAC**로 확인합니다.

앱 설정에 남는 값은 Foundry 엔드포인트, 모델 배포 이름, 관리 ID의 `clientId`입니다. `clientId`만 복사한 다른 호스트에서는 그 ID로 토큰을 받을 수 없습니다. Azure에서 해당 관리 ID를 실제 실행 호스트에 연결해야 합니다.

**AKS에서 실행한다면** [AKS Workload Identity로 Foundry 키리스 호출](aks-workload-identity/index.md)을 따르세요. Pod는 노드의 관리 ID를 빌려 쓰지 않고, Kubernetes 서비스 계정 토큰을 애플리케이션 전용 관리 ID의 Entra 토큰으로 교환합니다.

## 인증 체인 { #auth-flow }

```text
Azure Container Instances
  | (1) 호스트에 사용자 할당 관리 ID(UAMI) 연결
  v
ManagedIdentityCredential(client_id=...)
  | (2) Azure 호스트를 통해 Foundry용 Entra 토큰 요청
  |     scope = https://ai.azure.com/.default
  v
OpenAI SDK: Authorization: Bearer <access-token>
  | (3) POST <Foundry 리소스 URL>/openai/v1/responses
  v
Microsoft Foundry (AIServices)
  | (4) 토큰의 호출 주체 확인 + 리소스 범위 RBAC 검사
  v
Foundry에 배포된 모델
```

권한은 **모델을 호출하는 호스트의 관리 ID**에 부여합니다. Foundry 리소스 자체의 관리 ID는 Foundry가 다른 서비스에 접근할 때 사용하는 별도 주체입니다. Azure CLI로 리소스를 만들 수 있다는 사실만으로 앱의 모델 호출 권한이 생기지는 않습니다.

| 값 | 쓰는 곳 |
|---|---|
| UAMI 리소스 ID (`id`) | Azure 호스트에 UAMI 연결 |
| UAMI 주체 ID (`principalId`) | Foundry 리소스에서 호출 주체의 IAM 역할 할당 |
| UAMI 클라이언트 ID (`clientId`) | Python에서 `ManagedIdentityCredential(client_id=...)`로 UAMI 선택 |
| 토큰 범위 (`https://ai.azure.com/.default`) | Foundry용 토큰 요청. 모델 호출 권한을 부여하는 값은 아님 |
| 모델 배포 이름 | 요청의 `model`. 카탈로그의 모델 이름과 다를 수 있음 |

## 1. 관리 ID 연결 및 추론 권한 부여 { #assign-identity }

호스트의 **Identity** 설정에서 UAMI를 연결합니다. **Foundry 리소스의 액세스 제어(IAM)** 에서 이 ID에 `Cognitive Services OpenAI User`를 부여합니다.
기존 운영 앱에 시스템 할당 관리 ID가 있다면 그 ID의 `principalId`에 같은 역할을 부여하고, 코드에서는 `ManagedIdentityCredential()`을 사용합니다.

Azure CLI로 구성할 때 `$resourceId`는 **모델 배포를 소유한 리소스의 ARM ID**이고 `$principalId`는 **호출 앱의 관리 ID 주체 ID**입니다.

```powershell
az role assignment create `
  --assignee-object-id $principalId --assignee-principal-type ServicePrincipal `
  --role 'Cognitive Services OpenAI User' --scope $resourceId
```

[Foundry Models 전체의 인증 안내][foundry-entra]는 `Cognitive Services User`를 안내합니다.
여기서는 Foundry에 배포한 GPT 모델을 [OpenAI 호환 v1 API][openai-v1]로만 호출하므로 Azure OpenAI 모델로 범위를 제한하는 역할을 사용합니다. 역할 이름에 `OpenAI`가 있어도 할당 대상은 **Foundry 리소스**입니다.
다른 모델 공급자나 프로젝트 API를 호출한다면 해당 엔드포인트의 역할을 별도로 확인하세요.

## 2. Python 클라이언트에서 키를 토큰 공급자로 교체 { #change-client }

같은 `OpenAI` 클라이언트에서 인증 입력만 교체합니다. `FOUNDRY_ENDPOINT`에는 `https://<resource>.services.ai.azure.com` 형식의 **Foundry 리소스 URL**을 설정합니다. 프로젝트 URL의 `/api/projects/<project>`는 붙이지 않습니다.

### 전환 전: 키 문자열

```python
import os
from openai import OpenAI

endpoint = os.environ["FOUNDRY_ENDPOINT"].rstrip("/")
client = OpenAI(
    base_url=f"{endpoint}/openai/v1/",
    api_key=os.environ["FOUNDRY_API_KEY"],
)
```

### 전환 후: 관리 ID 토큰 공급자

```python
import os
from azure.identity import ManagedIdentityCredential, get_bearer_token_provider
from openai import OpenAI

endpoint = os.environ["FOUNDRY_ENDPOINT"].rstrip("/")
credential = ManagedIdentityCredential(client_id=os.environ["AZURE_CLIENT_ID"])
token_provider = get_bearer_token_provider(credential, "https://ai.azure.com/.default")
client = OpenAI(base_url=f"{endpoint}/openai/v1/", api_key=token_provider)
```

클라이언트를 만드는 부분만 바꾸므로 아래 모델 호출 코드는 그대로 유지할 수 있습니다.

```python
response = client.responses.create(
    model=os.environ["FOUNDRY_MODEL_DEPLOYMENT"],
    input="Say hello in one sentence.",
    max_output_tokens=300,
    store=False,
)
```

SDK 동작을 두 줄로 풀어 쓰면 아래와 같습니다. 토큰을 로그에 찍거나 환경 변수에 저장하지 않습니다. 서비스 코드에서는 고정 토큰 대신 위의 토큰 공급자를 계속 사용합니다.

```python
access_token = credential.get_token("https://ai.azure.com/.default")
headers = {"Authorization": f"Bearer {access_token.token}"}
```

이 예제는 [v1 API 문서][openai-v1]의 `https://ai.azure.com/.default` 범위를 사용합니다. 다른 API나 기존 버전의 클라이언트에 그대로 옮기지 말고 해당 엔드포인트의 인증 문서를 따르세요. 기존 앱의 API 버전 변경까지 한 번에 적용할 필요는 없습니다.

로컬에서 `az login`한 사용자로 테스트할 때는 `AzureCliCredential()`으로 별도 확인할 수 있습니다. 로컬 사용자의 호출 성공은 Azure 호스트의 관리 ID 검증을 대신하지 않습니다. 배포 코드에서는 `ManagedIdentityCredential`로 고정하고 키로 돌아가는 분기를 두지 않습니다.

## 3. 격리된 Azure 실습에서 전환 전후 비교 { #smoke-test }

아래 재현은 전용 리소스 그룹에 Foundry 리소스(`AIServices`), GPT 모델 배포, UAMI, 일회성 Azure Container Instances 컨테이너를 사용합니다. 컨테이너는 외부에서 요청을 받는 웹 서버 없이 모델 호출만 실행합니다.
리소스 생성과 역할 할당 권한이 있는 실습 구독을 명시적으로 선택하고, 선택한 지역의 모델 버전과 표준 SKU 할당량을 확인하세요.
모델 호출과 컨테이너 실행에는 비용이 발생할 수 있습니다.

아래 실행 샘플의 사용 절차에 따라 **키 차단 전** 컨테이너를 실행하세요. 키를 넘기지 않은 상태에서 `OK auth=managed_identity http=200 response=completed`와 종료 코드 `0`을 모두 확인합니다.
키 차단을 검증하려면 같은 모델 배포에 유효한 실습용 키로 먼저 한 번 호출해 HTTP `200`을 확인하고, 그 키로만 차단 후 대조 요청을 보냅니다. 비교 요청에는 Microsoft Entra 토큰을 함께 넣지 않습니다.

모든 운영 호출자(앱, 배치, 배포 슬롯, 게이트웨이 등)의 키리스 경로가 동작하고 영향 범위를 확인한 뒤, 아래와 같이 키 인증을 끕니다. 실습에서는 전용 계정에만 실행합니다.

```powershell
az resource update --ids $resourceId --subscription $subscription `
  --set properties.disableLocalAuth=true --output none
az resource show --ids $resourceId --subscription $subscription `
  --query properties.disableLocalAuth --output tsv
```

| 확인 대상 | `disableLocalAuth` 설정 전 | `disableLocalAuth=true` 설정 후 |
|---|---|---|
| Azure 컨테이너의 관리 ID | HTTP `200`, 모델 응답 완료, 종료 코드 `0` | 새 컨테이너에서 HTTP `200`, 모델 응답 완료, 종료 코드 `0` |
| 기존 유효 키만 사용한 동일 요청 | HTTP `200` | 최대 8분 관측 구간에서 `200`이 계속 반환되어 **차단 적용 미확인** |
| Foundry 리소스의 ARM 속성 | 키 허용 상태 | `properties.disableLocalAuth=true` |

위 표는 2026-11-27에 전용 **Microsoft Foundry** 리소스(`AIServices`), `gpt-5-mini` Global Standard 배포, Azure Container Instances에서 관측한 결과입니다. 모델 호출에만 사용한 짧은 예제 요청이며, 프로젝트·Agent API나 연결 리소스는 검증하지 않았습니다.

**관리 ID 전환과 기존 키 차단은 별개의 검증입니다.** ARM 속성이 먼저 바뀌고 모델 엔드포인트에는 나중에 적용될 수 있습니다. [공식 차단 안내][disable-auth]에 따라 차단 전 성공한 **같은 키와 같은 요청**에서 인증 거부(`401`)를 확인한 뒤에만 차단 완료로 판단합니다. `429`는 호출 제한이지 인증 거부가 아닙니다. 키가 계속 성공하면 적용을 기다려 다시 확인하고, 문서에 안내된 전파 시간을 넘겨도 계속 성공하면 엔드포인트와 정책을 점검합니다.

## 4. 남은 비밀 제거 및 연결 리소스 보호 { #remove-secrets }

1. 앱 코드뿐 아니라 배포 슬롯·작업, 앱 설정, CI/CD 변수, IaC 매개변수, Foundry 연결, 이미지와 로그에서 키·연결 문자열의 참조를 찾습니다. 비밀값을 출력하거나 수집하지 말고 리소스와 소비자 목록만 기록합니다.
2. 키리스로 전환한 호출자에서 `FOUNDRY_API_KEY` 등 기존 키 설정, 관련 Key Vault 참조, 키 읽기 권한을 제거합니다. 재배포나 이전 슬롯으로 전환해도 오래된 키가 다시 주입되지 않는지 확인합니다.
3. Storage, Search 등 연결 리소스는 별도로 전환합니다. 호출 주체가 앱인지 Foundry인지 구분한 다음, 해당 ID에 대상 리소스의 데이터 역할을 부여하고 연결별 읽기·쓰기 동작을 검증합니다. Foundry의 키 차단이 연결 리소스의 키를 차단하거나 교체하지는 않습니다.
4. 코드나 설정에 저장되었던 키는 **그 키를 발급한 리소스에서** 교체합니다. 아직 키 의존성이 있으면 [키 교체 절차][rotate-keys]에 따라 미사용 키를 재생성하고 소비자를 새 키로 이동시킨 뒤, 이전 키를 재생성합니다. 두 키가 모두 쓰인다면 먼저 한쪽으로 소비자를 모읍니다. 유출이 의심되면 정기 교체가 아니라 사고 대응 절차에 따라 폐기와 영향 조사를 진행합니다.
5. 운영 복구는 먼저 관리 ID 연결, 역할, 네트워크를 고칩니다. 키 재허용이 승인된 비상 조치라면 노출됐거나 폐기한 키를 복원하지 말고, 새 키와 차단을 다시 검증할 시점을 정합니다.

## 오류를 좁히는 순서 { #troubleshooting }

| 증상 | 먼저 확인할 항목 |
|---|---|
| 토큰 발급 실패 | 실행 중인 Azure 호스트에 UAMI가 연결됐는지, `AZURE_CLIENT_ID`가 `clientId`인지 확인 |
| `401` 또는 권한 오류 | 토큰 범위와 리소스 호스트를 확인하고, 앱의 `principalId`에 계정 범위 역할이 있는지 확인. 새 할당이면 전파 후 재실행 |
| `403` 또는 연결 시간 초과 | RBAC뿐 아니라 리소스 네트워크 정책, 호출 위치, DNS를 분리해 확인. 인증 전환을 이유로 방화벽을 열지 않음 |
| `404` 또는 배포 없음 | `/openai/v1/responses` 경로와 해당 계정에 생성된 모델 **배포 이름**을 확인 |
| `429` | 요청 제한과 모델 할당량을 확인. 인증 오류로 처리하지 않음 |

[foundry-entra]: https://learn.microsoft.com/azure/foundry/foundry-models/how-to/configure-entra-id
[openai-v1]: https://learn.microsoft.com/azure/foundry/openai/api-version-lifecycle
[disable-auth]: https://learn.microsoft.com/azure/ai-services/disable-local-auth
[rotate-keys]: https://learn.microsoft.com/azure/ai-services/rotate-keys
