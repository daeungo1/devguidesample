---
title: "OpenAI dots 해부: 상시 동작 에이전트의 실행 환경과 행동 통제"
description: OpenAI dots의 제품 구성, 전용 클라우드 컴퓨터, proactive research, Auto-review와 행동 규칙, specialist dots를 공식 발표 기준으로 분석하고 Agent 서비스 설계 시사점을 정리합니다.
document_type: research
topic_order: 1
services: [application-development]
technologies: [computer-use]
tags: [design, secure, evaluate, ai-agents]
status: current
verification_status: verified
published_at: 2026-09-30
sources_checked_at: 2026-09-30
official_sources:
  - title: Introducing dots
    url: https://openai.com/index/introducing-dots/
  - title: How we build safety, security, and privacy into dots
    url: https://openai.com/index/how-we-build-safety-security-and-privacy-into-dots/
  - title: Overview of Microsoft Agent 365
    url: https://learn.microsoft.com/microsoft-agent-365/overview
---

# OpenAI dots 해부: 상시 동작 에이전트의 실행 환경과 행동 통제

**조사 기준일: 2026-09-30.** OpenAI는 2026-09-29에 [dots][dots]를 발표하면서
“remarkably capable, always-on agents built to handle everything”이라고
소개했다. 같은 날 공개한 [안전·보안·개인정보 설계 글][dots-safety]은 dots가
어떤 경계 안에서 일하는지를 비교적 자세히 설명한다. 이 문서는 두 공식 글을
근거로 dots의 구조를 해부한다.

## 질문

- dots는 기존 ChatGPT 대화나 단발성 에이전트 작업과 무엇이 다른가?
- 사용자가 자리를 비운 동안 일하는 에이전트를 OpenAI는 어떻게 통제하는가?
- 조직용 specialist dots는 기업 시스템과 어떻게 연결될 예정인가?
- Agent 서비스를 준비하는 입장에서 무엇을 가져와야 하는가?

## 조사 범위와 방법

- 조사 대상은 OpenAI의 발표 글과 안전 설계 글 두 편이다. 도움말 센터와
  system card는 링크만 확인했고 내용 분석에는 사용하지 않았다.
- 제품을 직접 실행하지 않았다. 아래 내용은 OpenAI가 공개한 설명이며, 성능과
  보안 효과를 독립적으로 검증한 결과가 아니다.
- Microsoft Agent 365에 관한 설명은 Microsoft Learn 원문으로 확인했다.

## dots 한눈에 보기

| 항목 | 공식 설명 |
|---|---|
| 정의 | 사용자에게 중요한 일을 파악하고, 사용자를 대신해 계속 일하는 always-on 에이전트 |
| 모델 | GPT-6 Astra |
| 실행 환경 | dot마다 자체 클라우드 컴퓨터와 브라우저. 여러 프로젝트를 동시에 진행 |
| 연결 | Plugin 생태계를 통해 4,000개가 넘는 앱에 연결 |
| 대화 채널 | ChatGPT(desktop, web, mobile)에서 메시지와 음성 통화, Slack과 Teams. 문자 메시지는 예정 |
| 학습 | 함께 일할수록 선호, 사고방식, 좋은 결과의 기준을 학습 |
| 사용자 기기 | 사용자가 허용하면 dot이 사용자의 노트북에 연결해 작업 가능 |
| 조직 기능 | 조직이 신원과 권한을 부여하는 specialist dots(preview, enterprise pilot) |

사용자는 기본(primary) dot을 만들고 이름을 붙인 뒤 앱을 연결한다. OpenAI는
장기적으로 **여러 dot이 팀으로 협업하는 모습**을 제시한다. dot은 채널을 넘어
맥락을 유지하므로 ChatGPT에서 시작한 프로젝트를 Slack의 팀 대화에서 이어 갈 수
있다.

### 공개된 사용 사례

| 역할 | dot이 하는 일 |
|---|---|
| 개발자 | 고객 피드백에서 반복 요청을 찾고, 작은 개선과 버그 수정을 구현·테스트해 변경 영상이 첨부된 PR로 가져온다 |
| 제품 출시 담당 | 범위가 바뀌면 메시지와 출시 자료를 수정하고, 자산과 문서 변경 초안을 준비한다 |
| 연구자 | 새 데이터가 들어오면 분석을 다시 실행하고, 예상 밖 결과를 조사해 그림과 설명을 갱신한다 |
| 영업 리드 | 고객 요구 사항을 제품 문서와 대조하고, 핵심 연동의 PoC를 만들며 제안서와 테스트 계획을 갱신한다 |
| 콘텐츠 제작자 | 인터뷰 원고에서 클립 후보, 쇼 노트, SNS 게시물 초안을 만들고 승인을 받는다 |

OpenAI 내부 사례로는 Slack에 버그가 올라오면 dot이 즉시 조사를 시작하는 흐름,
외부 테스터 사례로는 잊고 있던 청구서를 dot이 발견해 준비하고 **승인 후 발송**한
흐름을 소개한다. 공통점은 “사용자가 묻기 전에 일을 발견하고, 되돌리기 어려운
단계에서 사용자를 부른다”는 점이다.

## 기술 구조

### 모델 계층: GPT-6 Astra

OpenAI는 GPT-6 Astra가 사용자의 목표를 이해하고, 요청 범위 안에 머물며, 답에
따라 행동이 달라질 때 **초점이 좁은 질문을 던지도록** 학습했다고 설명한다.
생물학·사이버 보안 오용을 포함한 유해 요청을 거절하도록 학습했으며, 바뀌는
지시, 모호한 요청, 권한을 넘어서게 하려는 시도를 사람과 자동화된 red teaming으로
시험한다.

모델 계층은 출발점일 뿐이다. OpenAI는 그 위에 정보, 실행 환경, 행동 각각에
별도 보호 장치를 둔다.

### 실행 환경: dot마다 격리된 클라우드 컴퓨터

| 설계 요소 | 공식 설명 |
|---|---|
| 작업 공간 | dot마다 자체 클라우드 컴퓨터에서 브라우징, 분석, 파일 생성, 도구 실행 |
| 샌드박스 | 각 dot이 접근할 수 있는 코드와 도구를 제한해 유해 코드나 잘못된 명령의 영향을 억제 |
| 사용자 간 격리 | 사용자별 클라우드 환경을 서로 격리 |
| 운영 책임 | OpenAI가 기반 Linux 운영 체제와 Chrome 브라우저를 관리 |
| 통제 시스템 분리 | 코드 실행 환경은 작업을 조율하고 안전 장치를 집행하는 시스템과 분리. dot은 이 접근으로 안전 시스템을 바꾸거나 필수 검사를 끌 수 없음 |
| 사용자 기기 | 사용자가 컴퓨터를 연결해도 로컬 sandbox와 행동 검사가 계속 적용 |

사용자는 언제든 dot의 컴퓨터를 열어 작업을 확인할 수 있다. 다만 dot이 화면을
스크린샷 픽셀로 인식하는지, DOM 같은 구조로 인식하는지는 공개되지 않았다. 행동 방식
비교는 [개요 문서](../index.md)의 CUA 트렌드 섹션에서 다룬다. 가장 중요한 설계는
마지막에서 두 번째 행이다. **에이전트가 코드를 실행하는 곳과 에이전트를
감시하는 곳을 분리**했기 때문에, dot이 실수하거나 조작당해도 검사 장치 자체는
그대로 남는다.

### Secure sign-in: 비밀번호를 모델 밖에 두기

지원되는 로그인에서는 사용자가 보안 로그인 양식을 작성하는 동안 **모델을
일시 정지**한다. 입력한 자격 증명은 브라우저 환경으로 직접 전달되어 제출되며
모델 context에 노출되지 않는다. 저장된 비밀번호를 쓰는 흐름은 전용 암호화
credential service가 모델을 거치지 않고 비밀번호를 공급한다.

OpenAI는 한계도 명시한다. 이 보호는 secure sign-in과 저장된 비밀번호 흐름에만
적용되며, 사용자가 메시지나 문서에 따로 적은 비밀은 모델이 볼 수 있다.

### Proactive research: 읽기 전용 백그라운드 작업

사용자가 대화하지 않을 때도 dot은 도울 일을 찾는다. OpenAI는 이를 “proactive
research”라고 부르며 다음 제약을 **코드로 강제**한다고 설명한다.

- 각 dot의 클라우드 환경에서 백그라운드 작업으로 실행한다.
- 허용된 연결 원본에서 **읽기 전용 도구**로 정보를 모으고, 해당 dot만 보는
  비공개 메모를 남긴다.
- 다른 사람에게 메시지를 보내거나, 연결된 앱의 내용을 바꾸거나, 브라우저와
  데스크톱을 제어할 수 없다.
- 발견한 내용을 바탕으로 후속 행동을 하려면 일반 행동 규칙과 검사를 다시 거친다.

이 구조는 **발견과 실행을 분리**한다. 선제성은 에이전트의 가치이지만, 사용자가
보지 않는 시간에 쓰기 권한까지 갖게 하면 위험이 커진다. 읽기 전용 조사와 승인된
실행을 나눈 것이 이 문제에 대한 OpenAI의 답이다.

### 행동 규칙: 진행, 확인, 반환

dots는 행동을 세 등급으로 나눈다.

| 등급 | 예시 | 처리 방식 |
|---|---|---|
| 진행 가능 | 권한이 있는 정보 읽기, 분석, 대화 안의 초안 작성 | 앱 권한과 도구 제한 안에서 진행 |
| 매번 확인 | 데이터 영구 삭제, 출처를 알 수 없는 소프트웨어 설치·실행, 새로운 보안 민감 권한 부여 | 할 때마다 사용자 확인 후 진행 |
| 사용자에게 반환 | 비밀번호 변경, 금융 계좌 간 이체 | 주변 작업은 돕되 해당 단계는 사용자가 직접 수행 |

dot은 가맹점 웹 사이트에 이미 저장된 카드로 구매할 수 있으며, 이런 구매에는
사용자 승인이 필요하다.

메시지 전송이나 파일 공유는 **정보의 민감도에 따라 수신자 지정의 구체성**을
다르게 요구한다. 예를 들어 건강 정보는 항상 이름으로 지정한 수신자가 필요하다.
이메일 주소나 전화번호처럼 덜 민감한 개인정보는 기본적으로 “항공사”처럼
수신자 범주를 지정해야 하고, Custom Rule로 범위를 넓힐 수 있다. 이렇게 받은
권한은 해당 작업 지시에 묶이며, 나중에 이어서 작업하거나 다른 에이전트에 위임해도
넓어지지 않는다.

### Custom Rules

Custom Rules는 사용자가 특정 행동을 허용하거나, 승인을 요구하거나, 차단하는
규칙이다. “이메일은 절대 보내지 않는다” 같은 규칙이나 “동료에게 부재를 알리되
개인 사유는 공유하지 않는다” 같은 작업별 지시를 줄 수 있으며, 위임 작업과
백그라운드 작업에도 계속 적용된다. dot이 규칙 작성을 도울 수 있지만 변경에는
사용자 승인이 필요하다. Custom Rules는 **필수 확인, 반환 단계, 핵심 안전 요구
사항을 제거할 수 없다**.

### Auto-review: 행동 전에 동작하는 별도 검사

이메일 전송이나 파일 변경 같은 행동 전에, **Auto-review라는 별도 안전 시스템**이
계획된 단계를 사용자 지시, Custom Rules, 안전 요구 사항과 대조한다. 이메일이라면
수신자와 본문을 확인해 잘못된 주소나 의도하지 않은 정보 공유를 잡아낸다.

```text
dot이 행동 제안
   │
   ▼
Auto-review ── 허용 ──▶ dot이 해당 컴퓨터·앱 도구로 실행 ──▶ 결과로 작업 계속
   │
   └─ 차단 ──▶ 이유를 dot에 반환
                 ├─ 추가 정보나 사용자 승인을 받아 다시 제출
                 ├─ 허용되는 다른 방법 시도
                 ├─ 민감한 단계를 사용자에게 반환
                 └─ 중단
```

Auto-review를 집행하는 통제 장치는 dot이 바꿀 수 있는 환경 **밖에** 있다. 이미
받은 승인이 해당 행동을 포함하고 규칙상 새 확인이 필요 없으면 기존 승인을 사용할
수 있다. 일반적인 읽기 전용 단계는 앱 권한과 도구 제한을 따르되 이 추가 검토는
생략한다. 사용자 승인으로도 핵심 안전 요구 사항은 무시할 수 없다.

### Prompt injection 방어와 모니터링

웹 페이지, 이메일, 문서에 숨은 악성 지시가 dot의 방향을 바꾸거나 개인정보를
유출하게 만들 수 있다. OpenAI는 모델 안전 장치, 도구 제한, 행동 전 검사,
모니터링을 조합해 이런 콘텐츠가 원치 않는 행동으로 이어지지 않도록 한다고
설명한다. 모니터링은 dot이 계획하고 실행하는 동안 지시 범위를 벗어나거나
안전 장치를 우회하려는 행동을 찾고, 문제가 감지되면 **작업을 일시 정지하고
경고를 표시**한다.

### 투명성, 기억, 데이터 처리

- 데스크톱 앱의 Activity View는 진행 중이거나 위임된 작업과 상태를 보여 준다.
  사용자는 맥락을 추가하고, 오해를 바로잡고, 방향을 바꾸거나 중단시킬 수 있다.
- 앱 연결과 권한은 ChatGPT, ChatGPT Work, Codex가 공유하는 기존 설정에서
  관리한다. 연결을 끊으면 새로운 정보 공유는 멈추지만, dot이 이미 알게 된
  정보는 자체 context에 남는다.
- dot마다 자체 context가 있고 사용자가 언제든 초기화할 수 있다. 작업을
  위임받은 다른 에이전트는 필요한 정보만 유지하고 불필요한 민감 정보를
  보관하지 않도록 지시받는다.
- ChatGPT Business, Enterprise, Edu 워크스페이스의 콘텐츠는 기본적으로 모델
  학습에 쓰지 않는다. 개인 요금제는 사용자가 설정으로 제어한다.
- proactive research 스레드와 메모는 직접 학습하지 않는다. 다만 그 내용이
  적격한 대화나 작업에 들어오면 설정에 따라 학습에 쓰일 수 있다.

## Specialist dots와 Microsoft Agent 365

사용자의 dot이 **개인을 대신**해 일한다면, specialist dots는 **조직 안의 전담
책임**을 맡는다. OpenAI가 공개한 구성은 다음과 같다.

- 조직이 각 dot에 고유한 신원, 자격 증명, 필요한 시스템 접근 권한을 부여한다.
- 접근 관리를 위한 자체 신원, IT가 배포한 하드웨어, 기업 기록 시스템(system
  of record)과의 깊은 연동을 지원한다.
- OpenAI 내부에서 구매, 청구서 처리, 이메일 마케팅, 고객 지원, 상업 계약 영역의
  초기 테스트 경험을 바탕으로 한다.
- 우선 집중된 enterprise pilot으로 시작하며, OpenAI 엔지니어가 조직과 함께 dot의
  책임, 사용할 도구, 사람의 검토·승인 방식을 정의한다.

OpenAI는 또 specialist dots를 **Microsoft Agent 365**의 엔터프라이즈 거버넌스·보안
통제와 통합하기 위해 Microsoft와 협력 중이라고 밝혔다. 목표는 기업이 이미 쓰는
Microsoft 도구로 dots를 관리하게 하는 것이다. 이는 발표 시점의 **계획**이며, 통합의
구체적인 범위와 일정은 기준일 현재 공개되지 않았다.

[Microsoft Agent 365][agent-365]는 조직의 에이전트를 관찰(observe), 통제(govern),
보호(secure)하는 관리 계층이다. Microsoft Learn 기준으로 확인한 범위는 다음과 같다.

| 기둥 | Microsoft Learn에서 확인한 내용 |
|---|---|
| Observe | 모든 에이전트를 하나의 중앙 registry에서 보고, 채택·활동·상태를 파악 |
| Govern | Microsoft 365 관리 센터의 Agent 365 registry, Microsoft Entra, Microsoft Purview로 수명 주기·접근 제어·규정 준수를 중앙 관리 |
| Secure | Entra의 위험 기반 접근 제어, Purview의 정보 보호·DLP, Defender의 위협 탐지를 에이전트로 확장 |
| 제공 상태 | 2026-05-01부터 Commercial 세그먼트에 사용자 단위로 일반 공급(GA) |

specialist dots가 조직의 신원과 자격 증명을 받는다는 점은, 에이전트를 사람
계정의 부속물이 아닌 **독립적으로 관리되는 비인간 신원**으로 다루는 흐름과
맞닿아 있다. 이 관점은 [Azure 매핑 문서](../azure-readiness/index.md)에서 Entra
Agent ID와 함께 다시 다룬다.

## 제공 범위와 사용량

- 2026-09-29부터 eligible markets의 ChatGPT Pro와 Business Premium 사용자에게
  순차 제공한다.
- Enterprise 사용자(Edu, Healthcare 포함)는 워크스페이스 관리자가 활성화하면
  beta를 사용할 수 있다.
- 첫 dot은 Pro와 Business Premium 요금제에 추가 비용 없이 포함된다. 요금제에는
  더 깊은 작업을 위한 사용량이 포함되며 출시 후 첫 달은 한도를 늘려 준다.
- dot과의 대화는 ChatGPT 사용량 한도에 포함되지 않는다. dot이 Codex나 ChatGPT
  Work에서 시작·관리하는 작업은 평소처럼 사용량에 포함된다.
- 첫 dot은 ChatGPT desktop 앱이나 desktop 브라우저에서 만들고, 초기 설정 후
  mobile 앱에서 메시지를 주고받을 수 있다.
- OpenAI는 앞으로 dot을 추가하거나, 각 dot의 속도나 월간 작업량을 늘리는
  방식으로 확장할 계획이라고 밝혔다.

## Agent 서비스 설계 시사점

| dots의 설계 | 우리 서비스에 옮길 원칙 |
|---|---|
| 코드 실행 환경과 안전 시스템 분리 | 에이전트 컨테이너가 승인 로직, 정책 파일, 감사 기록을 수정할 수 없도록 배치한다 |
| Auto-review가 차단 이유를 반환 | 차단을 오류가 아니라 에이전트가 처리할 수 있는 구조화된 응답으로 설계한다 |
| 진행·확인·반환 세 등급 | 도구마다 위험 등급을 정하고, 일부 행동은 승인이 있어도 에이전트가 수행하지 않게 한다 |
| 민감도별 수신자 지정 규칙 | 데이터 분류와 공유 대상 범위를 정책 입력으로 사용한다 |
| 읽기 전용 proactive research | 백그라운드 작업은 읽기 권한만 가진 별도 실행 경로로 분리한다 |
| 위임해도 권한이 넓어지지 않음 | sub-agent에 전달하는 권한을 원래 작업 지시 범위로 제한한다 |
| Activity View와 context 초기화 | 사용자가 진행 상황을 보고, 방향을 바꾸고, 기억을 지울 수 있는 UI를 제공한다 |

## 한계

- 모든 설명은 OpenAI가 공개한 제품·안전 설계 주장이다. Auto-review의 정확도,
  prompt injection 방어 효과, GPT-6 Astra의 성능은 이 리서치에서 검증하지 않았다.
- eligible markets 목록과 도움말 센터의 세부 정책은 분석에 포함하지 않았다.
- Microsoft Agent 365와의 통합은 발표 시점의 계획이므로, 실제 제공 여부와 방식은
  별도로 확인해야 한다.

## 공식 출처

| 출처 | 이 페이지에서 사용한 범위 |
|---|---|
| [Introducing dots][dots] | 제품 정의, 모델, 채널, 사용 사례, specialist dots, Agent 365 협력 계획, 제공 범위 |
| [How we build safety, security, and privacy into dots][dots-safety] | 실행 환경 격리, secure sign-in, proactive research, 행동 규칙, Custom Rules, Auto-review, 데이터 처리 |
| [Overview of Microsoft Agent 365][agent-365] | Agent 365의 observe, govern, secure 범위와 GA 시점 |

[dots]: https://openai.com/index/introducing-dots/
[dots-safety]: https://openai.com/index/how-we-build-safety-security-and-privacy-into-dots/
[agent-365]: https://learn.microsoft.com/microsoft-agent-365/overview
