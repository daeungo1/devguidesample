"use client";

import { UseAgentUpdate, useAgent, useCopilotKit } from "@copilotkit/react-core/v2";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  createSnapshot,
  listTurns,
  parseSnapshot,
  rollbackBefore,
  type ThreadMessage,
} from "@/lib/thread-store";

const STORAGE_PREFIX = "contoso-genui-thread:";

const UI_LABELS: Record<string, string> = {
  show_phone_comparison: "Controlled",
  show_product_spotlight: "Controlled",
  render_a2ui: "Declarative",
  generate_a2ui: "Declarative",
  open_energy_dashboard: "MCP Apps",
  generateSandboxedUi: "Fully Open",
};

type Restore = { savedAt: string; messages: number; warnings: string[] } | null;

/**
 * Production concerns made visible: the conversation (including the tool calls
 * that produced UI) is saved as data, restored on reload, and can be rolled back
 * or edited from any earlier turn. The demo uses browser storage; a production
 * BFF would persist the same snapshot server-side per user and thread.
 */
export function ConversationPanel({ agentId }: { agentId: string }) {
  const { copilotkit } = useCopilotKit();
  const { agent, isReady } = useAgent({
    agentId,
    updates: [UseAgentUpdate.OnMessagesChanged, UseAgentUpdate.OnRunStatusChanged],
    throttleMs: 300,
  });
  const storageKey = STORAGE_PREFIX + agentId;
  const restored = useRef(false);
  const [restore, setRestore] = useState<Restore>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const messages = agent.messages as unknown as ThreadMessage[];
  const turns = useMemo(() => listTurns(messages), [messages, messages.length]);

  // Restore once per agent, before the user starts a new conversation.
  useEffect(() => {
    if (!isReady || restored.current) return;
    restored.current = true;
    const snapshot = parseSnapshot(localStorage.getItem(storageKey));
    if (snapshot?.messages.length && agent.messages.length === 0) {
      agent.setMessages(snapshot.messages as never);
      setRestore({ savedAt: snapshot.savedAt, messages: snapshot.messages.length, warnings: snapshot.warnings });
    }
  }, [isReady, agent, storageKey]);

  // Persist after every settled change; streaming partials are skipped.
  useEffect(() => {
    if (!restored.current || agent.isRunning) return;
    if (messages.length) localStorage.setItem(storageKey, JSON.stringify(createSnapshot(agentId, messages)));
    else localStorage.removeItem(storageKey);
  }, [messages, messages.length, agent.isRunning, agentId, storageKey]);

  function rollback(messageId: string) {
    agent.setMessages(rollbackBefore(messages, messageId) as never);
    setEditing(null);
    setRestore(null);
  }

  async function rerun(messageId: string, text: string) {
    agent.setMessages(rollbackBefore(messages, messageId) as never);
    agent.addMessage({ id: crypto.randomUUID(), role: "user", content: text });
    setEditing(null);
    setRestore(null);
    await copilotkit.runAgent({ agent });
  }

  function clear() {
    agent.setMessages([]);
    localStorage.removeItem(storageKey);
    setRestore(null);
  }

  return (
    <section className="ops" aria-label="대화 기록과 롤백">
      <header className="ops-head">
        <h2>운영 과제 시연</h2>
        <p className="gu-muted">UI가 포함된 대화를 데이터로 저장하고, 이전 턴으로 되돌리거나 질문을 고쳐 다시 실행합니다.</p>
      </header>

      {restore && (
        <p className="ops-restore" role="status">
          새로고침 후 {restore.messages}개 메시지를 복원했습니다 · 저장 {new Date(restore.savedAt).toLocaleTimeString("ko-KR")}
          {restore.warnings.length > 0 && <span className="gu-error"> · UI 계약 변경: {restore.warnings.join(", ")}</span>}
        </p>
      )}

      {turns.length === 0 ? (
        <p className="gu-muted ops-empty">위 추천 질문을 실행하면 턴 기록이 여기에 쌓입니다.</p>
      ) : (
        <ol className="ops-turns">
          {turns.map((turn, n) => (
            <li key={turn.messageId} className="ops-turn">
              {editing?.id === turn.messageId ? (
                <form
                  className="ops-edit"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void rerun(turn.messageId, editing.text);
                  }}
                >
                  <textarea
                    aria-label={`${n + 1}번째 질문 수정`}
                    value={editing.text}
                    onChange={(e) => setEditing({ id: turn.messageId, text: e.target.value })}
                    rows={3}
                  />
                  <div className="ops-actions">
                    <button type="submit" disabled={!editing.text.trim() || agent.isRunning}>이 질문부터 다시 실행</button>
                    <button type="button" className="ghost" onClick={() => setEditing(null)}>취소</button>
                  </div>
                </form>
              ) : (
                <>
                  <p className="ops-text">
                    <span className="ops-n">{n + 1}</span>
                    {turn.text}
                  </p>
                  <div className="ops-meta">
                    {[...new Set(turn.uiTools.map((t) => UI_LABELS[t]).filter(Boolean))].map((label) => (
                      <span key={label} className={`ops-tag ops-tag-${label.toLowerCase().replace(/\s/g, "-")}`}>{label}</span>
                    ))}
                    <span className="ops-spacer" />
                    <button type="button" className="ghost" disabled={agent.isRunning} onClick={() => rollback(turn.messageId)}>
                      ↺ 이 턴 이전으로
                    </button>
                    <button
                      type="button"
                      className="ghost"
                      disabled={agent.isRunning}
                      onClick={() => setEditing({ id: turn.messageId, text: turn.text })}
                    >
                      ✎ 수정
                    </button>
                  </div>
                </>
              )}
            </li>
          ))}
        </ol>
      )}

      <footer className="ops-foot">
        <span className="gu-muted">
          저장 위치: 브라우저 (데모) · 운영: BFF가 사용자·스레드별로 서버에 저장
        </span>
        <button type="button" className="ghost" onClick={clear} disabled={agent.isRunning || messages.length === 0}>
          기록 지우기
        </button>
      </footer>
    </section>
  );
}
