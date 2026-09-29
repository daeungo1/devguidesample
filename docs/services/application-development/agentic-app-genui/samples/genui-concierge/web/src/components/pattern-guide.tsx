"use client";

import { useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import { useState, type ReactNode } from "react";

export interface PatternStage {
  step: number;
  key: "controlled" | "declarative" | "mcp-apps" | "fully-open";
  name: string;
  scenario: string;
  modelDecides: string;
  appOwns: string;
  api: string;
  prompt: string;
  /** Extra sample questions that produce different component or block combinations. */
  more?: string[];
}

export const PRODUCTION_STAGES: PatternStage[] = [
  {
    step: 1,
    key: "controlled",
    name: "Controlled",
    scenario: "스마트폰 비교 · 제품 상세 · 디자인 시스템 컴포넌트 2종",
    modelDecides: "어떤 컴포넌트를, 어떤 제품 ID로",
    appOwns: "화면 구조 · 디자인 · 가격·재고",
    api: "useComponent ×2",
    prompt: "사진을 많이 찍는데 X Ultra, X Fold, X Lite 중 뭐가 나을까? 비교해 줘",
    more: [
      "업무용으로 큰 화면이 필요해. X Fold와 X Ultra를 비교해 줘",
      "부모님 선물용으로 150만원 이하 스마트폰을 비교해 줘",
      "한 손에 들어오는 가벼운 X Pro가 궁금해. 자세히 보여 줘",
      "독일 지역 기준으로 살 수 있는 폴더블 폰을 비교해 줘",
    ],
  },
  {
    step: 2,
    key: "declarative",
    name: "Declarative × Controlled 블록",
    scenario: "신혼집 가전 번들 · 카탈로그 조합",
    modelDecides: "승인된 블록의 조합과 배치",
    appOwns: "블록 구현 · 계약 버전 · 제품 사실 · 합계",
    api: "A2UI catalog",
    prompt: "4인 가족, 30평 신혼집이야. TV·냉장고·세탁기·건조기로 가전 번들을 구성해 줘",
    more: [
      "원룸에 혼자 입주해. 예산 300만원으로 TV·냉장고·세탁기를 구성해 줘",
      "장마와 여름에 대비해 거실 에어컨, 제습기, 공기청정기를 묶어 줘",
      "재택근무용 서재를 꾸미려고 해. 모니터로 쓸 TV와 업무용 스마트폰을 함께 구성해 줘",
      "부모님 댁 가전을 에너지 1등급 위주로 바꾸고 싶어. 냉장고·세탁기·건조기에 로봇청소기까지 구성해 줘",
    ],
  },
];

export const RESEARCH_STAGES: PatternStage[] = [
  {
    step: 3,
    key: "mcp-apps",
    name: "MCP Apps",
    scenario: "파트너 서비스가 소유한 에너지 대시보드",
    modelDecides: "언제 대시보드를 열지",
    appOwns: "호스트 경계만 · UI는 외부 서비스 소유",
    api: "mcpApps",
    prompt: "우리 집 가전 에너지 사용량 대시보드 열어 줘",
  },
  {
    step: 4,
    key: "fully-open",
    name: "Fully Open",
    scenario: "요청마다 생성되는 설명 UI",
    modelDecides: "HTML·CSS·JS 전체",
    appOwns: "샌드박스 경계 · sandbox function",
    api: "openGenerativeUI",
    prompt: "AI 절전 모드가 냉장고 전기료를 어떻게 줄이는지 슬라이더 시뮬레이터로 보여 줘",
  },
];

function StageCard({ stage, busy, onRun }: { stage: PatternStage; busy: string | null; onRun: (prompt: string, key: string) => void }) {
  return (
    <li className={`guide-card guide-${stage.key}`}>
      <div className="guide-top">
        <span className="guide-step">{stage.step}</span>
        <div>
          <h3>{stage.name}</h3>
          <p className="gu-muted">{stage.scenario}</p>
        </div>
        <code>{stage.api}</code>
      </div>
      <dl className="guide-facts">
        <div>
          <dt>모델이 결정</dt>
          <dd>{stage.modelDecides}</dd>
        </div>
        <div>
          <dt>앱이 소유</dt>
          <dd>{stage.appOwns}</dd>
        </div>
      </dl>
      <button type="button" className="guide-try" disabled={busy !== null} onClick={() => onRun(stage.prompt, stage.key)}>
        {busy === stage.key ? "실행 중…" : `“${stage.prompt}”`}
      </button>
      {stage.more?.length ? (
        <details className="guide-more">
          <summary>예시 질문 더 보기 ({stage.more.length})</summary>
          <ul>
            {stage.more.map((prompt, i) => {
              const key = `${stage.key}-${i}`;
              return (
                <li key={key}>
                  <button type="button" className="guide-try guide-try-sm" disabled={busy !== null} onClick={() => onRun(prompt, key)}>
                    {busy === key ? "실행 중…" : `“${prompt}”`}
                  </button>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}
    </li>
  );
}

/** Left rail: production path first, operational concerns next, research patterns folded away. */
export function PatternGuide({ agentId, children }: { agentId: string; children?: ReactNode }) {
  const { copilotkit } = useCopilotKit();
  const { agent } = useAgent({ agentId });
  const [busy, setBusy] = useState<string | null>(null);

  async function run(prompt: string, key: string) {
    setBusy(key);
    try {
      agent.addMessage({ id: crypto.randomUUID(), role: "user", content: prompt });
      await copilotkit.runAgent({ agent });
    } finally {
      setBusy(null);
    }
  }

  return (
    <nav className="guide" aria-label="Generative UI 스펙트럼">
      <section className="guide-section">
        <p className="guide-eyebrow">운영 권장 경로</p>
        <h2 className="guide-title">Controlled × Declarative 적응형 UI</h2>
        <p className="guide-lead">
          <strong>레이아웃은 모델이, 블록과 사실은 앱이</strong> 책임집니다. 모델은 승인된 컴포넌트를 고르고
          조합할 뿐, 가격·재고·디자인은 버전이 고정된 앱 코드와 도메인 API에서 옵니다.
        </p>
        <ol className="guide-list">
          {PRODUCTION_STAGES.map((stage) => (
            <StageCard key={stage.key} stage={stage} busy={busy} onRun={run} />
          ))}
        </ol>
      </section>

      {children}

      <details className="guide-section research">
        <summary>
          <span className="guide-eyebrow">연구 영역 · 운영 비권장</span>
          <span className="research-title">Open-ended (MCP Apps · Fully Open)</span>
        </summary>
        <p className="guide-lead">
          표현 자유도는 높지만 접근성·브랜드·보안·품질을 요청마다 보장하기 어렵습니다. 격리된 PoC로만
          비교하고 운영 경로에는 넣지 않습니다.
        </p>
        <ol className="guide-list">
          {RESEARCH_STAGES.map((stage) => (
            <StageCard key={stage.key} stage={stage} busy={busy} onRun={run} />
          ))}
        </ol>
      </details>
    </nav>
  );
}
