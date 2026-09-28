/**
 * GenUI conversation history stored as data, not rendered HTML.
 * A snapshot keeps the AG-UI messages (including tool calls that produced UI)
 * plus the UI contract versions they were rendered against, so a restore can
 * re-render with current components and flag contract drift.
 */

export interface ThreadToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ThreadMessage {
  id: string;
  role: string;
  content?: unknown;
  toolCalls?: ThreadToolCall[];
  toolCallId?: string;
  [key: string]: unknown;
}

export const SNAPSHOT_VERSION = 1;

/** Versions of every UI contract the model can target. Bump when a schema changes. */
export const UI_CONTRACT = {
  phoneComparison: "show_phone_comparison@1",
  bundleCatalog: "contoso-home-bundle@1",
} as const;

export interface ThreadSnapshot {
  version: number;
  agentId: string;
  savedAt: string;
  contract: Record<string, string>;
  messages: ThreadMessage[];
}

export interface Turn {
  messageId: string;
  index: number;
  text: string;
  uiTools: string[];
}

export function createSnapshot(agentId: string, messages: ThreadMessage[], now = new Date()): ThreadSnapshot {
  return { version: SNAPSHOT_VERSION, agentId, savedAt: now.toISOString(), contract: { ...UI_CONTRACT }, messages };
}

export function parseSnapshot(raw: string | null): (ThreadSnapshot & { warnings: string[] }) | null {
  if (!raw) return null;
  let data: Partial<ThreadSnapshot>;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (data.version !== SNAPSHOT_VERSION || !Array.isArray(data.messages)) return null;

  const stored = data.contract ?? {};
  const warnings = Object.entries(UI_CONTRACT)
    .filter(([key, current]) => stored[key] && stored[key] !== current)
    .map(([key, current]) => `${key}: ${stored[key]} → ${current}`);

  return {
    version: data.version,
    agentId: data.agentId ?? "",
    savedAt: data.savedAt ?? "",
    contract: stored,
    messages: data.messages,
    warnings,
  };
}

const textOf = (content: unknown) =>
  typeof content === "string"
    ? content
    : Array.isArray(content)
      ? content.map((part) => (typeof part?.text === "string" ? part.text : "")).join(" ")
      : "";

/** One entry per user message, with the UI tools the following assistant steps called. */
export function listTurns(messages: ThreadMessage[]): Turn[] {
  const turns: Turn[] = [];
  messages.forEach((message, index) => {
    if (message.role === "user") {
      turns.push({ messageId: message.id, index, text: textOf(message.content), uiTools: [] });
    } else if (turns.length && message.toolCalls?.length) {
      turns[turns.length - 1].uiTools.push(...message.toolCalls.map((call) => call.function.name));
    }
  });
  return turns;
}

/** History as it was before the given user message was sent. */
export function rollbackBefore(messages: ThreadMessage[], userMessageId: string): ThreadMessage[] {
  const index = messages.findIndex((m) => m.id === userMessageId);
  return index < 0 ? messages : messages.slice(0, index);
}
