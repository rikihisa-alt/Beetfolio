/* ============================================================
   Beetfolio — SVG chart helpers (no dependencies)
   ============================================================ */
(function (global) {
  "use strict";

  const fmtJPY = (n) => "¥" + Math.round(n).toLocaleString("ja-JP");

  function sparkPath(data, w, h, pad = 3) {
    const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
    const step = (w - pad * 2) / (data.length - 1 || 1);
    return data.map((d, i) => {
      const x = pad + i * step;
      const y = h - pad - ((d - min) / span) * (h - pad * 2);
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }

  function sparkline(data, { up = true, id = "s" } = {}) {
    const stroke = up ? "var(--green)" : "var(--red)";
    const fill = up ? "rgba(45,226,138,.35)" : "rgba(255,92,124,.35)";
    return `<svg class="kpi-spark" viewBox="0 0 200 42" preserveAspectRatio="none">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="${fill}"/><stop offset="1" stop-color="transparent"/>
      </linearGradient></defs>
      <path d="${sparkPath(data, 200, 42)} L197,42 L3,42 Z" fill="url(#${id})"/>
      <path d="${sparkPath(data, 200, 42)}" fill="none" stroke="${stroke}" stroke-width="1.6"/>
    </svg>`;
  }

  // Line chart with hover tooltip. `points` = [{i, v}], labelFn(i,len)->string
  function lineChart(svg, points, labelFn) {
    const data = points.map((p) => p.v);
    const W = svg.clientWidth || 760, H = svg.clientHeight || 300;
    const padX = 8, padTop = 16, padBottom = 26;
    const min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
    const step = (W - padX * 2) / (data.length - 1 || 1);
    const x = (i) => padX + i * step;
    const y = (v) => padTop + (1 - (v - min) / span) * (H - padTop - padBottom);

    let line = "";
    data.forEach((d, i) => { line += `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d).toFixed(1)} `; });
    const area = line + `L${x(data.length - 1).toFixed(1)},${H - padBottom} L${x(0).toFixed(1)},${H - padBottom} Z`;

    let grid = "";
    for (let g = 0; g <= 4; g++) {
      const gy = padTop + (g / 4) * (H - padTop - padBottom);
      grid += `<line x1="${padX}" y1="${gy}" x2="${W - padX}" y2="${gy}" stroke="rgba(140,150,190,.07)"/>`;
    }

    svg.innerHTML = `
      <defs>
        <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="rgba(167,139,250,.35)"/>
          <stop offset="0.5" stop-color="rgba(255,77,157,.12)"/>
          <stop offset="1" stop-color="transparent"/>
        </linearGradient>
        <linearGradient id="netLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#a78bfa"/><stop offset="0.5" stop-color="#ff4d9d"/><stop offset="1" stop-color="#2de2e6"/>
        </linearGradient>
      </defs>
      ${grid}
      <path id="netArea" d="${area}" fill="url(#netGrad)"/>
      <path id="netLinePath" d="${line}" fill="none" stroke="url(#netLine)" stroke-width="2.5" stroke-linejoin="round"/>
      <circle id="dot" r="4.5" fill="#fff" stroke="#ff4d9d" stroke-width="2" opacity="0"/>
      <line id="guide" stroke="rgba(255,255,255,.15)" opacity="0"/>`;

    const dot = svg.querySelector("#dot");
    const guide = svg.querySelector("#guide");
    const tip = svg.parentElement.querySelector(".chart-tooltip");

    svg.onmousemove = (e) => {
      const rect = svg.getBoundingClientRect();
      let i = Math.round((e.clientX - rect.left - padX) / step);
      i = Math.max(0, Math.min(data.length - 1, i));
      const cx = x(i), cy = y(data[i]);
      dot.setAttribute("cx", cx); dot.setAttribute("cy", cy); dot.setAttribute("opacity", "1");
      guide.setAttribute("x1", cx); guide.setAttribute("x2", cx);
      guide.setAttribute("y1", padTop); guide.setAttribute("y2", H - padBottom); guide.setAttribute("opacity", "1");
      if (tip) {
        tip.hidden = false; tip.style.left = cx + "px"; tip.style.top = cy + "px";
        tip.innerHTML = `<div class="ctt-date">${labelFn ? labelFn(i, data.length) : ""}</div><div class="ctt-val">${fmtJPY(data[i])}</div>`;
      }
    };
    svg.onmouseleave = () => {
      dot.setAttribute("opacity", "0"); guide.setAttribute("opacity", "0");
      if (tip) tip.hidden = true;
    };
  }

  function donut(svg, segments) {
    const cx = 90, cy = 90, r = 64, sw = 22, C = 2 * Math.PI * r;
    let offset = 0, parts = "";
    segments.forEach((s) => {
      const len = (s.pct / 100) * C;
      parts += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="${sw}"
        stroke-dasharray="${Math.max(0, len - 3)} ${C - Math.max(0, len - 3)}" stroke-dashoffset="${-offset}"
        stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += len;
    });
    svg.innerHTML = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="rgba(140,150,190,.08)" stroke-width="${sw}"/>${parts}`;
  }

  // horizontal bar list: items [{label, value, color}]
  function barList(items) {
    const max = Math.max(...items.map((i) => Math.abs(i.value)), 1);
    return items.map((it) => {
      const pct = (Math.abs(it.value) / max) * 100;
      const neg = it.value < 0;
      return `<div class="barrow">
        <div class="barrow-label">${it.label}</div>
        <div class="barrow-track"><div class="barrow-fill" style="width:${pct}%;background:${neg ? "var(--red)" : (it.color || "var(--cyan)")}"></div></div>
        <div class="barrow-val ${neg ? "down" : "up"}">${neg ? "" : "+"}${fmtJPY(it.value)}</div>
      </div>`;
    }).join("");
  }

  global.Charts = { sparkPath, sparkline, lineChart, donut, barList, seededSpark };

  function seededSpark(seed) {
    let s = seed; const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const out = []; let v = 100;
    for (let i = 0; i < 24; i++) { v += (rand() - 0.45) * 6; out.push(v); }
    return out;
  }
})(window);
