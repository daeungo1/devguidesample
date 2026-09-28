/**
 * Contoso Energy MCP App. Runs inside the host's sandboxed iframe and talks to
 * the MCP server through the host bridge, so slider changes call the server
 * tool directly instead of asking the model to interpret each click.
 */
import { App, type McpUiHostContext } from "@modelcontextprotocol/ext-apps";

type Currency = "KRW" | "USD" | "EUR";
type Region = "KR" | "US" | "DE";

interface Simulation {
  region: Region;
  ecoLevel: number;
  currency: Currency;
  beforeKwh: number;
  afterKwh: number;
  savedKwh: number;
  savedCost: number;
  perAppliance: { id: string; name: string; beforeKwh: number; afterKwh: number }[];
}

interface ToolResultLike {
  isError?: boolean;
  structuredContent?: unknown;
}

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const shell = document.querySelector<HTMLElement>(".shell")!;
const eco = $<HTMLInputElement>("eco");
const ecoValue = $<HTMLOutputElement>("eco-value");
const modeBtn = $<HTMLButtonElement>("mode-btn");
const shareBtn = $<HTMLButtonElement>("share-btn");
const trace = $<HTMLParagraphElement>("trace");

let current: Simulation | undefined;
let directCalls = 0;
let pending: ReturnType<typeof setTimeout> | undefined;

const kwh = (value: number) => `${value.toLocaleString("ko-KR", { maximumFractionDigits: 1 })} kWh`;
const money = (value: number, currency: Currency) =>
  new Intl.NumberFormat("ko-KR", { style: "currency", currency, maximumFractionDigits: currency === "KRW" ? 0 : 2 }).format(value);

function readSimulation(result: ToolResultLike): Simulation | undefined {
  const data = result.structuredContent as { simulation?: Simulation } & Partial<Simulation> | undefined;
  if (!data) return undefined;
  return data.simulation ?? (data.perAppliance ? (data as Simulation) : undefined);
}

function render(sim: Simulation) {
  current = sim;
  $("region-chip").textContent = sim.region;
  $("kpi-after").textContent = kwh(sim.afterKwh);
  $("kpi-before").textContent = `절전 전 ${kwh(sim.beforeKwh)}`;
  $("kpi-saved").textContent = money(sim.savedCost, sim.currency);
  $("kpi-saved-kwh").textContent = `${kwh(sim.savedKwh)} 절감`;
  eco.value = String(sim.ecoLevel);
  ecoValue.textContent = String(sim.ecoLevel);

  const max = Math.max(...sim.perAppliance.map((a) => a.beforeKwh));
  $("bars").replaceChildren(
    ...sim.perAppliance.map((a) => {
      const li = document.createElement("li");
      li.className = "bar-row";
      li.innerHTML = `
        <span class="bar-name"></span>
        <span class="bar-track" role="img">
          <span class="bar-before" style="width:${(a.beforeKwh / max) * 100}%"></span>
          <span class="bar-after" style="width:${(a.afterKwh / max) * 100}%"></span>
        </span>
        <span class="bar-value"></span>`;
      li.querySelector(".bar-name")!.textContent = a.name;
      li.querySelector(".bar-track")!.setAttribute("aria-label", `${a.name}: ${kwh(a.beforeKwh)}에서 ${kwh(a.afterKwh)}`);
      li.querySelector(".bar-value")!.textContent = kwh(a.afterKwh);
      return li;
    }),
  );

  $("detail-body").replaceChildren(
    ...sim.perAppliance.map((a) => {
      const tr = document.createElement("tr");
      for (const cell of [a.name, kwh(a.beforeKwh), kwh(a.afterKwh), kwh(a.beforeKwh - a.afterKwh)]) {
        const td = document.createElement("td");
        td.textContent = cell;
        tr.append(td);
      }
      return tr;
    }),
  );

  eco.disabled = false;
  shareBtn.disabled = false;
}

function showError(message: string) {
  trace.textContent = `오류: ${message}`;
}

const app = new App({ name: "Contoso Energy Dashboard", version: "1.0.0" });

function applyHostContext(ctx: McpUiHostContext | undefined) {
  if (!ctx) return;
  if (ctx.theme) document.documentElement.dataset.theme = ctx.theme;
  if (ctx.displayMode) shell.dataset.mode = ctx.displayMode;
  const canFullscreen = ctx.availableDisplayModes?.includes("fullscreen") ?? false;
  modeBtn.hidden = !canFullscreen;
  modeBtn.textContent = ctx.displayMode === "fullscreen" ? "작게 보기" : "전체 화면";
}

app.ontoolresult = (result) => {
  const sim = readSimulation(result as ToolResultLike);
  if (sim) {
    render(sim);
    trace.textContent = "에이전트가 대시보드를 열었습니다. 이제 슬라이더 조작은 모델을 거치지 않습니다.";
  } else {
    showError("도구 결과에 사용량 데이터가 없습니다.");
  }
};
app.onhostcontextchanged = applyHostContext;
app.onerror = (error) => showError(String(error));

async function simulate(ecoLevel: number) {
  if (!current) return;
  const started = performance.now();
  try {
    const result = (await app.callServerTool({
      name: "simulate_savings",
      arguments: { region: current.region, ecoLevel },
    })) as ToolResultLike;
    const sim = readSimulation(result);
    if (result.isError || !sim) {
      showError("절감 계산에 실패했습니다.");
      return;
    }
    directCalls += 1;
    render(sim);
    trace.textContent = `모델 호출 없이 MCP 도구 직접 호출 · ${directCalls}회 · 최근 ${Math.round(performance.now() - started)} ms`;
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  }
}

eco.addEventListener("input", () => {
  ecoValue.textContent = eco.value;
  clearTimeout(pending);
  pending = setTimeout(() => void simulate(Number(eco.value)), 200);
});

modeBtn.addEventListener("click", async () => {
  const next = shell.dataset.mode === "fullscreen" ? "inline" : "fullscreen";
  try {
    const { mode } = await app.requestDisplayMode({ mode: next });
    shell.dataset.mode = mode;
    modeBtn.textContent = mode === "fullscreen" ? "작게 보기" : "전체 화면";
  } catch (error) {
    showError(`표시 모드 전환 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
});

shareBtn.addEventListener("click", async () => {
  if (!current) return;
  const summary =
    `Contoso Energy 대시보드: AI 절전 강도 ${current.ecoLevel}에서 월 ${current.savedKwh} kWh, ` +
    `${money(current.savedCost, current.currency)} 절감 (절전 후 ${current.afterKwh} kWh).`;
  try {
    await app.updateModelContext({ content: [{ type: "text", text: summary }] });
    trace.textContent = "현재 결과를 대화 맥락에 반영했습니다. 에이전트에게 후속 질문을 해 보세요.";
  } catch (error) {
    showError(`대화 반영 실패: ${error instanceof Error ? error.message : String(error)}`);
  }
});

app
  .connect()
  .then(() => applyHostContext(app.getHostContext()))
  .catch((error) => showError(`호스트 연결 실패: ${String(error)}`));
