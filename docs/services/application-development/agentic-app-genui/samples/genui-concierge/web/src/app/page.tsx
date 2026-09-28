"use client";

import { CopilotChat, CopilotKitProvider } from "@copilotkit/react-core/v2";
import { useState } from "react";
import { bundleCatalog } from "@/a2ui/catalog";
import { ConciergeTools } from "@/components/concierge-tools";
import { ConversationPanel } from "@/components/conversation-panel";
import { PatternGuide } from "@/components/pattern-guide";
import type { Region } from "@/lib/catalog";
import { REGIONS, RegionProvider } from "@/lib/region";
import { DESIGN_SKILL, sandboxFunctions } from "@/lib/sandbox-functions";

const MODELS = [
  { id: "luna", label: "GPT-5.6 Luna" },
  { id: "terra", label: "GPT-5.6 Terra" },
] as const;

export default function Page() {
  const [agentId, setAgentId] = useState<(typeof MODELS)[number]["id"]>("luna");
  const [region, setRegion] = useState<Region>("KR");

  return (
    <RegionProvider value={region}>
      {/* Keying by agent starts a fresh conversation when the model changes. */}
      <CopilotKitProvider
        key={agentId}
        runtimeUrl="/api/copilotkit"
        agentId={agentId}
        a2ui={{ catalog: bundleCatalog }}
        openGenerativeUI={{ sandboxFunctions, designSkill: DESIGN_SKILL }}
      >
        <ConciergeTools region={region} />
        <div className="app">
          <header className="topbar">
            <div className="brand">
              <span className="brand-mark" aria-hidden>C</span>
              <div>
                <p className="brand-name">Contoso Electronics</p>
                <p className="gu-muted">디바이스 컨시어지 · 운영형 Generative UI 데모</p>
              </div>
            </div>
            <div className="controls">
              <div className="segmented" role="radiogroup" aria-label="모델">
                {MODELS.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    role="radio"
                    aria-checked={agentId === m.id}
                    className={agentId === m.id ? "is-active" : ""}
                    onClick={() => setAgentId(m.id)}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <label className="region">
                <span className="gu-muted">지역</span>
                <select value={region} onChange={(e) => setRegion(e.target.value as Region)}>
                  {REGIONS.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </header>

          <main className="workspace">
            <PatternGuide agentId={agentId}>
              <ConversationPanel agentId={agentId} />
            </PatternGuide>
            <section className="chat" aria-label="컨시어지 대화">
              <CopilotChat />
            </section>
          </main>

          <footer className="foot-note">
            Azure OpenAI in Foundry (Responses API, Microsoft Entra ID) · CopilotKit · A2UI · MCP Apps · 가상 브랜드와 예시 데이터
          </footer>
        </div>
      </CopilotKitProvider>
    </RegionProvider>
  );
}
