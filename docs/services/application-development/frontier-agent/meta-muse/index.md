---
title: "Meta Muse 해부: Secure VM, Sentinel, tainted egress로 만든 개인 에이전트"
description: Meta Muse의 제품 설계와 Muse Secure VM 내부 격리, Sentinel 기반 행동·egress 통제, 자격 증명 대리, 브라우저와 결제 보호를 공식 자료 기준으로 분석합니다.
document_type: research
topic_order: 2
services: [application-development]
technologies: [computer-use]
tags: [design, secure, evaluate, ai-agents]
status: current
verification_status: verified
published_at: 2026-09-30
sources_checked_at: 2026-09-30
official_sources:
  - title: "Muse: Meta's personal AI agent, features & capabilities"
    url: https://ai.meta.com/muse/
  - title: How We Designed Muse
    url: https://introducing.muse.ai/
  - title: How We Built Safety Into Muse
    url: https://research.meta.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse
  - title: Prompt Shields in Microsoft Foundry
    url: https://learn.microsoft.com/azure/foundry/openai/concepts/content-filter-prompt-shields
---

# Meta Muse 해부: Secure VM, Sentinel, tainted egress로 만든 개인 에이전트

**조사 기준일: 2026-09-30.** Meta는 2026-09-08에 개인 AI 에이전트
[Muse][muse]를 출시했다. 제품 페이지의 문구는 “AI that gets it done”이다. Meta는
제품 설계 결정을 설명한 [How We Designed Muse][muse-design]와, 시스템 내부 보안
구조를 설명한 [How We Built Safety Into Muse][muse-security]를 함께 공개했다.
특히 두 번째 글은 VM 내부의 프로세스 격리, 네트워크 통제, 커널 수준 데이터 흐름
추적까지 다룬다. 공개된 개인 에이전트 설계 가운데 가장 구체적인 편이다.

## 질문

- Muse는 사용자와 어떻게 상호작용하도록 설계되었는가?
- 셸과 브라우저, 이메일을 가진 에이전트를 Meta는 어떤 격리 구조로 감싸는가?
- 모델이 prompt injection에 속았을 때 피해를 어디서 막는가?
- Agent 서비스 설계에 그대로 옮길 수 있는 패턴은 무엇인가?

## 조사 범위와 방법

- Meta의 제품 페이지, 제품 설계 글, 보안 설계 글 세 편을 전문으로 확인했다.
- 제품을 직접 실행하거나 보안 주장을 시험하지 않았다. 아래 수치와 구조는 Meta가
  출시 시점의 시스템을 설명한 내용이다.
- Microsoft 제품과의 비교는 Prompt Shields 원문으로 확인한 범위에 한정한다.

## Muse 한눈에 보기

| 항목 | 공식 설명 |
|---|---|
| 정의 | 질문에 답하는 데서 그치지 않고 사용자를 대신해 행동하는 personal AI agent |
| 채널 | Muse 앱(모바일, Mac), WhatsApp. 보안 글 기준 클라이언트는 iOS·Android 앱과 web UI |
| 실행 환경 | Muse Secure VM: 사용자와 에이전트가 함께 쓰는 persistent, isolated Linux 컴퓨터와 전체 브라우저 |
| 목표 관리 | 목표나 작업을 받으면 실행 계획을 세우고 진행을 추적하며 선제적으로 처리 |
| 연결 | 이메일, 캘린더, Instagram 등 앱 연결. 필요한 도구가 없으면 직접 작성 |
| 결과물 | 문서, PDF, 웹 페이지, 대시보드 같은 대화형 결과물(Artifacts) |
| 요금 | 사용량 한도가 있는 무료 제공, 한도 이후 유료 구독 또는 한도 갱신 대기 |
| 확장 | Muse for Small Business: 소상공인을 위한 skill과 connector 모음 |
| 모델 | Muse Spark 1.3 |

## 제품 설계 결정

### 한 번에 한 턴이 아닌 하나의 긴 대화

Muse는 사람과 대화하듯 **하나의 긴 메인 대화**를 기본으로 한다. 응답을 기다리지
않고 끼어들거나 여러 작업을 한꺼번에 보낼 수 있다. memory는 대화를 넘어 유지된다.
프로젝트가 복잡해지자 주제별로 맥락을 나누려는 요구가 생겨 side chat을 추가했다.

선제 메시지는 **보낼 가치가 있을 때만** 보낸다. 백그라운드 작업이 끝나면 결과를
보여 줄 가치가 있는지 평가하고, 의미 있게 새롭거나 사용자의 입력이 필요할 때만
알린다. 사용자는 선제 메시지를 끄거나 빈도를 조절할 수 있다. 메시지가 순서 없이
도착하므로 생각의 경계를 드러내는 말풍선 UI를 택했다.

### 보이지 않는 작업을 보이게

| 화면 요소 | 역할 |
|---|---|
| 아바타 아래 작업 요약 | 지금 무엇을 하고 있는지 한 줄로 표시 |
| 활동 로그 | 아바타를 누르면 전체 활동과 승인한 권한을 확인 |
| Memory 파일 | 사용자가 직접 읽고 편집 |
| Goals 탭 | Muse가 추적하는 목표와 계획을 한곳에서 확인·조작 |
| Ideas 탭 | 목표·패턴·대화를 바탕으로 Muse가 할 수 있는 일을 제안 |

### 대화로 처리하지 않는 영역

Meta는 **결정적 UI가 반드시 필요한 곳**을 명확히 나눴다. 명확한 수락·거부 버튼이
있는 구조화된 승인 카드, 그리고 자격 증명을 위한 보안 저장소다. 승인 피로(banner
blindness)를 줄이기 위해 기본값은 일반 웹 브라우징을 허용하고, **되돌리기 어려운
행동에서만 멈추도록** 했다. 사용자는 이 기본값을 더 보수적으로 또는 더 느슨하게
바꿀 수 있다.

## 기술 아키텍처

### 설계 전제: 에이전트가 공격받고 있다고 가정

Meta는 모델을 도구 호출(CLI와 skill 기반 zero-shot), 긴 context, prompt injection을
인식하며 긴 궤적의 지시를 따르는 능력, 다중 에이전트 협업에 초점을 맞춰 학습했다고
설명한다. 동시에 모델이 아무리 강해도 실수하고 공격받는다고 전제한다. 그래서
시스템을 다음 세 가지로 설계했다.

1. 에이전트 harness는 자체 격리 cell에서 실행한다.
2. 에이전트는 실제 자격 증명을 보지 못한다.
3. 외부 세계와의 모든 상호작용은 에이전트가 무시할 수 없는 Sentinel을 거친다.

### 사용자별 전용 VM

사용자와 Muse는 클라우드의 전용 컴퓨터를 공유한다. 각 VM은 브라우저와 충분한
저장소·CPU·메모리를 갖춘 격리된 Linux 환경으로, 에이전트가 작성한 코드의
컴파일, custom skill 개발, 동시 실행되는 sub-agent와 cron 작업을 처리한다.

- 전용 VM이 사용자가 Muse에 넣은 모든 것의 **system of record**다. 추론과
  telemetry에 필요한 제한된 데이터만 VM 밖으로 나간다.
- 클라이언트(iOS·Android 앱, web UI)는 보안 전송 계층으로 VM에 직접 연결한다.
- 기본 connector마다 서비스 제공자와 API 연동을 함께 만들고, 각 connector를 잘
  쓰는 방법을 담은 SKILL(상세 지침)을 작성했다. Muse는 API나 CLI가 있는 다른
  서비스용 connector를 직접 작성할 수도 있다.

### 한 VM 안의 두 보안 도메인

Meta가 제시하는 핵심 비유는 “root 권한을 가진 LLM 에이전트”가 아니라 **한 대의
머신 위에 있는 두 개의 격리된 보안 도메인**이다.

```text
Muse Secure VM
├── Runtime cell (systemd-nspawn, 비신뢰 데이터를 처리한다고 가정)
│   ├── Hatch daemon: 핵심 agent harness (Hatch는 코드베이스 내부 이름)
│   ├── 사용자 작업 공간과 파일
│   └── Muse가 사용자 대신 실행하는 바이너리와 도구
│
└── 호스트 쪽 보안 서비스 (별도 systemd unit)
    ├── hatch-safety : 추론 요청·응답을 검사하는 독립 모델·분류기
    ├── privsep workers : 기본 connector 로직을 좁은 권한으로 실행
    ├── hatch-authd : 자격 증명 저장(OAuth 토큰 포함)과 대리(surrogation)
    ├── Sentinel : connector 행동과 네트워크 egress의 유일한 허가 주체
    ├── postgres : runtime cell·자격 증명 저장소와 분리된 영속 상태
    └── 추론·telemetry proxy : 외부 인프라로 가는 제한된 경로
```

| 계층 | 격리 방식 |
|---|---|
| 실행 cell | systemd-nspawn 컨테이너. cell 안의 root는 호스트의 비특권 사용자로 매핑 |
| 파일 시스템 | 전체 Debian 이미지를 포함한 별도 root 파일 시스템. 민감한 데이터가 있는 호스트 파일 시스템과 분리 |
| 네트워크 | 가상 네트워크 인터페이스 |
| 시스템 호출 | 필터링(예: io_uring 금지) |
| 커널 capability | 제한(예: CAP_SYS_PTRACE, CAP_NET_ADMIN 없음) |
| 프로세스 간 통신 | SO_PEERCRED와 peer ACL을 적용한 Unix domain socket. 커널이 인증하는 최소 권한 IPC로, 훔칠 비밀이 없음 |
| 자격 증명 위치 | 서드파티 OAuth 토큰도 중앙 Meta 인프라가 아니라 사용자 VM에 저장 |

보안 서비스를 cell 밖에 두는 이유는 명확하다. cell은 비신뢰 데이터를 처리하므로
공격자가 cell을 장악해도 **안전 분류기와 허가 주체를 끌 수 없어야** 한다.

### Sentinel: 제안은 Muse가, 허가는 Sentinel이

Sentinel은 Muse와 별개인 호스트 쪽 에이전트다. Muse는 행동을 제안할 뿐이고, 허가는
Sentinel만 할 수 있다.

**Connector 행동.** Muse가 connector로 행동하려 하면 cell 안의 connector 도구가
Sentinel에 요청을 보낸다. 요청에는 connector, 호출할 메서드, 행동의 분류, 범위,
사용자가 요청한 맥락이 담긴다. Sentinel은 이를 바탕으로 사용자가 볼 수 있는 목적
설명을 만들고, 사용자가 설정한 connector 정책을 평가해 **허용, 거부, 사용자 확인**
중 하나를 결정한다.

**네트워크 egress.** cell의 모든 네트워크 요청은 Linux 네트워킹 통제(user
namespace, veth 경계, eBPF 필터링)로 구성한 forward proxy를 거쳐 Sentinel에
도달한다. Sentinel은 L4와 L7에서 호스트 이름, DNS 해석 결과와 최종 목적지 IP,
포트, 프로토콜, HTTP 메서드, 경로, 디코딩한 요청 본문을 평가한다. DNS 조회 후
공개 호스트 이름이 사설 인프라로 해석되는 SSRF도 차단한다.

**Just-in-time 자격 증명 삽입.** cell이나 worker의 코드는 authd가 발급한
**surrogate token**만 본다. 구체적인 네트워크 요청이 허가되면 Sentinel이 네트워크
경계에서 surrogate를 authd에서 받은 실제 자격 증명으로 바꾼다. 에이전트가 실제
토큰을 본 적이 없으므로 prompt injection으로 비밀을 빼내려는 시도는 성립하지 않는다.

### Tainted egress: 승인 피로를 줄이는 데이터 흐름 추적

모든 요청마다 사용자에게 묻는다면 승인은 곧 무의미해진다. Muse는 이를 **커널 수준
데이터 흐름 추적**으로 푼다.

1. 각 도구 실행 프로세스는 깨끗한(clean) 상태로 시작한다.
2. 사용자 데이터를 읽으면 그 프로세스는 오염(tainted) 상태가 된다.
3. 깨끗한 프로세스의 요청이 좁게 정의한 자동 허용 정책에 맞고 URL 검사도
   통과하면 사용자에게 묻지 않고 내보낸다.
4. 오염되었거나 상태를 확인할 수 없는 프로세스는 자동 허용을 잃고 일반 승인
   흐름으로 돌아간다.

구현에는 네트워크 가로채기와 프로세스 귀속을 위한 eBPF cgroup 프로그램, 그리고
Meta가 추가한 Linux Security Module hook에 연결한 eBPF 프로그램(오염 전파용)을
사용한다.

### Human in the loop: 승인은 대화가 아니라 capability

Sentinel의 결정이 “사용자 확인”이면 대기 중인 승인이 만들어지고 실행이 멈춘다.
Sentinel은 승인 요청을 **Muse와의 대화가 아니라 클라이언트 UI로 직접** 보내고,
사용자의 답도 Sentinel로 직접 돌아간다. 모델이 승인 대화를 흉내 내거나 조작할 수
없는 구조다.

승인은 대화 속 제안이 아니라 **엄격한 capability**다. 특정 connector나 목적지,
사용 사례에 묶이며, 일회성, 세션 범위, 작업 범위, 기간 제한, 영구 권한 중에서
Sentinel이 제시한 유형을 사용자가 고른다. 이후 호출은 승인한 범위와 정확히
일치해야 한다. 읽기 전용, 이전에 허용한 행동, 위험이 낮음이 입증된 행동은 방해
없이 진행한다.

### 최소 권한

- 서비스가 지원하면 읽기와 쓰기 접근을 분리한다. 사용자는 보통 읽기 권한부터
  주고, 시스템을 신뢰하게 된 뒤 쓰기 권한을 준다.
- OAuth scope보다 세밀하게 제어한다. 예를 들어 Gmail 읽기 scope에 딸려 오는
  Gmail 설정 접근 권한을 따로 제거할 수 있다. connector, 프로세스, 자격 증명,
  요청 수준에서 추가 통제를 적용한다.
- 기본 connector의 CLI는 cell 안에서 인수만 파싱하고, 호출자가 이미 접근할 수
  있는 파일을 연 뒤 형식이 정해진 인수와 파일 디스크립터를 Unix socket으로
  넘긴다. 실제 비즈니스 로직은 systemd sandbox의 worker가 실행한다.
- 각 worker는 cgroup으로 식별되고 명시적인 자격 증명 허용 목록을 가진다. 캘린더
  worker가 요청 매개변수를 바꿔 이메일 자격 증명을 얻을 수 없다.
- 브라우저의 Chrome DevTools Protocol(CDP) 접근은 cell 밖 broker가 맡고, 브라우저
  에이전트는 좁게 통제된 인터페이스만 쓴다.
- 이메일 connector는 일회용 인증 코드, 비밀번호 재설정 링크, 로그인 magic link를
  결정적 필터와 분류 모델로 걸러 낸다. 이메일 계정 연결이 다른 사이트에서 사용자를
  사칭하는 통로가 되지 않게 하기 위해서다.

| 구성 요소 | 결정하는 것 |
|---|---|
| privsep | 자격 증명을 다룰 수 있는 코드가 **어디서** 실행되는가 |
| authd | 인증된 호출자가 **어떤** 자격 증명을 받을 수 있는가 |
| Sentinel | 요청한 행동을 **해도 되는가** |

### Prompt injection에 대한 심층 방어

Meta는 Simon Willison이 정리한 “lethal trifecta”, 즉 개인 데이터 접근, 비신뢰
콘텐츠 노출, 외부 통신 능력이 한 에이전트에 모이면 데이터 유출이 쉬워진다는 문제를
출발점으로 삼는다. 방어는 여러 층으로 나뉜다.

| 층 | 방식 |
|---|---|
| 모델 | prompt injection을 인식하고 저항하도록 학습하고 전용 평가로 추적 |
| Harness | 외부에서 context로 들어오는 데이터에 비신뢰 입력 표시. 개발자 지시를 더 강하게 따르는 모델 능력과 결합 |
| 분류기 앙상블 | 실제 데이터와 대규모 agentic red teaming으로 학습한 여러 탐지기를 파일·도구 호출로 들어오는 모든 외부 데이터에 병렬 적용. 모델과 독립적으로 학습 |
| 사람 승인 | VM 밖으로 데이터를 옮기는 행동은 승인 |
| 결정적 경계 | runtime cell, privsep, authd ACL, Sentinel은 Muse가 설득당해도 그대로 적용 |

Azure에서 비슷한 층을 구성한다면 [Prompt Shields][prompt-shields]가 분류기 층에
대응한다. Microsoft Learn 기준으로 Prompt Shields는 사용자 프롬프트 공격과, 문서·
이메일·웹 페이지 같은 제3자 콘텐츠에 숨은 지시인 **document attack**을 탐지한다.
Foundry에서는 document attack을 **사용자 입력과 도구 응답** 두 개입 지점에서
검사하며, guardrail로 모델 배포나 에이전트에 적용한다. 다만 Muse 구조가 보여 주듯
분류기는 한 층일 뿐이며, 분류기를 통과한 공격도 막을 결정적 경계가 따로 필요하다.

### 브라우저

- 가상화 계층 뒤에서 최신 Chromium 기반 브라우저가 동작한다. 사용자는 Muse가
  브라우저에서 하는 일을 보고 언제든 제어를 넘겨받을 수 있다.
- 웹 사이트 로그인 정보는 클라이언트의 전용 UI로 받아 authd로 직접 보내고,
  cell 밖 보안 저장소에 둔다. 필요한 순간에만 브라우저 창에 주입한다.
- 작업마다 전용 **브라우저 sub-agent**를 쓴다. sub-agent는 원시 DOM이 아닌
  **accessibility tree snapshot**만 본다. 페이지에서 JavaScript를 실행할 수 없고,
  브라우저 프로세스에서 명령을 실행할 수 없으며, DevTools도 비활성화되어 있다.
  스크린샷 픽셀을 보고 마우스·키보드를 움직이는 CUA라기보다 **구조 기반 브라우저
  자동화**에 가깝고, 에이전트가 관찰할 수 있는 정보 자체를 좁힌 설계다. 행동 방식
  비교는 [개요 문서](../index.md)의 CUA 트렌드 섹션에서 다룬다.
- 사용자가 브라우저를 넘겨받았거나 보안 저장소가 양식을 채우는 동안 에이전트는
  일시 정지되어 아무 행동도 할 수 없다.
- 별도 분류기군이 작업과 무관한 개인정보 유출, DOM 속 prompt injection,
  이미지·미디어 속 prompt injection, 다운로드한 파일 속 prompt injection, 고위험
  양식 제출 시도를 감시하고, 위협에 따라 차단하거나 사용자 검토를 요청한다.
- Meta 서비스에서 이미 쓰는 악성 사이트 목록을 사용자 VM 안에서 대조해 알려진
  유해 사이트로의 이동을 막는다.

### 결제

- 결제 정보가 저장된 사이트에서는 결제 페이지를 감지해 **매번** 정확한 구매
  내역으로 사람의 승인을 받는다.
- 처음 쓰는 사이트를 위해 결제 정보를 저장하는 wallet이 있다. 출시 시점 파트너는
  Stripe Link이며 Shop Pay는 예정이다.
- 결제할 때마다 **일회용 카드 번호**를 발급해 가맹점에 전달한다. 이 번호는 특정
  가맹점, 특정 금액, 제한된 기간에만 유효하므로 탈취되어도 공격자에게 쓸모가 적다.
- 제품 페이지는 적격 구매가 Link의 구매 보호를 받는다고 설명한다.

### 검증 방식과 향후 계획

- 지속적인 agentic red teaming으로 오프라인 평가 세트를 만들었고, 출시 전에는
  비공개 bug bounty를 운영했다. 출시와 함께 bug bounty를 누구에게나 공개했으며
  유효한 보고에 최대 30만 달러, 한 사용자에게 영향을 주는 prompt injection 성공
  사례에 최대 13만 달러를 지급한다.
- 현재 구조는 사용자 간 데이터를 격리하고, 운영 정책으로 Meta 직원의 접근을
  제한한다. Meta는 이것이 서비스 지원·보안·운영에 필요할 때 Meta의 접근을 막지는
  않는다고 명시한다.
- 연내 제공을 목표로 **Muse Confidential VM**을 개발 중이다. VM 안의 데이터에
  Meta가 접근하지 못하도록 암호학적으로, 검증 가능하게 막는 것이 목표이며 외부
  감사인에게 설계와 소스 코드를 공개하기 시작했다.

### 데이터 정책

- VM에 넣은 파일과 Muse가 생성·사용한 모든 것은 VM에 저장되며, Muse의 사용자
  memory를 포함해 자유롭게 확인·편집·다운로드할 수 있다.
- 자격 증명과 인증 토큰은 VM 안의 별도 격리 컨테이너에 두며 다른 Meta 서비스에
  저장하지 않는다. VM 데이터는 복원을 위해 지속적으로 백업한다.
- 대화와 VM 데이터를 Meta 광고 시스템과 공유하지 않는다. 다만 Muse의 웹 방문은
  사용자의 활동으로 보이므로, 방문한 사이트가 이를 광고에 활용하는 식의 간접
  영향은 있을 수 있다.
- 대화, 도구 호출, sub-agent 인계를 포함한 추론 궤적(trajectory)은 주요 개인
  식별 정보를 제거한 뒤 기본적으로 모델 학습에 사용한다. 설정에서 끌 수 있다.

## Agent 서비스 설계 시사점

| Muse의 설계 | 우리 서비스에 옮길 원칙 |
|---|---|
| runtime cell과 보안 서비스 분리 | 에이전트 코드와 정책·자격 증명·감사 서비스를 다른 신뢰 경계에 배치한다 |
| Sentinel이 유일한 허가 주체 | 도구 호출과 egress를 한 곳의 정책 결정 지점으로 모은다 |
| surrogate token과 경계에서의 교체 | 에이전트에는 실제 비밀 대신 짧은 수명의 참조나 대리 토큰만 준다 |
| tainted egress | 사용자 데이터를 읽은 실행 경로와 그렇지 않은 경로의 승인 정책을 다르게 한다 |
| 대화 밖 승인 UI | 승인 요청과 응답은 모델을 거치지 않는 채널로 주고받는다 |
| capability 형태의 승인 | 승인에 대상, 범위, 기간을 붙여 저장하고 이후 호출과 정확히 대조한다 |
| accessibility tree만 보는 브라우저 에이전트 | 에이전트에 주는 관찰 수단 자체를 좁혀 공격 표면을 줄인다 |
| 일회용 결제 수단 | 탈취되어도 재사용할 수 없는 자격 증명을 우선한다 |

## 한계

- 모든 설명은 Meta가 공개한 출시 시점의 설계다. Meta도 prompt injection이 업계의
  미해결 문제이며 Muse가 실수할 수 있다고 밝힌다.
- 분류기 정확도, tainted egress의 오탐·미탐, Confidential VM의 실제 보장 범위는
  이 리서치에서 검증하지 않았다.
- 요금 체계의 세부 한도와 제공 국가는 공식 페이지에 구체적으로 나와 있지 않아
  다루지 않았다.

## 공식 출처

| 출처 | 이 페이지에서 사용한 범위 |
|---|---|
| [Muse 제품 페이지][muse] | 기능 개요, Muse Secure VM, 요금 방식, 승인과 감사 추적, 결제 보호 |
| [How We Designed Muse][muse-design] | 대화 설계, 선제 메시지, 투명성 UI, 결정적 UI, Artifacts |
| [How We Built Safety Into Muse][muse-security] | 모델 학습 초점, VM 구조, Sentinel, tainted egress, 브라우저, 결제, bug bounty, 데이터 정책 |
| [Prompt Shields in Microsoft Foundry][prompt-shields] | Azure에서 대응하는 prompt injection 탐지 계층과 개입 지점 |

[muse]: https://ai.meta.com/muse/
[muse-design]: https://introducing.muse.ai/
[muse-security]: https://research.meta.ai/blog/security-and-safety-for-ai-agents-our-approach-with-muse
[prompt-shields]: https://learn.microsoft.com/azure/foundry/openai/concepts/content-filter-prompt-shields
