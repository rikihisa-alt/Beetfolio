/* ============================================================
   Beetfolio — prototype data + rendering (no dependencies)
   すべてダミーデータ。将来ここを API レスポンスに差し替える。
   ============================================================ */

const fmtJPY = (n) => "¥" + Math.round(n).toLocaleString("ja-JP");
const fmtSigned = (n, suffix = "%") =>
  (n >= 0 ? "+" : "") + n.toFixed(2) + suffix;

/* ---------- KPI cards ---------- */
const KPIS = [
  { label: "総資産", glyph: "◈", value: 18452310, delta: 2.45, kind: "jpy", up: true },
  { label: "今月の損益", glyph: "↗", value: 421670, delta: 1.92, kind: "jpy", up: true },
  { label: "評価損益", glyph: "▤", value: 1256340, delta: 3.81, kind: "jpy", up: true },
  { label: "現金比率", glyph: "▦", value: 23.4, delta: -1.2, kind: "pct", up: false },
];

/* ---------- Accounts ---------- */
const ACCOUNTS = [
  { name: "bitFlyer", type: "暗号資産取引所", bal: 4980200, delta: 3.2, color: "#f0a020", logo: "₿" },
  { name: "SBI証券", type: "証券口座 (NISA/特定)", bal: 6720500, delta: 1.1, color: "#3b82f6", logo: "▤" },
  { name: "楽天銀行", type: "普通預金", bal: 3120000, delta: 0.0, color: "#bf2d2d", logo: "▦" },
  { name: "Binance", type: "暗号資産取引所", bal: 2890610, delta: -1.4, color: "#f3ba2f", logo: "◆" },
  { name: "住信SBIネット銀行", type: "普通+定期", bal: 741000, delta: 0.0, color: "#10b981", logo: "▦" },
];

/* ---------- Allocation (asset class) ---------- */
const ALLOCATION = [
  { name: "暗号資産", pct: 42.7, val: 7870810, color: "#a78bfa" },
  { name: "株式・投信", pct: 36.4, val: 6720500, color: "#2de2e6" },
  { name: "現金・預金", pct: 20.9, val: 3861000, color: "#ff4d9d" },
];

/* ---------- Top holdings ---------- */
const HOLDINGS = [
  { sym: "BTC", name: "Bitcoin", qty: "0.412 BTC", val: 4120300, delta: 2.8, color: "#f0a020", logo: "₿" },
  { sym: "VTI", name: "全米株式ETF", qty: "18 株", val: 2310500, delta: 1.2, color: "#2de2e6", logo: "▤" },
  { sym: "ETH", name: "Ethereum", qty: "9.2 ETH", val: 2090450, delta: -1.4, color: "#7c83ff", logo: "◆" },
  { sym: "eMAXIS", name: "S&P500 投信", qty: "—", val: 1840000, delta: 0.9, color: "#10b981", logo: "▦" },
  { sym: "SOL", name: "Solana", qty: "72 SOL", val: 980600, delta: 4.6, color: "#14f195", logo: "◇" },
];

/* ---------- Recent transactions ---------- */
const TRADES = [
  { time: "10:30", side: "buy", sym: "BTC", amt: "+0.012 BTC" },
  { time: "09:48", side: "sell", sym: "ETH", amt: "-1.5 ETH" },
  { time: "昨日", side: "buy", sym: "VTI", amt: "+3 株" },
  { time: "昨日", side: "buy", sym: "SOL", amt: "+10 SOL" },
  { time: "06/17", side: "sell", sym: "BTC", amt: "-0.005 BTC" },
  { time: "06/16", side: "buy", sym: "eMAXIS", amt: "¥50,000" },
];

/* ============================================================
   Deterministic pseudo-random series for net-worth chart
   ============================================================ */
function seededSeries(points, start, drift, vol, seed) {
  let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const out = [];
  let v = start;
  for (let i = 0; i < points; i++) {
    v += drift + (rand() - 0.45) * vol;
    out.push(Math.max(v, start * 0.6));
  }
  return out;
}

const SERIES = {
  "1W":  seededSeries(7,   17_900_000, 90_000,  220_000, 11),
  "1M":  seededSeries(30,  16_800_000, 60_000,  260_000, 23),
  "3M":  seededSeries(90,  14_500_000, 48_000,  300_000, 37),
  "6M":  seededSeries(180, 12_200_000, 38_000,  340_000, 51),
  "1Y":  seededSeries(365, 9_800_000,  26_000,  360_000, 73),
  "ALL": seededSeries(500, 6_500_000,  26_000,  380_000, 97),
};

/* ============================================================
   Renderers
   ============================================================ */
function sparkPath(data, w, h, pad = 3) {
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const step = (w - pad * 2) / (data.length - 1);
  return data.map((d, i) => {
    const x = pad + i * step;
    const y = h - pad - ((d - min) / span) * (h - pad * 2);
    return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
}

function renderKPIs() {
  const row = document.getElementById("kpiRow");
  row.innerHTML = KPIS.map((k, i) => {
    const spark = seededSeries(24, 100, 0.4, 6, 7 + i * 13);
    const stroke = k.up ? "var(--green)" : "var(--red)";
    const valStr = k.kind === "jpy" ? fmtJPY(k.value) : k.value.toFixed(1) + "%";
    return `
      <div class="kpi">
        <div class="kpi-head">
          <span class="kpi-label">${k.label}</span>
          <span class="kpi-glyph">${k.glyph}</span>
        </div>
        <div class="kpi-value">${valStr}</div>
        <div class="kpi-delta ${k.up ? "up" : "down"}">${fmtSigned(k.delta)} 今月</div>
        <svg class="kpi-spark" viewBox="0 0 200 42" preserveAspectRatio="none">
          <defs>
            <linearGradient id="kg${i}" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="${k.up ? "rgba(45,226,138,.35)" : "rgba(255,92,124,.35)"}"/>
              <stop offset="1" stop-color="transparent"/>
            </linearGradient>
          </defs>
          <path d="${sparkPath(spark, 200, 42)} L197,42 L3,42 Z" fill="url(#kg${i})" stroke="none"/>
          <path d="${sparkPath(spark, 200, 42)}" fill="none" stroke="${stroke}" stroke-width="1.6"/>
        </svg>
      </div>`;
  }).join("");
}

function renderAccounts() {
  const el = document.getElementById("accounts");
  el.innerHTML = ACCOUNTS.map(a => `
    <div class="acct">
      <div class="acct-logo" style="background:${a.color}22;color:${a.color}">${a.logo}</div>
      <div>
        <div class="acct-name">${a.name}</div>
        <div class="acct-type">${a.type}</div>
      </div>
      <div>
        <div class="acct-bal">${fmtJPY(a.bal)}</div>
        <div class="acct-delta ${a.delta >= 0 ? "up" : "down"}">${a.delta === 0 ? "±0.0%" : fmtSigned(a.delta)}</div>
      </div>
    </div>`).join("");
}

function renderHoldings() {
  const el = document.getElementById("holdings");
  el.innerHTML = HOLDINGS.map(h => `
    <div class="holding">
      <div class="hold-logo" style="background:${h.color}22;color:${h.color}">${h.logo}</div>
      <div>
        <div class="hold-name">${h.sym} <span style="color:var(--muted);font-weight:400;font-size:11px">${h.name}</span></div>
        <div class="hold-qty">${h.qty}</div>
      </div>
      <div>
        <div class="hold-val">${fmtJPY(h.val)}</div>
        <div class="hold-delta ${h.delta >= 0 ? "up" : "down"}">${fmtSigned(h.delta)}</div>
      </div>
    </div>`).join("");
}

function renderTrades() {
  const el = document.getElementById("trades");
  el.innerHTML = TRADES.map(t => `
    <div class="trade">
      <span class="tr-time">${t.time}</span>
      <span><span class="tr-tag ${t.side === "buy" ? "tr-buy" : "tr-sell"}">${t.side === "buy" ? "買" : "売"}</span>
        <span class="tr-sym">${t.sym}</span></span>
      <span class="tr-amt">${t.amt}</span>
    </div>`).join("");
}

/* ---------- Donut ---------- */
function renderDonut() {
  const svg = document.getElementById("donut");
  const cx = 90, cy = 90, r = 64, sw = 22;
  const C = 2 * Math.PI * r;
  let offset = 0;
  let parts = "";
  ALLOCATION.forEach(a => {
    const len = (a.pct / 100) * C;
    parts += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
      stroke="${a.color}" stroke-width="${sw}"
      stroke-dasharray="${len - 3} ${C - len + 3}"
      stroke-dashoffset="${-offset}" stroke-linecap="round"
      transform="rotate(-90 ${cx} ${cy})"/>`;
    offset += len;
  });
  svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(140,150,190,.08)" stroke-width="${sw}"/>${parts}`;

  document.getElementById("donutTotal").textContent = fmtJPY(ALLOCATION.reduce((s, a) => s + a.val, 0));
  document.getElementById("legend").innerHTML = ALLOCATION.map(a => `
    <li>
      <span class="lg-swatch" style="background:${a.color}"></span>
      <span class="lg-name">${a.name}</span>
      <span class="lg-right">
        <div class="lg-pct">${a.pct}%</div>
        <div class="lg-val">${fmtJPY(a.val)}</div>
      </span>
    </li>`).join("");
}

/* ---------- Net worth chart ---------- */
let currentTF = "1M";
function renderNetChart(tf) {
  currentTF = tf;
  const data = SERIES[tf];
  const svg = document.getElementById("netChart");
  const W = svg.clientWidth || 760, H = svg.clientHeight || 300;
  const padX = 8, padTop = 16, padBottom = 26;
  const min = Math.min(...data), max = Math.max(...data);
  const span = max - min || 1;
  const step = (W - padX * 2) / (data.length - 1);
  const x = i => padX + i * step;
  const y = v => padTop + (1 - (v - min) / span) * (H - padTop - padBottom);

  let line = "", area = "";
  data.forEach((d, i) => {
    line += `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d).toFixed(1)} `;
  });
  area = line + `L${x(data.length - 1).toFixed(1)},${H - padBottom} L${x(0).toFixed(1)},${H - padBottom} Z`;

  // horizontal gridlines
  let grid = "";
  for (let g = 0; g <= 4; g++) {
    const gy = padTop + (g / 4) * (H - padTop - padBottom);
    grid += `<line x1="${padX}" y1="${gy}" x2="${W - padX}" y2="${gy}" stroke="rgba(140,150,190,.07)" stroke-width="1"/>`;
  }

  svg.innerHTML = `
    <defs>
      <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="rgba(167,139,250,.35)"/>
        <stop offset="0.5" stop-color="rgba(255,77,157,.12)"/>
        <stop offset="1" stop-color="transparent"/>
      </linearGradient>
      <linearGradient id="netLine" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#a78bfa"/>
        <stop offset="0.5" stop-color="#ff4d9d"/>
        <stop offset="1" stop-color="#2de2e6"/>
      </linearGradient>
    </defs>
    ${grid}
    <path d="${area}" fill="url(#netGrad)"/>
    <path d="${line}" fill="none" stroke="url(#netLine)" stroke-width="2.5" stroke-linejoin="round"/>
    <circle id="netDot" r="4.5" fill="#fff" stroke="#ff4d9d" stroke-width="2" opacity="0"/>
    <line id="netGuide" stroke="rgba(255,255,255,.15)" stroke-width="1" opacity="0"/>
  `;

  // update header
  const now = data[data.length - 1];
  const first = data[0];
  const chg = ((now - first) / first) * 100;
  document.getElementById("netNow").textContent = fmtJPY(now);
  const pill = document.getElementById("netChange");
  pill.textContent = fmtSigned(chg);
  pill.className = "pill " + (chg >= 0 ? "up" : "down");

  // hover interaction
  const dot = svg.querySelector("#netDot");
  const guide = svg.querySelector("#netGuide");
  const tip = document.getElementById("chartTip");
  const wrap = svg.parentElement;

  svg.onmousemove = (e) => {
    const rect = svg.getBoundingClientRect();
    const px = e.clientX - rect.left;
    let i = Math.round((px - padX) / step);
    i = Math.max(0, Math.min(data.length - 1, i));
    const cx = x(i), cy = y(data[i]);
    dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); dot.setAttribute("opacity", "1");
    guide.setAttribute("x1", cx); guide.setAttribute("x2", cx);
    guide.setAttribute("y1", padTop); guide.setAttribute("y2", H - padBottom);
    guide.setAttribute("opacity", "1");
    tip.hidden = false;
    tip.style.left = cx + "px";
    tip.style.top = cy + "px";
    tip.innerHTML = `<div class="ctt-date">${tfLabel(tf, i, data.length)}</div><div class="ctt-val">${fmtJPY(data[i])}</div>`;
  };
  svg.onmouseleave = () => {
    dot.setAttribute("opacity", "0");
    guide.setAttribute("opacity", "0");
    tip.hidden = true;
  };
}

function tfLabel(tf, i, len) {
  const back = len - 1 - i;
  if (tf === "1W" || tf === "1M") return back === 0 ? "今日" : `${back}日前`;
  if (tf === "3M" || tf === "6M") return back === 0 ? "今日" : `${back}日前`;
  return back === 0 ? "現在" : `${back}日前`;
}

/* ---------- clock ---------- */
function tickClock() {
  const el = document.getElementById("clock");
  if (!el) return;
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  el.textContent = `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} • ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} (JST)`;
}

/* ============================================================ */
function init() {
  renderKPIs();
  renderAccounts();
  renderHoldings();
  renderTrades();
  renderDonut();
  renderNetChart(currentTF);

  document.getElementById("tfToggle").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    document.querySelectorAll("#tfToggle button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    renderNetChart(btn.dataset.tf);
  });

  tickClock();
  setInterval(tickClock, 1000);
  window.addEventListener("resize", () => renderNetChart(currentTF));
}

document.addEventListener("DOMContentLoaded", init);
