import { describe, expect, it } from "vitest";
import {
  SNAPSHOT_VERSION,
  UI_CONTRACT,
  createSnapshot,
  listTurns,
  parseSnapshot,
  rollbackBefore,
  type ThreadMessage,
} from "./thread-store";

const messages: ThreadMessage[] = [
  { id: "u1", role: "user", content: "폰 비교해 줘" },
  { id: "a1", role: "assistant", content: "", toolCalls: [{ id: "t1", type: "function", function: { name: "show_phone_comparison", arguments: "{}" } }] },
  { id: "r1", role: "tool", content: "ok", toolCallId: "t1" },
  { id: "u2", role: "user", content: "번들 구성해 줘" },
  { id: "a2", role: "assistant", content: "", toolCalls: [{ id: "t2", type: "function", function: { name: "render_a2ui", arguments: "{}" } }] },
  { id: "a3", role: "assistant", content: "구성했습니다." },
];

describe("listTurns", () => {
  it("groups each user message with the UI blocks it produced", () => {
    expect(listTurns(messages)).toEqual([
      { messageId: "u1", index: 0, text: "폰 비교해 줘", uiTools: ["show_phone_comparison"] },
      { messageId: "u2", index: 3, text: "번들 구성해 줘", uiTools: ["render_a2ui"] },
    ]);
  });
});

describe("rollbackBefore", () => {
  it("drops the chosen turn and everything after it", () => {
    expect(rollbackBefore(messages, "u2").map((m) => m.id)).toEqual(["u1", "a1", "r1"]);
    expect(rollbackBefore(messages, "u1")).toEqual([]);
  });

  it("leaves history unchanged for an unknown message", () => {
    expect(rollbackBefore(messages, "missing")).toBe(messages);
  });
});

describe("snapshots", () => {
  it("round-trips messages with the UI contract they were rendered against", () => {
    const raw = JSON.stringify(createSnapshot("luna", messages, new Date("2026-09-28T00:00:00Z")));
    const parsed = parseSnapshot(raw);
    expect(parsed?.messages).toEqual(messages);
    expect(parsed?.agentId).toBe("luna");
    expect(parsed?.warnings).toEqual([]);
  });

  it("warns when a stored UI contract version differs from the current one", () => {
    const snapshot = { ...createSnapshot("luna", messages), contract: { ...UI_CONTRACT, bundleCatalog: "contoso-home-bundle@0" } };
    expect(parseSnapshot(JSON.stringify(snapshot))?.warnings).toEqual([
      "bundleCatalog: contoso-home-bundle@0 → " + UI_CONTRACT.bundleCatalog,
    ]);
  });

  it("rejects corrupt or incompatible snapshots instead of restoring them", () => {
    expect(parseSnapshot("not json")).toBeNull();
    expect(parseSnapshot(JSON.stringify({ version: SNAPSHOT_VERSION + 1, messages: [] }))).toBeNull();
    expect(parseSnapshot(JSON.stringify({ version: SNAPSHOT_VERSION, messages: "x" }))).toBeNull();
  });
});
