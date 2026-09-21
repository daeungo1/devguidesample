---
title: AKS 애플리케이션 배포 전략과 Pod rollout 제어
description: Recreate, RollingUpdate, Blue/Green, Canary를 비교하고 Pod 교체 수와 트래픽 비율, 승인·롤백 설정을 변경하는 방법
document_type: guide
services: [azure-kubernetes-service]
technologies: [kubernetes, gitops]
tags: [deploy, operate]
status: current
verification_status: verified
sources_checked_at: 2026-09-21
official_sources:
  - title: CI/CD for microservices
    url: https://learn.microsoft.com/azure/architecture/microservices/ci-cd
  - title: Deployment and cluster reliability best practices for Azure Kubernetes Service (AKS)
    url: https://learn.microsoft.com/azure/aks/best-practices-app-cluster-reliability
  - title: Zero-downtime migration to Azure Kubernetes Service (AKS)
    url: https://learn.microsoft.com/azure/aks/zero-downtime-migration
  - title: Configure rolling upgrades for Azure Kubernetes Service (AKS) node pools
    url: https://learn.microsoft.com/azure/aks/upgrade-aks-node-pools-rolling
  - title: Supported Kubernetes versions in Azure Kubernetes Service (AKS)
    url: https://learn.microsoft.com/azure/aks/supported-kubernetes-versions
  - title: Support policies for Azure Kubernetes Service
    url: https://learn.microsoft.com/azure/aks/support-policies
  - title: Deployments
    url: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
  - title: StatefulSets
    url: https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/
  - title: DaemonSet
    url: https://kubernetes.io/docs/reference/kubernetes-api/apps/daemon-set-v1/
  - title: Disruptions
    url: https://kubernetes.io/docs/concepts/workloads/pods/disruptions/
  - title: Horizontal Pod Autoscaling
    url: https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/
  - title: Service
    url: https://kubernetes.io/docs/concepts/services-networking/service/
  - title: Configure Liveness, Readiness and Startup Probes
    url: https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/
  - title: Update API Objects in Place Using kubectl patch
    url: https://kubernetes.io/docs/tasks/manage-kubernetes-objects/update-api-object-kubectl-patch/
  - title: kubectl diff
    url: https://kubernetes.io/docs/reference/kubectl/generated/kubectl_diff/
  - title: Canary Deployment Strategy
    url: https://github.com/argoproj/argo-rollouts/blob/v1.10.0/docs/features/canary/index.md
  - title: BlueGreen Deployment Strategy
    url: https://github.com/argoproj/argo-rollouts/blob/v1.10.0/docs/features/bluegreen.md
  - title: Rollouts Abort
    url: https://github.com/argoproj/argo-rollouts/blob/v1.10.0/docs/generated/kubectl-argo-rollouts/kubectl-argo-rollouts_abort.md
  - title: Request Routing
    url: https://github.com/istio/istio.io/blob/master/content/en/docs/tasks/traffic-management/request-routing/index.md
  - title: Mirroring
    url: https://github.com/istio/istio.io/blob/master/content/en/docs/tasks/traffic-management/mirroring/index.md
last_verified: 2026-09-21
review_cycle_days: 180
applies_to:
  - AKS의 apps/v1 Deployment
  - Argo Rollouts v1.10.0 설정 예시, 별도 설치 필요
  - StatefulSet과 DaemonSet은 본문의 컨트롤러별 조건 적용
---

# AKS 애플리케이션 배포 전략과 Pod rollout 제어

## 목표

AKS에서 “Pod를 몇 개씩 배포할 것인가”를 정할 때는 다음 세 가지를
분리해야 합니다.

| 질문 | 제어 대상 | 대표 설정 |
|---|---|---|
| 기존 Pod를 얼마나 줄이고 새 Pod를 얼마나 추가할까? | Pod 교체와 가용성 | `maxSurge`, `maxUnavailable`, `minReadySeconds` |
| 신버전에 사용자 요청을 얼마나 보낼까? | 서비스 대상과 트래픽 분배 | Service selector, 라우터의 가중치, Canary 단계 |
| 언제 다음 단계로 넘어가고 실패하면 어떻게 복귀할까? | 승격과 복구 | 수동 승인, 대기, 지표 분석, 이전 버전·라우팅 복원 |

**Pod 수의 비율과 트래픽 비율은 같은 것이 아니며, `maxSurge`는 고정된
배치 크기나 승인 단계를 뜻하지 않습니다.** 이 문서는 배포 전략을 먼저
선택한 뒤 해당 전략의 수량·트래픽·진행 조건을 변경하는 순서로 설명합니다.

## 적용 범위와 지원 버전

- 기본 대상은 AKS에서 실행하는 `apps/v1` Deployment입니다.
  Deployment의 `spec.strategy.type`은 `RollingUpdate`와 `Recreate`입니다.
- Blue/Green과 Canary는 Deployment의 추가 enum 값이 아닙니다.
  여러 워크로드와 Service·라우팅을 조합하거나 별도 rollout 컨트롤러를
  사용해 구현합니다.
- 선택 사항인 Argo Rollouts 예시는 **v1.10.0 공식 문서**를 기준으로 합니다.
  `argoproj.io/v1alpha1`의 `Rollout`은 Deployment와 다른 리소스이며,
  컨트롤러·CRD·CLI 플러그인을 별도로 준비해야 합니다. 이 예시를 AKS의
  기본 설치 기능이나 Microsoft 관리형 기능으로 간주하지 않습니다.
- StatefulSet·DaemonSet의 설정은 별도 절에서 구분합니다. Kubernetes
  upstream 기능의 존재와 특정 AKS 버전에서의 사용 조건을 구분하고,
  [AKS 지원 버전](https://learn.microsoft.com/azure/aks/supported-kubernetes-versions)과
  [지원 정책](https://learn.microsoft.com/azure/aks/support-policies)을 확인합니다.

!!! note "검증 범위"
    2026-09-21 UTC에 Microsoft Learn과 Kubernetes·Argo Rollouts·Istio
    공식 원문을 대조했습니다. 실제 AKS 클러스터에서 배포·부하·장애 복구를
    실행한 결과는 아닙니다. 아래 수치는 설명용이며 운영 권장값을
    일괄 지정하지 않습니다.

## 사전 조건

1. 테스트 클러스터의 kubeconfig와 대상 리소스 조회·변경 권한을 준비합니다.
   예시의 `rollout-demo`, `web`, `web-blue` 등은 모두 가상 이름입니다.
2. 기존 애플리케이션의 readiness, 종료 처리, 리소스 요청량을 확인합니다.
   새 Pod가 들어갈 노드 용량과 네트워크·볼륨 제약도 확인합니다.
3. 성공·중단 기준을 정합니다. 예를 들어 가용 replica 수뿐 아니라 오류율,
   지연 시간, 핵심 업무 요청의 성공 여부를 함께 판단합니다.
4. GitOps·Helm으로 관리한다면 변경의 원본과 복구 담당자를 먼저 정합니다.
   예시의 직접 patch는 원본 변경을 대신하지 않습니다.

```bash
kubectl config current-context
kubectl version
kubectl -n rollout-demo get deployments,hpa,pdb
```

아래 YAML은 **기존 리소스에서 수정할 부분만 발췌한 설정**입니다.
독립적으로 `kubectl apply`할 완성된 배포 매니페스트가 아닙니다.
명령 예시는 Bash/zsh 기준이며, 각 절의 대상 리소스가 이미 존재한다고
가정합니다. 한 절의 예제를 다른 전략의 리소스에 연속 적용하지 않습니다.

근거: [AKS 애플리케이션 안정성 지침](https://learn.microsoft.com/azure/aks/best-practices-app-cluster-reliability).

## 배포 전략 선택

| 전략 | 신·구 버전 교체 방식 | 추가 용량과 운영 부담 | 복구 방식 |
|---|---|---|---|
| Recreate | 기존 버전 Pod를 종료한 뒤 신버전을 생성 | 두 버전을 함께 유지하지 않지만 배포 중 중단을 수용해야 함 | 이전 Pod template으로 다시 배포하며 재기동 시간 필요 |
| Rolling Update | 신버전 ReplicaSet을 늘리면서 구버전을 줄임 | surge 용량을 조절할 수 있고, 교체 중 두 버전이 공존 | 이전 Pod template으로 rollout |
| Blue/Green | 신버전을 별도로 준비·검증한 뒤 서비스 대상을 전환 | 두 버전을 함께 실행할 용량과 전환 절차 필요 | 구버전이 준비되어 있으면 서비스 대상을 되돌림 |
| Canary | 신버전을 일부에 노출하고 단계적으로 확대 | 트래픽 제어·관측·승격 조건의 운영 부담 | 확대 중단 후 구버전으로 라우팅·수량 복원 |

- 추가 컨트롤러 없이 점진적으로 교체하려면 Rolling Update부터 검토합니다.
- 배포 중 중단을 허용하고 신·구 버전 동시 실행을 피하려면 Recreate를 검토합니다.
- 전환 전에 별도 검증하고 서비스 대상을 되돌리는 절차가 중요하면 Blue/Green을
  검토합니다. 동일 클러스터에서도 구현할 수 있습니다.
- 실제 요청의 영향 범위를 단계적으로 늘리고 지표로 판단하려면 Canary를
  검토합니다. Pod 비율만 조절할지, 트래픽 라우터까지 사용할지 구분합니다.

이는 선택 기준이지 무중단 보장이 아닙니다. 신·구 버전의 API·데이터 호환성,
readiness와 종료 처리, 라우팅 전파를 함께 설계해야 합니다.
근거: [Microsoft Learn의 서비스 업데이트 전략](https://learn.microsoft.com/azure/architecture/microservices/ci-cd#update-services),
[Kubernetes Deployment 전략](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#strategy).

## 구성과 운영 절차

### 1. Rolling Update: Pod 교체 범위 설정

| 설정 경로 | 역할 | Deployment 기본값·주의점 |
|---|---|---|
| `spec.replicas` | 원하는 Pod 수 | 생략 시 `1`. HPA가 관리하는 경우 별도 고려 |
| `spec.strategy.type` | 교체 전략 | `RollingUpdate` |
| `spec.strategy.rollingUpdate.maxSurge` | 원하는 수보다 추가 생성할 수 있는 Pod 수 | `25%`. 정수 또는 퍼센트, 퍼센트는 **올림** |
| `spec.strategy.rollingUpdate.maxUnavailable` | 업데이트 중 사용할 수 없어도 되는 Pod 수 | `25%`. 정수 또는 퍼센트, 퍼센트는 **내림** |
| `spec.minReadySeconds` | 새 Pod를 Available로 인정하기 전 Ready 상태를 유지해야 하는 시간 | `0`초. 배치 간 고정 대기 시간이 아님 |
| `spec.progressDeadlineSeconds` | 배포 진행이 멈췄다고 보고하는 기준 시간 | `600`초. `minReadySeconds`보다 커야 하며 자동 롤백 설정이 아님 |

`maxSurge`와 `maxUnavailable`을 **동시에 0으로 설정할 수 없습니다.**

기존 Pod가 정상이고 replica 수가 바뀌지 않는다고 가정하면, 업데이트 시
컨트롤러가 유지하려는 가용 수는 `replicas - maxUnavailable` 이상입니다.
추가 생성 예산은 `replicas + maxSurge`까지입니다. 외부 장애로 줄어드는
가용성까지 보장하는 식은 아닙니다.

기본 `25%` 설정의 계산 예시는 다음과 같습니다.

| 원하는 replica 수 | 추가 허용: 올림 | 사용 불가 허용: 내림 | 유지하려는 가용 수 |
|---|---|---|---|
| 1 | 1 | 0 | 1 이상 |
| 3 | 1 | 0 | 3 이상 |
| 10 | 3 | 2 | 8 이상 |

replica가 10개일 때 정수 설정의 의미도 비교할 수 있습니다.

| 목적 예시 | `maxSurge` | `maxUnavailable` | 의미 |
|---|---|---|---|
| 추가 용량을 작게 사용하면서 가용 수 유지 | `1` | `0` | 1개 추가 허용, 기존 가용 수를 줄이는 교체는 허용하지 않음 |
| 추가 여유를 늘려 교체 진행 | `3` | `0` | 3개 추가 허용, 가용 수 10개 유지 목표 |
| surge 없이 일부 가용 수 감소 허용 | `0` | `2` | 2개까지 사용 불가 허용, 새 Pod를 위한 용량 확보 필요 |
| 추가 생성과 가용 수 감소를 함께 허용 | `2` | `1` | 두 제한을 함께 적용하며 고정 2개 단위 배치가 아님 |

!!! warning "관측되는 전체 Pod 수의 절대 상한은 아닙니다"
    종료 중인 Pod는 자원을 계속 사용할 수 있습니다. `Terminating` Pod를
    포함한 실제 Pod 수와 자원 사용량은 일시적으로 `replicas + maxSurge`를
    넘을 수 있습니다. `maxSurge: 1`만으로 “어떤 순간에도 하나만 교체 중”을
    보장하거나 고정된 배치·승인 절차를 만들 수 없습니다.

기존 `web` Deployment의 설정 발췌 예시입니다. HPA가 replica 수를 관리하지
않는 경우를 가정합니다.

```yaml
spec:
  replicas: 10
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 2
      maxUnavailable: 0
  minReadySeconds: 10
  progressDeadlineSeconds: 600
```

직접 변경할 때는 replica 수는 그대로 두고 전략과 진행 조건만 patch할 수
있습니다. 이미 진행 중인 rollout이 있다면 변경이 진행에 영향을 줄 수
있으므로 먼저 현재 상태를 확인합니다.

```bash
kubectl -n rollout-demo rollout status deployment/web --timeout=10m
kubectl -n rollout-demo patch deployment web --type=merge -p '{"spec":{"strategy":{"type":"RollingUpdate","rollingUpdate":{"maxSurge":2,"maxUnavailable":0}},"minReadySeconds":10,"progressDeadlineSeconds":600}}'
kubectl -n rollout-demo get deployment web -o jsonpath='{.spec.strategy}{"\n"}{.spec.minReadySeconds}{"\n"}{.spec.progressDeadlineSeconds}{"\n"}'
```

**전략만 변경하면 새 revision을 만드는 rollout은 시작되지 않습니다.**
Deployment rollout은 `spec.template`이 바뀔 때 시작합니다. 새 이미지를
원본에 반영하거나, 같은 template의 Pod를 새로 만들 목적이라면 아래처럼
재시작을 요청합니다. 두 작업은 목적에 맞게 선택합니다.

```bash
kubectl -n rollout-demo rollout restart deployment/web
kubectl -n rollout-demo rollout status deployment/web --timeout=10m
```

새 Pod가 준비됐는지는 `readinessProbe` 등으로 판단합니다.
`minReadySeconds: 10`은 Ready 상태를 10초 유지한 뒤 rollout의 Available
수에 반영하도록 하는 설정이지, 사용자 트래픽을 반드시 10초 차단하는
설정은 아닙니다. `startupProbe`와 `livenessProbe`도 각각 시작과 재시작
판단을 위한 것이므로 교체 수 설정을 대신하지 않습니다.

근거: [Deployment 설정과 진행 조건](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/),
[probe 설정](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/),
[AKS 기존 클러스터의 애플리케이션 배포](https://learn.microsoft.com/azure/aks/zero-downtime-migration#release-an-application-in-an-existing-aks-cluster).

### 2. Recreate: 기존 버전을 종료한 뒤 배포

Deployment 업데이트 시 기존 Pod 종료를 기다린 뒤 새 버전을 만듭니다.
`RollingUpdate`의 수량 설정을 그대로 두지 않고 `rollingUpdate` 필드를
제거해야 합니다. JSON merge patch에서는 `null`로 제거할 수 있습니다.

```bash
kubectl -n rollout-demo patch deployment web --type=merge -p '{"spec":{"strategy":{"type":"Recreate","rollingUpdate":null}}}'
```

이후 Pod template을 변경하거나 `rollout restart`를 실행하면 Recreate
전략이 적용됩니다. 운영 중단을 승인받은 작업에서만 진행합니다.
Rolling Update로 돌아갈 때는 앞 절처럼 `type`과 `rollingUpdate` 설정을
함께 복원합니다.

Recreate의 종료 순서는 **Deployment 업데이트**에 대한 동작입니다.
사용자가 Pod를 직접 삭제했을 때의 모든 재생성까지 직렬화하거나,
데이터베이스의 단일 writer를 보장하는 장치로 사용하지 않습니다.

근거: [Recreate Deployment](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#recreate-deployment),
[kubectl patch](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/update-api-object-kubectl-patch/).

### 3. Blue/Green: 별도 준비 후 서비스 대상 전환

**기본 리소스 조합으로 구현하는 경우**에는 두 Deployment의 replica 수와
Service selector를 각각 관리합니다. 다음은 전환 방법만 설명하며,
아래 리소스와 라벨이 이미 구성된 경우를 전제로 합니다.

| 리소스 | 필요한 구성 |
|---|---|
| `web-blue` Deployment | 기존 버전, Pod 라벨 `app: web-bg`, `color: blue` |
| `web-green` Deployment | 신버전, Pod 라벨 `app: web-bg`, `color: green` |
| 각 Deployment의 selector | 자신의 색상만 선택하도록 구성하여 소유 Pod가 겹치지 않음 |
| `web-bg` Service | 운영용, 기존 selector가 정확히 `app: web-bg`, `color: blue` |
| `web-bg-preview` Service | 검증용, `app: web-bg`, `color: green` 선택 |

1. 신버전을 원하는 운영 replica 수로 준비합니다. preview 경로에서 업무
   요청과 의존 서비스 접근을 확인합니다. Ready 확인만으로 검증을 끝내지 않습니다.
2. 전환을 승인한 뒤 운영 Service가 신버전만 선택하도록 바꿉니다.
3. 운영 경로로 정상 응답이 오는지 확인하고 구버전을 즉시 제거하지 않습니다.
   라우팅 전파·기존 연결 종료·복구 관측 시간을 확보합니다.

```bash
kubectl -n rollout-demo rollout status deployment/web-green --timeout=10m
kubectl -n rollout-demo get service web-bg web-bg-preview -o yaml
kubectl -n rollout-demo patch service web-bg --type=json -p '[{"op":"test","path":"/spec/selector","value":{"app":"web-bg","color":"blue"}},{"op":"replace","path":"/spec/selector","value":{"app":"web-bg","color":"green"}}]'
kubectl -n rollout-demo get endpointslices -l kubernetes.io/service-name=web-bg
```

여기서는 selector **전체를 교체**하고, `test` 연산으로 예상한 기존 값인지
확인합니다. 실제 selector에 다른 키가 있다면 실패 원인을 확인하고 전환
계획에 맞게 수정합니다. 기존 키를 무심코 남기거나 제거하지 않습니다.
EndpointSlice 조회와 별도로 실제 서비스 진입점의 요청 성공을 검증합니다.

**Argo Rollouts로 자동화하는 경우**에는 별도의 `web-rollout` Rollout과
동일 namespace의 운영·preview Service가 준비되어 있어야 합니다.
아래는 이미 안정 버전이 있는 Rollout을 업데이트할 때의 설정 발췌입니다.
앞의 수동 전환과 동일한 Service를 두 주체가 함께 관리하지 않습니다.

```yaml
spec:
  replicas: 10
  strategy:
    blueGreen:
      activeService: web-rollout-active
      previewService: web-rollout-preview
      previewReplicaCount: 2
      autoPromotionEnabled: false
      scaleDownDelaySeconds: 60
```

- preview 단계에서는 신버전 2개로 검증하지만, 승격할 때는 신버전을
  `spec.replicas`인 10개로 늘린 뒤 운영 Service를 전환합니다.
  따라서 preview 수를 줄였다고 전환 시 필요한 전체 용량까지 줄어들지는 않습니다.
- `autoPromotionEnabled: false`는 자동 승격 대신 승인을 기다리도록 합니다.
- `scaleDownDelaySeconds`는 전환 후 구버전 축소를 지연합니다. 예시의
  60초가 모든 애플리케이션의 연결 종료나 복구 시간을 보장하지는 않습니다.
- 최초 생성 시에는 기존 안정 버전이 없으므로, 업데이트 때의 이중 버전
  검증 절차와 같은 것으로 간주하지 않습니다.

승인할 때 다음 단계로 승격합니다.

```bash
kubectl argo rollouts get rollout web-rollout -n rollout-demo
kubectl argo rollouts promote web-rollout -n rollout-demo
```

근거: [Microsoft Learn의 Blue/Green 설명](https://learn.microsoft.com/azure/architecture/microservices/ci-cd#blue-green-deployment),
[Service와 EndpointSlice](https://kubernetes.io/docs/concepts/services-networking/service/),
[Argo Rollouts v1.10.0 Blue/Green](https://github.com/argoproj/argo-rollouts/blob/v1.10.0/docs/features/bluegreen.md).

### 4. Canary: 비율과 승인 단계를 구분하여 설정

일반 Deployment 두 개를 하나의 Service로 묶고 replica 수를 바꾸는
간단한 Canary도 가능하지만, 이것만으로 요청의 일정 비율을 정확히
분리했다고 볼 수는 없습니다. 트래픽을 세밀하게 나누려면 가중치 라우팅을
지원하는 구성 요소를 함께 사용합니다.

Argo Rollouts의 경우에도 다음 두 구성을 구분해야 합니다.

| 구분 | `setWeight`의 의미 | Pod 수 제어 |
|---|---|---|
| Basic Canary: `trafficRouting` 없음 | 원하는 비율에 가깝도록 신·구 ReplicaSet 수를 정수로 조절 | `replicas`, `maxSurge`, `maxUnavailable` |
| 트래픽 라우터 연동 | 연동 라우터의 신버전 트래픽 가중치 변경 | 트래픽 가중치와 별개로 `setCanaryScale` 등을 사용 가능 |

다음은 **Basic Canary**인 기존 `web-canary` Rollout의 설정 발췌입니다.
안정 버전이 있는 상태에서 Pod template을 변경하는 업데이트를 전제로 합니다.

```yaml
spec:
  replicas: 10
  strategy:
    canary:
      maxSurge: 2
      maxUnavailable: 0
      steps:
        - setWeight: 20
        - pause: {}
        - setWeight: 50
        - pause:
            duration: 2m
        - setWeight: 100
```

- replica가 10개라면 첫 단계의 목표는 신버전 2개, 구버전 8개에 해당하는
  비율입니다. 전환 중 Pod 수는 rollout 예산에 따라 달라집니다.
- `pause: {}`는 수동 승격까지 기다립니다. 정해진 개수의 Pod가 떴다는
  이유만으로 다음 비율로 넘어가지 않습니다.
- 50% 단계 뒤의 `duration: 2m`은 시간 대기입니다. **오류율이나 SLO를
  자동 검증하는 설정은 아닙니다.** 자동 판단을 원하면 분석 템플릿과
  실제 지표 공급자를 별도로 연결해야 합니다.
- 라우터가 없는 이 예시의 `20`을 “실제 요청의 정확히 20%”로 해석하지
  않습니다. 작은 replica 수에서는 표현할 수 있는 비율도 제한됩니다.

```bash
kubectl argo rollouts get rollout web-canary -n rollout-demo --watch
```

관측 기준을 만족하고 승인된 경우, 별도 터미널에서 현재 대기 단계를
진행시킵니다. `--full`로 남은 단계를 모두 건너뛰는 방식은 이 절차에
포함하지 않습니다.

```bash
kubectl argo rollouts promote web-canary -n rollout-demo
```

**트래픽 라우터를 연동할 때**는 설치된 라우터에 맞는 `trafficRouting`과
stable/canary Service 등을 구성한 후 `setWeight`를 사용합니다.
`setCanaryScale.replicas`는 이 구성에서 신버전 Pod 수를 별도로 지정하는
설정입니다. Pod 수를 작게 고정한 채 가중치만 늘리면 신버전이 과부하될
수 있으므로 용량을 함께 확인합니다.

Argo Rollouts v1.10.0에서는 트래픽 라우팅을 사용하는 경우
`maxSurge`·`maxUnavailable`이 Basic Canary와 같은 방식으로 stable/canary의
목표 replica 수를 계산하지 않습니다. 기본적으로 stable 버전이 전체 수량을
유지하므로 `replicas + maxSurge`를 전체 용량 상한으로 사용하면 안 됩니다.
필요하면 `dynamicStableScale`과 `setCanaryScale`을 검토하되 복구 용량도
함께 설계합니다.

근거: [Canary release](https://learn.microsoft.com/azure/architecture/microservices/ci-cd#canary-release),
[Argo Rollouts v1.10.0 Canary](https://github.com/argoproj/argo-rollouts/blob/v1.10.0/docs/features/canary/index.md).

### 5. Git·Helm 원본에도 변경 반영

위 patch는 API 서버의 현재 리소스를 바꾸는 명령입니다. 지속적으로
유지할 설정은 해당 리소스를 생성하는 원본에도 반영합니다.

| 관리 방식 | 변경 위치와 확인 방법 |
|---|---|
| YAML 직접 관리 | 전체 Deployment 또는 Rollout 원본의 해당 `spec` 변경 후 diff·apply |
| Helm | chart가 실제로 제공하는 values와 template 연결을 확인한 뒤 변경. 모든 chart에 공통인 rollout values 경로는 없음 |
| GitOps | Git의 manifest·Helm values·overlay 변경을 리뷰하고 동기화. 직접 patch만 하면 이후 동기화에서 덮어써질 수 있음 |

아래 `deployment.yaml`은 운영자가 관리하는 **완전한 기존 매니페스트**를
뜻합니다. 이 문서의 발췌 YAML만 저장해서 사용하는 파일이 아닙니다.

```bash
kubectl -n rollout-demo diff -f deployment.yaml
kubectl -n rollout-demo apply -f deployment.yaml
```

`diff`의 종료 코드 `1`은 차이가 있다는 뜻입니다. 적용 전 차이를 검토하고,
GitOps 관리 리소스에는 별도의 직접 apply 대신 해당 동기화 절차를 따릅니다.
근거: [kubectl diff](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_diff/),
[GitOps와 점진적 배포](https://learn.microsoft.com/azure/architecture/microservices/ci-cd#progressive-delivery-and-gitops).

## 검증 방법

Deployment 업데이트를 확인할 때는 전체 Pod 수만 세지 말고 원하는 수,
신버전 수, Ready 수, Available 수를 구분합니다.

```bash
kubectl -n rollout-demo rollout status deployment/web --timeout=10m
kubectl -n rollout-demo get deployment web -o custom-columns=NAME:.metadata.name,DESIRED:.spec.replicas,UPDATED:.status.updatedReplicas,READY:.status.readyReplicas,AVAILABLE:.status.availableReplicas
kubectl -n rollout-demo get replicasets -l app=web
kubectl -n rollout-demo get pods -l app=web -o wide
kubectl -n rollout-demo describe deployment web
kubectl -n rollout-demo get events --sort-by=.metadata.creationTimestamp
```

`app=web`은 해당 Deployment의 실제 Pod 라벨과 일치해야 합니다.
`rollout status --timeout=10m`은 **클라이언트의 대기 한도**이며, 시간이
지났다고 서버의 rollout을 취소하거나 롤백하지 않습니다.

전략별로 다음 항목을 추가 확인합니다.

- **Rolling Update:** 신버전 replica 수와 Available 수가 최종 목표에 도달하는지,
  구버전이 정리되는지, 종료 중 자원 사용이 감당 가능한지 확인합니다.
- **Blue/Green:** preview 검증과 실제 운영 경로 검증을 나누고, 전환된
  Service·라우터 대상과 구버전 복귀 가능 여부를 확인합니다.
- **Canary:** rollout 단계뿐 아니라 버전별 요청량·오류율·지연 시간을
  확인합니다. 트래픽 가중치 설정값과 관측된 요청 비율을 구분합니다.
- **공통:** readiness 통과 외에 로그인·조회·쓰기 등 해당 서비스의
  핵심 요청을 확인하고, 다음 단계 승인 전에 정한 중단 기준과 비교합니다.

근거: [Deployment 상태](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#deployment-status),
[AKS 관측·검증 절차](https://learn.microsoft.com/azure/aks/zero-downtime-migration#observability-and-automated-rollback).

## 롤백과 트러블슈팅

### 전략별 중단·복구

**Deployment:** revision 이력을 확인하고 이전 revision이 검증된 복귀
대상인지 확인한 뒤 undo합니다.

```bash
kubectl -n rollout-demo rollout history deployment/web
kubectl -n rollout-demo rollout undo deployment/web
kubectl -n rollout-demo rollout status deployment/web --timeout=10m
```

기본 undo는 이전 revision의 **Pod template**을 복원합니다. 현재 replica
수나 배포 전략, Service selector, 외부 데이터베이스 변경을 함께 되돌리는
명령이 아닙니다. 대상 revision 이력이 보존되어 있어야 합니다.
Deployment를 `rollout pause`한 상태에서는 undo 전에 `rollout resume`이
필요하며, pause를 이미 시작한 모든 Pod 작업의 즉시 취소로 보지 않습니다.

**수동 Blue/Green:** 구버전이 정상이고 필요한 용량을 유지하는지 확인한 뒤
운영 Service selector를 복원합니다. 아래도 앞 절의 정확한 라벨 구성을
전제로 합니다.

```bash
kubectl -n rollout-demo rollout status deployment/web-blue --timeout=10m
kubectl -n rollout-demo patch service web-bg --type=json -p '[{"op":"test","path":"/spec/selector","value":{"app":"web-bg","color":"green"}},{"op":"replace","path":"/spec/selector","value":{"app":"web-bg","color":"blue"}}]'
```

구버전을 이미 축소했다면 재확장·Ready 확인 시간이 필요하므로 즉시
복귀를 보장할 수 없습니다. Argo Rollouts가 관리하는 Service는 이 수동
patch 대상이 아니며, 컨트롤러의 복구 절차와 원본 template을 사용합니다.

**Argo Rollouts Canary:** 확대를 중단하고 이전 안정 버전을 활성 상태로
되돌릴 때 abort를 사용합니다.

```bash
kubectl argo rollouts abort web-canary -n rollout-demo
kubectl argo rollouts get rollout web-canary -n rollout-demo
```

abort는 **원하는 Pod template을 이전 버전으로 고쳐 주지 않습니다.**
재진행 시 문제 버전으로 다시 향하지 않도록 Git·Helm 원본의 template도
검증된 버전으로 되돌리고 동기화 상태를 확인합니다.
단순한 pause·시간 대기만 구성했다고 지표 기반 자동 롤백이 생기지는 않습니다.

어떤 전략이든 애플리케이션을 되돌릴 수 있는지와 데이터·스키마를 되돌릴 수
있는지는 별개의 문제입니다. 두 버전이 공존하거나 복귀할 수 있도록 API와
데이터 변경의 호환성을 별도 검증합니다.

근거: [Deployment 롤백](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#rolling-back-a-deployment),
[Argo Rollouts abort](https://github.com/argoproj/argo-rollouts/blob/v1.10.0/docs/generated/kubectl-argo-rollouts/kubectl-argo-rollouts_abort.md),
[AKS 배포와 데이터 마이그레이션](https://learn.microsoft.com/azure/aks/zero-downtime-migration).

### 자주 혼동하는 증상

| 증상 | 먼저 확인할 것 |
|---|---|
| 전략을 patch했는데 Pod가 교체되지 않음 | `spec.template` 변경 또는 재시작 요청 여부. 전략 변경만으로 새 rollout은 시작하지 않음 |
| 새 Pod가 Pending에서 멈춤 | CPU·메모리 요청량, scheduling 조건, 네트워크·볼륨 제약, quota. surge를 늘려도 실제 용량이 생기지는 않음 |
| Running인데 교체가 진행되지 않음 | Ready 여부, readiness 실패, `minReadySeconds`, 사용 불가 예산 |
| `ProgressDeadlineExceeded` 발생 | 진행 실패를 보고한 상태. 자동 rollback 결과로 해석하지 말고 원인 조사·복구 판단 |
| rollout 중 Pod가 계산한 수보다 많음 | `Terminating` Pod와 종료 유예 시간, replica 수 변화, 사용하는 컨트롤러의 계산 방식 |
| Canary가 멈춰 있음 | 승인 대기인 `pause: {}`인지, 실제 실패·분석 중단인지 구분 |
| 배포는 성공했는데 요청 실패 | 실제 진입점의 라우팅·세션·의존 서비스와 신·구 버전 호환성 확인 |

## 제약 사항과 버전별 차이

### PDB·HPA·노드풀 업그레이드는 별도 제어

| 설정 | 제어 대상 | 애플리케이션 rollout과의 관계 |
|---|---|---|
| Deployment `maxUnavailable` | 해당 Deployment의 업데이트 | 앱 교체 시 가용성 예산 |
| PDB의 `minAvailable` / `maxUnavailable` | Eviction API를 통한 자발적 중단 | drain 등을 제한. Deployment·StatefulSet의 rolling update 개수를 직접 제한하지 않음 |
| HPA의 `minReplicas` / `maxReplicas`·`behavior` | 부하에 따른 목표 replica 수와 스케일 속도 | 신버전 배포 단계나 트래픽 비율 설정이 아님 |
| AKS 노드풀 `--max-surge` / `--max-unavailable` | 노드 업그레이드의 추가·사용 불가 **노드 수** | 같은 이름이어도 Deployment Pod 설정과 다른 계층 |

PDB는 애플리케이션 rolling update의 사용 불가 Pod를 예산 계산에 반영하지만
그 업데이트 자체를 막는 장치는 아닙니다. 직접 Pod 삭제를 PDB가 막아 줄
것으로 가정해서도 안 됩니다.

HPA가 replica 수를 바꾸면 퍼센트 기반 rollout 예산의 기준도 달라집니다.
HPA가 관리하는 리소스에 고정 `spec.replicas`를 반복 적용하지 않도록
원본 관리 방식을 조정합니다. 기존 manifest에서 이 필드를 제거할 때도
적용 방식에 따른 일시적 replica 감소 가능성을 확인합니다.

근거: [Pod disruption 예산의 범위](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/#pod-disruption-budgets),
[HPA로의 전환](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/#migrating-deployments-and-statefulsets-to-horizontal-autoscaling),
[AKS 노드풀 rolling upgrade](https://learn.microsoft.com/azure/aks/upgrade-aks-node-pools-rolling).

### StatefulSet·DaemonSet에 같은 설정을 복사하지 않기

| 컨트롤러 | 설정 위치와 중요한 차이 |
|---|---|
| Deployment | `spec.strategy.rollingUpdate`. surge와 unavailable을 조합하여 ReplicaSet 수를 조절 |
| StatefulSet | `spec.updateStrategy`. 기본 RollingUpdate는 큰 ordinal부터 순서대로 교체. `partition`으로 업데이트 대상을 제한할 수 있음 |
| DaemonSet | `spec.updateStrategy.rollingUpdate`. 대상 노드에 배치되는 Pod를 갱신하며 Deployment의 `replicas`를 기준으로 계산하지 않음 |

**StatefulSet:** 시작 ordinal이 0이고 replica가 5개일 때 `partition: 4`는
새 Pod template을 ordinal 4에만 적용하는 식으로 업데이트 범위를 제한합니다.
`partition`을 3으로 낮추면 ordinal 3 이상이 대상이 됩니다. 이는 트래픽
비율이나 “동시에 몇 개”의 설정이 아닙니다. `OnDelete`에서는 template을
바꾸어도 컨트롤러가 자동으로 기존 Pod를 교체하지 않습니다.

`spec.updateStrategy.rollingUpdate.maxUnavailable`은 upstream Kubernetes
**1.35에서 Beta이며 기본 활성화**된 기능입니다. 기본값은 `1`, 퍼센트는
올림이며 `0`은 허용하지 않습니다. 더 큰 값으로 병렬 교체하려면
`podManagementPolicy: Parallel`과 순서 보장 요구사항을 함께 검토해야
합니다. 기존 StatefulSet의 필드를 무조건 변경할 수 있다고 가정하지 말고
실제 버전·기능 조건을 확인합니다. Deployment의 surge 설정을 복사해
동일 identity의 추가 Pod를 만드는 방식으로 해석하지 않습니다.

이 버전 표시는 upstream 동작의 기준입니다. AKS는 별도 예외가 없는
upstream Stable·Beta 기능을 지원하지만, Alpha 기능은 별도 문서화된 경우를
제외하면 지원하지 않습니다. 더 낮은 Kubernetes 버전에 같은 필드를
적용하거나 새 전략이 모든 AKS 버전에 있다고 가정하지 않습니다.

**DaemonSet:** RollingUpdate의 기본 `maxUnavailable`은 `1`, `maxSurge`는
`0`입니다. 퍼센트는 원하는 대상 노드 수 기준으로 올림합니다. unavailable
방식과 surge 방식의 제약이 Deployment와 달라, `maxSurge`가 0보다 크면
`maxUnavailable`은 0이어야 하며 두 값을 모두 0으로 둘 수도 없습니다.
노드별 중복 Pod가 사용하는 자원·포트 등도 확인해야 합니다.

근거: [StatefulSet update 전략](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/#update-strategies),
[DaemonSet API](https://kubernetes.io/docs/reference/kubernetes-api/apps/daemon-set-v1/),
[AKS 지원 정책](https://learn.microsoft.com/azure/aks/support-policies#unsupported-alpha-and-beta-kubernetes-features).

### A/B·Shadow·기능 플래그는 노출·검증 기법으로 구분

| 기법 | 목적과 제어 대상 | 주의점 |
|---|---|---|
| A/B를 위한 대상별 라우팅 | 사용자 그룹·요청 헤더 조건으로 서로 다른 버전에 전달 | 순차 교체 개수와 다른 문제이며 대상 구분·관측 기준 필요 |
| Shadow / Traffic Mirroring | 운영 요청 일부를 신버전에도 복제하고 결과 관측 | 복제 요청의 응답은 버리지만, 쓰기 작업의 부작용까지 없어지는 것은 아님 |
| 기능 플래그 | 코드 배포와 기능 공개를 분리하고 실행 경로를 선택 | Pod 교체·트래픽 라우팅·데이터 복구를 대신하지 않음 |

예를 들어 Istio의 헤더 기반 라우팅과 미러링을 활용할 수 있지만,
Deployment의 `strategy.type`에 `AB`나 `Shadow`를 지정하는 기능은
아닙니다. 미러링을 검토할 때는 테스트 데이터나 격리된 쓰기 경로를 준비해
중복 결제·메시지 발행 같은 부작용을 방지합니다.

근거: [Istio Request Routing](https://github.com/istio/istio.io/blob/master/content/en/docs/tasks/traffic-management/request-routing/index.md),
[Istio Mirroring](https://github.com/istio/istio.io/blob/master/content/en/docs/tasks/traffic-management/mirroring/index.md),
[AKS 검증과 기능 플래그](https://learn.microsoft.com/azure/aks/zero-downtime-migration#testing-and-validation-recipes).

## 관련 문서

- [Argo CD Image Updater와 ACR 연동](../argocd-image-updater-acr/index.md): 이미지 변경을 GitOps 배포 흐름에 연결하는 별도 주제

## 공식 참고 자료

- [CI/CD for microservices](https://learn.microsoft.com/azure/architecture/microservices/ci-cd)
- [Deployment and cluster reliability best practices for AKS](https://learn.microsoft.com/azure/aks/best-practices-app-cluster-reliability)
- [Zero-downtime migration to AKS](https://learn.microsoft.com/azure/aks/zero-downtime-migration)
- [AKS supported Kubernetes versions](https://learn.microsoft.com/azure/aks/supported-kubernetes-versions)
- [AKS support policies](https://learn.microsoft.com/azure/aks/support-policies)
- [Configure rolling upgrades for AKS node pools](https://learn.microsoft.com/azure/aks/upgrade-aks-node-pools-rolling)
- [Kubernetes Deployments](https://kubernetes.io/docs/concepts/workloads/controllers/deployment/)
- [Kubernetes StatefulSets](https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/)
- [Kubernetes DaemonSet API](https://kubernetes.io/docs/reference/kubernetes-api/apps/daemon-set-v1/)
- [Kubernetes Disruptions](https://kubernetes.io/docs/concepts/workloads/pods/disruptions/)
- [Kubernetes Horizontal Pod Autoscaling](https://kubernetes.io/docs/concepts/workloads/autoscaling/horizontal-pod-autoscale/)
- [Kubernetes Service](https://kubernetes.io/docs/concepts/services-networking/service/)
- [Configure Liveness, Readiness and Startup Probes](https://kubernetes.io/docs/tasks/configure-pod-container/configure-liveness-readiness-startup-probes/)
- [Update API Objects in Place Using kubectl patch](https://kubernetes.io/docs/tasks/manage-kubernetes-objects/update-api-object-kubectl-patch/)
- [kubectl diff](https://kubernetes.io/docs/reference/kubectl/generated/kubectl_diff/)
- [Argo Rollouts v1.10.0 Canary Deployment Strategy](https://github.com/argoproj/argo-rollouts/blob/v1.10.0/docs/features/canary/index.md)
- [Argo Rollouts v1.10.0 BlueGreen Deployment Strategy](https://github.com/argoproj/argo-rollouts/blob/v1.10.0/docs/features/bluegreen.md)
- [Argo Rollouts v1.10.0 Rollouts Abort](https://github.com/argoproj/argo-rollouts/blob/v1.10.0/docs/generated/kubectl-argo-rollouts/kubectl-argo-rollouts_abort.md)
- [Istio Request Routing](https://github.com/istio/istio.io/blob/master/content/en/docs/tasks/traffic-management/request-routing/index.md)
- [Istio Mirroring](https://github.com/istio/istio.io/blob/master/content/en/docs/tasks/traffic-management/mirroring/index.md)
