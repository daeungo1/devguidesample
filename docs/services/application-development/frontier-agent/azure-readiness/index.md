---
title: "Agent 서비스 준비: Frontier Agent 패턴을 Azure에 매핑하기"
description: dots와 Muse의 여섯 구성 요소를 Foundry hosted agent, routines, memory, toolbox 승인, Prompt Shields, Entra Agent ID, Agent 365에 대응시키고, 플랫폼이 제공하는 부분과 직접 설계할 제어면을 구분해 단계별 도입 순서를 제안합니다.
document_type: research
topic_order: 3
services: [application-development, microsoft-foundry, microsoft-entra-id]
technologies: [mcp]
tags: [design, secure, evaluate, ai-agents]
status: current
verification_status: verified
published_at: 2026-09-30
sources_checked_at: 2026-09-30
official_sources:
  - title: What are hosted agents?
    url: https://learn.microsoft.com/azure/foundry/agents/concepts/hosted-agents
  - title: Automate agents with routines
    url: https://learn.microsoft.com/azure/foundry/agents/how-to/use-routines
  - title: Reminder tool for self-scheduling agents
    url: https://learn.microsoft.com/azure/foundry/agents/how-to/tools/reminder-tool
  - title: Memory in Microsoft Foundry Agent Service (preview)
    url: https://learn.microsoft.com/azure/foundry/agents/concepts/what-is-memory
  - title: Create and manage a toolbox in Foundry
    url: https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox
  - title: Using function tools with human in the loop approvals
    url: https://learn.microsoft.com/agent-framework/agents/tools/tool-approval
  - title: Prompt Shields in Microsoft Foundry
    url: https://learn.microsoft.com/azure/foundry/openai/concepts/content-filter-prompt-shields
  - title: What is the Microsoft agent identity platform
    url: https://learn.microsoft.com/entra/agent-id/what-is-agent-id-platform
  - title: Overview of Microsoft Agent 365
    url: https://learn.microsoft.com/microsoft-agent-365/overview
  - title: Introducing dots
    url: https://openai.com/index/introducing-dots/
  - title: How We Built Safety Into Muse
    url: https://research.meta.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse
---

# Agent 서비스 준비: Frontier Agent 패턴을 Azure에 매핑하기

**조사 기준일: 2026-09-30.** [dots](../openai-dots/index.md)와
[Muse](../meta-muse/index.md)는 소비자·업무용 완제품이다. 우리가 준비하는 Agent
서비스는 대개 조직의 데이터와 시스템 위에서 동작하는 **자체 에이전트**다. 두 제품이
보여 준 설계를 그대로 복제할 수는 없지만, 같은 여섯 구성 요소를 Azure에서 어떻게
채울지는 미리 정해 둘 수 있다.

## 질문

- frontier agent의 여섯 구성 요소 가운데 Azure 플랫폼이 이미 제공하는 것은 무엇인가?
- 플랫폼이 제공하지 않아 **직접 설계해야 하는 부분**은 어디인가?
- 어떤 순서로 도입해야 위험을 통제하면서 가치를 빨리 확인할 수 있는가?

## 조사 범위와 방법

- Microsoft Learn에서 Foundry Agent Service의 hosted agent, routines, reminder tool,
  memory, toolbox와 도구 승인, Prompt Shields, Microsoft Entra Agent ID, Microsoft
  Agent 365 문서를 검색하고 원문 전체를 확인했다.
- 각 문서의 preview 표시, 제한, 지역, 전제 조건을 표에 함께 적었다.
- 실제 배포나 성능 측정은 하지 않았다. 권장 구성은 공식 문서의 기능 범위에 이
  리서치의 설계 판단을 더한 것이며, 판단에 해당하는 부분은 “권고”로 구분한다.

## 결과 1: 구성 요소별 Azure 대응표

| 구성 요소 | dots·Muse의 구현 | Azure에서 확인한 기능 | 직접 설계할 부분 |
|---|---|---|---|
| 전용 실행 환경 | 사용자·dot별 지속 클라우드 컴퓨터와 브라우저 | Foundry hosted agent의 세션별 VM 격리 sandbox, `$HOME`·`/files` 지속, state store | 세션을 넘는 사용자 단위 작업 공간 설계, 브라우저 실행 환경(이 리서치 범위 밖) |
| 상시 실행과 선제성 | 24/7 동작, 읽기 전용 proactive research, 이벤트 기반 후속 작업 | routines(schedule, timer, GitHub issue, Teams 메시지), reminder tool(preview), Responses background 모드 | 읽기 전용 선제 작업과 쓰기 작업의 실행 경로 분리 |
| 연결 | Plugin 4,000개 이상, connector와 SKILL | Toolbox MCP endpoint, Toolbox의 통합 인증 | 업무 시스템별 읽기·쓰기 권한 분리와 도구 위험 등급 |
| 기억과 개인화 | 피드백 학습, 편집 가능한 Memory 파일 | Foundry memory(preview): 프로필·대화 요약·절차 기억, 항목 CRUD, TTL | 사용자에게 기억을 보여 주고 지우는 UI, memory 오염 대응 |
| 분리된 제어면 | Auto-review, Sentinel, 자격 증명 대리, egress 검사 | toolbox `require_approval` 설정, Agent Framework 승인 함수, Prompt Shields, 고객 VNet 아웃바운드, Key Vault 연결 | **승인 집행 서비스, egress 검사, 자격 증명 경계** |
| 투명성과 통제 | Activity View, 활동 로그, 승인 카드, 목표 화면 | Application Insights 자동 연결과 OpenTelemetry trace, Agent 365 registry | 사용자용 활동 로그·승인 UI와 행동 감사 기록 |
| 에이전트 신원 | specialist dots의 조직 부여 신원·자격 증명 | 에이전트별 Microsoft Entra ID(agent identity), OBO, Entra Agent ID, Agent 365 | 에이전트별 최소 권한 RBAC와 수명 주기 정책 |

![채널에서 들어온 요청을 Foundry hosted agent가 세션별 VM 격리 sandbox에서 처리하고, 모든 도구 호출과 외부 행동은 직접 구축하는 제어면의 정책·승인 서비스, 자격 증명 경계, egress 제어, 행동 감사 기록을 거쳐 Toolbox, Foundry 모델, Azure 리소스, 외부 SaaS에 도달한다. 하단에는 Application Insights, Microsoft Entra Agent ID, Microsoft Agent 365로 구성된 관측과 거버넌스 계층이 있다](../images/azure-frontier-agent-mapping.svg)

*그림 1. 이 리서치가 제안하는 Azure 참조 구성. 파란색은 Microsoft Learn에서 확인한
플랫폼 기능, 점선 주황색은 직접 설계해야 하는 영역이다.*

## 결과 2: 플랫폼이 제공하는 기반

### 실행 환경: Foundry hosted agent

[Hosted agent][hosted-agents]는 에이전트 코드를 컨테이너 이미지로 패키징해 Azure
Container Registry에 올리면, Agent Service가 이미지를 가져와 **전용 Microsoft Entra
ID(agent identity)와 전용 endpoint**를 할당해 실행하는 방식이다. Agent Framework,
LangGraph, Semantic Kernel 또는 직접 작성한 코드를 쓸 수 있고, 언어는 Python과 C#을
지원한다.

| 항목 | Microsoft Learn에서 확인한 내용 | frontier agent 관점의 의미 |
|---|---|---|
| 격리 | 세션마다 VM 수준으로 격리된 전용 sandbox | dots·Muse의 사용자별 격리와 같은 방향. 단위는 사용자가 아닌 **세션** |
| 지속 상태 | `$HOME`과 `/files` 업로드 내용이 턴과 유휴 기간을 넘어 유지되고 재개 시 복원 | 작업 공간 파일이 유휴 후에도 남는다 |
| 세션 수명 | 유휴 제한 시간 2~60분(기본 15분), 유휴 시 compute 해제와 상태 저장, 30일 비활성 후 영구 삭제 | 30일을 넘는 장기 상태는 state store나 외부 저장소에 둔다 |
| Sandbox 크기 | 0.5 vCPU·1 GiB, 1 vCPU·2 GiB, 2 vCPU·4 GiB | 과금은 활성 세션 전체의 CPU·메모리 사용량 기준이므로 동시성에 비례 |
| 디스크 | 1 vCPU 이상에서 세션당 최대 20 GiB, 약 20%는 시스템 예약 | 컨테이너 이미지와 `$HOME`이 같은 예산을 공유 |
| 프로토콜 | Responses, Invocations, Invocations(WebSocket), Teams·M365용 Activity, A2A | 채팅, webhook, 음성, 에이전트 간 위임을 한 에이전트에서 조합 |
| 장기 작업 | Responses의 `background: true`, 프로세스 중단 후 작업을 보존하는 resilient 실행 | 사용자가 떠난 뒤에도 이어지는 작업의 기반 |
| 버전 | 버전은 불변이며 endpoint는 한 번에 한 버전으로 트래픽 100%를 보냄. 트래픽 분할 미지원 | 정책 변경과 모델 교체는 새 버전 배포로 관리 |
| 네트워크 | 네트워크 격리된 Foundry 리소스에 배포하고 고객 VNet으로 아웃바운드 가능 | egress 검사 계층을 고객 네트워크 경로에 둘 수 있다 |
| 관측 | Application Insights 연결 문자열 자동 주입, 프로토콜 라이브러리가 OpenTelemetry trace 기본 전송 | 에이전트 실행 추적의 출발점 |

hosted agent의 durable state store는 키-값 형태의 애플리케이션 상태를 compute와
독립적으로 보관한다. store 이름별로 파티션이 나뉘고, 최종 사용자별로 항목을 나눌 수
있으며, 기본 30일 유휴 기간이 지나면 항목이 만료된다(만료하지 않도록 설정 가능).

### 상시 실행: routines와 reminder tool

dots와 Muse의 “사용자가 없는 동안 일하기”는 Azure에서 두 기능으로 구성한다.

[Routines][routines]는 schedule, 특정 시각, 외부 이벤트에 따라 에이전트를 실행하는
자동화 규칙이다.

| 트리거 | 동작 |
|---|---|
| `schedule` | cron 식 반복 실행. 최소 간격 5분 |
| `timer` | 특정 시각 또는 지정한 시간 후 한 번 실행 |
| `github_issue` | 감시하는 GitHub 저장소에서 issue가 열리거나 닫힐 때 실행 |
| `custom` | 외부 제공자 이벤트. `teams` 제공자는 감시하는 Teams 채널에 새 메시지가 올라오면 실행 |

routine은 Responses 또는 Invocations API로 prompt agent나 hosted agent를 호출하며,
workflow agent는 지원하지 않는다. 기본 실행 신원은 **agent identity**다. 위임된
사용자 권한이 필요한 도구가 있으면 routine 생성자의 신원(creator identity)을 명시적으로
선택해야 하며, 생성 후에는 바꿀 수 없다. UK West, Switzerland West, Japan West, UAE
North, Norway East에서는 사용할 수 없고, 고객 관리 키(CMK) 암호화를 지원하지 않는다.

[Reminder tool][reminder]은 **preview**다. hosted agent가 실행 중에 스스로 미래 시점의
재실행을 예약한다. 에이전트가 1~43,200분(30일) 사이의 지연과 할 일을 지정하면
Foundry가 scheduled routine을 만들고, 지정한 시간이 지나면 **같은 대화**로 에이전트를
다시 호출한다. 장시간 작업의 완료 확인이나 사용자 후속 연락 같은 패턴에 맞다. prompt
agent에서는 쓸 수 없다.

### 기억: Foundry memory (preview)

[Memory][memory]는 세션을 넘는 **장기 기억**을 관리형으로 제공하며 현재 preview다.
대화에서 정보를 추출하고, LLM으로 중복과 충돌을 정리한 뒤, 필요할 때 검색한다.

| 기억 유형 | 내용 | 권장 검색 시점 |
|---|---|---|
| User profile | 언어, 제품 기본값, 접근성 요구 같은 지속적 선호 | 대화 시작 시 |
| Chat summary | 이전 대화 주제의 요약 | 턴마다 현재 메시지 기준 |
| Procedural | 이전 상호작용에서 추론한 반복 작업 절차 | 반복 작업 요청 시 |

항목 단위 생성·조회·수정·삭제, store 기본 TTL, 사용자가 명시적으로 요청한 기억·망각을
즉시 반영하는 명령을 지원한다. 이는 Muse가 Memory 파일을 사용자에게 열어 둔 설계와
같은 방향의 기능이다. 제약도 분명하다.

- 호환되는 Azure OpenAI chat·embedding 모델 배포가 필요하다.
- memory store에는 VNet 통합을 지원하지 않는다.
- scope는 store당 최대 100개, scope당 기억은 최대 10,000개다.
- 문서는 **prompt injection과 memory 오염**을 주요 위험으로 명시하고, Content Safety의
  prompt injection 탐지와 적대적 테스트를 권장한다.

### 연결과 도구: Toolbox

Hosted agent는 도구를 에이전트 정의에 직접 넣지 않고 Foundry 프로젝트의 **Toolbox MCP
endpoint**로 연결한다. Toolbox에는 Code Interpreter, Web Search, Azure AI Search,
OpenAPI, MCP, A2A, Skills 같은 Foundry 관리 도구가 포함되며, OAuth identity
passthrough, agent identity, 키 기반 인증을 한곳에서 처리한다.

### 신원: agent identity, Entra Agent ID, Agent 365

- 각 hosted agent는 배포 시 전용 Microsoft Entra ID(agent identity)를 자동으로 받는다.
  모델 추론과 세션 저장소 외의 Azure 리소스는 이 신원에 RBAC 역할을 직접 부여한다.
- Teams 같은 Microsoft 365 채널에서 사용자 토큰이 있으면 OAuth 2.0 On-Behalf-Of로
  사용자 권한을 위임받고, 사용자 토큰이 없는 자율·백그라운드 실행에서는 에이전트 자신의
  신원으로 인증한다.
- [Microsoft agent identity platform][agent-id]은 agent identity blueprint, agent
  identity, 에이전트의 사용자 계정을 핵심 구성으로 하며, OAuth 2.0과 OpenID Connect로
  인증·인가한다. Entra Agent ID는 모든 Microsoft Entra 고객이 사용할 수 있다.
- Copilot Studio 같은 Microsoft 플랫폼뿐 아니라 AWS Bedrock, n8n처럼 OAuth 2.0과 OIDC를
  지원하는 외부 플랫폼의 에이전트도 Entra ID Auth SDK(sidecar)나 workload identity
  federation으로 등록할 수 있다.
- Conditional Access 같은 Entra 보안 기능을 에이전트로 확장하려면 Microsoft Agent 365가
  필요하다. Agent 365는 Microsoft 365 E7에 포함되고 E5/A5/Business Premium에 add-on으로
  제공된다.
- [Microsoft Agent 365][agent-365]는 2026-05-01부터 Commercial 세그먼트에 사용자 단위로
  일반 공급되며, 중앙 registry와 Entra·Purview·Defender로 에이전트를 관찰·통제·보호한다.

OpenAI가 specialist dots를 Agent 365와 통합하겠다고 밝힌 것은, 조직이 자체 에이전트와
외부 에이전트를 **같은 거버넌스 계층**에서 관리하게 될 가능성을 보여 준다. 우리 에이전트도
처음부터 agent identity 단위로 권한과 감사를 설계해 두면 이 흐름에 합류하기 쉽다.

## 결과 3: 직접 설계해야 하는 제어면

두 제품에서 가장 중요한 구성 요소는 **에이전트가 끌 수 없는 제어면**이었다. Azure의
기능을 확인한 결과, 이 부분은 설정만으로 완성되지 않는다.

### 도구 승인의 집행은 런타임 책임

Toolbox에서 MCP 도구에 `require_approval`을 `"always"` 또는 `"never"`로 설정할 수 있다.
그러나 [Toolbox 문서][toolbox]는 다음을 명시한다.

- Toolbox는 `tools/list`의 각 도구 항목에 `_meta.tool_configuration`을 담아 반환한다.
- `require_approval`이 `"always"`이면 에이전트 런타임이 사용자에게 대기 중인 행동을
  보여 주고 확인을 기다려야 한다.
- **MCP endpoint는 `tools/call`을 막지 않는다.** 집행은 전적으로 에이전트 런타임의
  책임이다.

[Agent Framework][tool-approval]는 `ApprovalRequiredAIFunction`으로 함수 도구를 감싸
승인이 필요한 도구를 표시하고, 실행이 승인 요청 응답으로 끝나면 호출자가 사용자 입력을
받아 다음 실행에 넘기는 human-in-the-loop 패턴을 제공한다. 이 패턴은 **에이전트
프로세스 안에서** 동작한다.

dots의 Auto-review와 Muse의 Sentinel은 모두 에이전트가 바꿀 수 없는 위치에서
허가를 결정했다. 따라서 다음을 권고한다.

1. 쓰기·전송·삭제·결제처럼 되돌리기 어려운 도구는 에이전트 컨테이너가 직접
   호출하지 않고, **별도 정책·승인 서비스**를 통해서만 실행되게 한다.
2. 정책 서비스는 도구, 대상, 데이터 등급, 요청 맥락을 입력으로 받아 허용·거부·사용자
   확인을 결정하고, 차단 사유를 구조화된 응답으로 에이전트에 돌려준다.
3. 승인은 대화가 아니라 채널 UI(예: Teams 카드, 자체 앱의 승인 화면)로 받고, 승인
   결과는 대상·범위·기간이 붙은 권한으로 저장해 이후 호출과 정확히 대조한다.
4. Agent Framework의 승인 함수와 `require_approval`은 사용자 경험을 위한 1차 장치로
   쓰고, 정책 서비스를 최종 집행 지점으로 둔다.

### Prompt injection: 분류기와 결정적 경계를 함께

[Prompt Shields][prompt-shields]는 사용자 프롬프트 공격과 document attack을 탐지한다.
Foundry에서는 document attack을 **사용자 입력과 도구 응답** 개입 지점에서 검사하며,
guardrail을 모델 배포나 에이전트에 할당해 적용한다. 제3자 콘텐츠를 낮은 신뢰로
표시하는 Spotlighting은 preview이고 Chat Completions API에서만 동작한다.

Muse는 분류기를 한 층으로만 보고, 분류기를 통과한 공격도 막는 결정적 경계를 따로
두었다. 같은 관점에서 다음을 권고한다.

- 웹, 이메일, 문서처럼 외부 콘텐츠를 읽는 도구가 있는 에이전트에는 document attack
  탐지를 도구 응답 지점까지 적용한다.
- 개인 데이터 접근, 비신뢰 콘텐츠 노출, 외부 통신 능력이 한 실행 경로에 모이지 않게
  도구 조합을 설계한다. 모일 수밖에 없다면 외부 전송은 반드시 정책 서비스를 거친다.
- memory에 저장되는 내용도 공격 경로다. 저장 전 검사와 사용자 삭제 기능을 함께 둔다.

### 비밀과 egress

- Hosted agent 문서는 **컨테이너 이미지나 환경 변수에 비밀을 넣지 말고** managed
  identity와 connection을 쓰며, 비밀은 관리형 저장소(Key Vault connection)에 두라고
  안내한다.
- Azure 리소스는 agent identity와 RBAC로 접근하면 에이전트가 비밀 자체를 다룰 필요가
  없다. 외부 SaaS는 Toolbox의 OAuth identity passthrough를 우선 검토한다.
- 사용자 비밀번호를 받아 웹 사이트에 로그인하는 dots·Muse식 기능이 필요하다면, 모델을
  멈추고 모델 밖에서 자격 증명을 주입하는 **별도 자격 증명 경계**를 설계해야 한다.
  이 기능은 이번에 확인한 플랫폼 기능 범위에 없다.
- Hosted agent는 고객 VNet을 아웃바운드 경로로 사용할 수 있다. Muse의 Sentinel처럼
  목적지와 요청을 검사하는 egress 통제는 이 고객 네트워크 경로에 직접 구성하는 것을
  권고한다.

## 권고: 단계별 도입 순서

| 단계 | 목표 | 핵심 구성 | 넘어가는 조건 |
|---|---|---|---|
| 0. 읽기 전용 비서 | 선제 조사의 가치 검증 | hosted agent, 읽기 전용 Toolbox 도구, schedule routine, Application Insights | 사용자가 유용하다고 판단한 알림 비율과 오탐 비율을 측정 |
| 1. 승인 기반 실행 | 쓰기 행동의 안전한 도입 | 정책·승인 서비스, 채널 승인 UI, Prompt Shields, 행동 감사 기록 | 승인 요청 대비 거부율, 승인 피로 지표, 차단 사유 분포 확인 |
| 2. 기억과 개인화 | 반복 설명 제거 | Foundry memory(preview), 기억 열람·삭제 UI, reminder tool(preview) | 기억 품질 평가와 memory 오염 시나리오 적대적 테스트 통과 |
| 3. 전담 에이전트 | 조직 업무를 맡는 specialist 에이전트 | agent identity별 최소 권한 RBAC, Entra Agent ID, egress 통제 | 업무 책임·도구·검토 방식을 업무 담당자와 문서로 합의 |
| 4. 거버넌스 통합 | 조직 전체의 에이전트 관리 | Microsoft Agent 365 registry, Purview, Defender | 자체·외부 에이전트를 같은 registry에서 관찰 |

각 단계는 이전 단계의 제어면을 유지한 채 권한을 넓힌다. 특히 1단계의 정책·승인
서비스를 건너뛰고 2단계 이후 기능을 먼저 붙이면, 기억과 선제 실행이 합쳐져 위험이 가장
큰 조합이 된다.

## 도입 전 점검표

- [ ] 도구마다 읽기·쓰기·전송·삭제·결제 등급을 정하고, 에이전트가 직접 할 수 없는 행동을
      목록으로 만들었다.
- [ ] 되돌리기 어려운 행동은 에이전트 컨테이너 밖의 정책 서비스에서만 실행된다.
- [ ] 승인은 모델을 거치지 않는 UI로 요청·응답하며, 대상·범위·기간이 기록된다.
- [ ] 선제 작업 경로는 읽기 권한만 가진다.
- [ ] 이미지·환경 변수에 비밀이 없고, Azure 리소스는 agent identity와 RBAC로 접근한다.
- [ ] 외부 콘텐츠를 읽는 도구에 Prompt Shields document attack 검사를 도구 응답 지점까지
      적용했다.
- [ ] 아웃바운드 트래픽이 고객 VNet 경로의 검사 지점을 통과한다.
- [ ] 사용자가 활동 로그를 보고, 작업을 중단하고, 기억을 삭제할 수 있다.
- [ ] preview 기능(memory, reminder tool, Spotlighting)의 사용 범위와 대체 방안을 정했다.
- [ ] Routines를 쓸 프로젝트가 미지원 지역이나 CMK 요구 대상이 아닌지 확인했다.

## 한계

- 브라우저를 직접 조작하는 computer use 기능, 결제 보호, 사용자 비밀번호 주입처럼
  dots와 Muse가 제공하는 일부 기능은 이번 조사에서 Azure 대응 기능을 확인하지 않았다.
- Preview 기능은 동작과 제한이 바뀔 수 있다. 적용 전 해당 문서를 다시 확인해야 한다.
- 정책·승인 서비스와 egress 검사의 구체적 구현(제품 선택, 성능, 비용)은 다루지 않았다.
  이는 후속 가이드나 실습에서 검증할 과제다.
- dots와 Muse에 관한 내용은 각 회사의 공개 자료 기준이며 독립적으로 검증하지 않았다.

## 공식 출처

| 출처 | 이 페이지에서 사용한 범위 |
|---|---|
| [What are hosted agents?][hosted-agents] | 실행 모델, 격리, 세션 수명, 크기, 프로토콜, 신원, state store, 네트워크, 관측, 비밀 관리 |
| [Automate agents with routines][routines] | 트리거와 액션 유형, 실행 신원, 지역·CMK 제한 |
| [Reminder tool for self-scheduling agents][reminder] | preview 상태, 지연 범위, 같은 대화 재호출, 제한 |
| [Memory in Microsoft Foundry Agent Service (preview)][memory] | 기억 유형, 관리 기능, 보안 위험, 한도와 제한 |
| [Create and manage a toolbox in Foundry][toolbox] | `require_approval` 설정과 런타임 집행 책임 |
| [Using function tools with human in the loop approvals][tool-approval] | Agent Framework의 승인 함수와 human-in-the-loop 흐름 |
| [Prompt Shields in Microsoft Foundry][prompt-shields] | 공격 유형, 개입 지점, Spotlighting 제한 |
| [What is the Microsoft agent identity platform][agent-id] | 신원 구성, 인증 방식, 외부 플랫폼 연동, Agent 365 요구 조건 |
| [Overview of Microsoft Agent 365][agent-365] | observe, govern, secure 범위와 GA 시점 |
| [Introducing dots][dots] | specialist dots와 Agent 365 통합 계획 |
| [How We Built Safety Into Muse][muse-security] | Sentinel, 자격 증명 대리, egress 검사 설계의 비교 기준 |

[hosted-agents]: https://learn.microsoft.com/azure/foundry/agents/concepts/hosted-agents
[routines]: https://learn.microsoft.com/azure/foundry/agents/how-to/use-routines
[reminder]: https://learn.microsoft.com/azure/foundry/agents/how-to/tools/reminder-tool
[memory]: https://learn.microsoft.com/azure/foundry/agents/concepts/what-is-memory
[toolbox]: https://learn.microsoft.com/azure/foundry/agents/how-to/tools/toolbox
[tool-approval]: https://learn.microsoft.com/agent-framework/agents/tools/tool-approval
[prompt-shields]: https://learn.microsoft.com/azure/foundry/openai/concepts/content-filter-prompt-shields
[agent-id]: https://learn.microsoft.com/entra/agent-id/what-is-agent-id-platform
[agent-365]: https://learn.microsoft.com/microsoft-agent-365/overview
[dots]: https://openai.com/index/introducing-dots/
[muse-security]: https://research.meta.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse
