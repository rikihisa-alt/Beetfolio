/* ============================================================
   Beetfolio — router + views + interactions
   ============================================================ */
(function () {
  "use strict";
  const { fmtJPY, fmtSigned, fmtSignedJPY, fmtQty, escapeHtml, toast, openForm, confirmDialog, popover } = UI;

  const view = document.getElementById("view");

  /* ---------- entrance animations (count-up + chart draw-in) ---------- */
  let shouldAnimate = true;
  const FMT = {
    jpy: fmtJPY, sjpy: fmtSignedJPY,
    pct: (v) => v.toFixed(1) + "%",
    plain: (v) => Math.round(v).toLocaleString("ja-JP"),
  };
  function countUp(el, to, fmt) {
    if (!el) return;
    const f = FMT[fmt] || FMT.plain;
    if (!shouldAnimate) { el.textContent = f(to); return; }
    const dur = 900; let start = null;
    function step(ts) {
      if (start === null) start = ts;
      const p = Math.min(1, (ts - start) / dur);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = f(to * e);
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  function drawInLine(svg) {
    if (!svg || !shouldAnimate) return;
    const p = svg.querySelector("#netLinePath"); if (!p) return;
    const len = p.getTotalLength();
    p.style.strokeDasharray = len; p.style.strokeDashoffset = len;
    p.getBoundingClientRect();
    p.style.transition = "stroke-dashoffset 1.15s cubic-bezier(.4,0,.2,1)";
    requestAnimationFrame(() => { p.style.strokeDashoffset = "0"; });
    const a = svg.querySelector("#netArea");
    if (a) { a.style.opacity = "0"; a.style.transition = "opacity 1.2s ease"; requestAnimationFrame(() => a.style.opacity = "1"); }
  }
  function enhance() {
    view.querySelectorAll("[data-count]").forEach((el) => countUp(el, +el.dataset.count, el.dataset.fmt));
    const d = document.getElementById("donut");
    if (d && shouldAnimate) { d.classList.remove("spin-in"); void d.offsetWidth; d.classList.add("spin-in"); }
  }

  const PAGE = {
    dashboard:   { title: "ダッシュボード", sub: "今日のあなたの資産状況です。" },
    networth:    { title: "総資産", sub: "純資産の推移と内訳。" },
    crypto:      { title: "暗号資産", sub: "保有している暗号資産の一覧。" },
    stocks:      { title: "株式・投信", sub: "株式・ETF・投資信託の保有状況。" },
    bank:        { title: "銀行・現金", sub: "口座残高と現金比率。" },
    analytics:   { title: "分析", sub: "資産配分・損益・パフォーマンス。" },
    transactions:{ title: "入出金", sub: "売買・入出金の履歴。" },
    settings:    { title: "設定", sub: "表示設定とデータ管理。" },
  };

  /* ---------------- shared bits ---------------- */
  const delta = (n) => `<span class="${n >= 0 ? "up" : "down"}">${n === 0 ? "±0.00%" : fmtSigned(n)}</span>`;
  const ICON_BTN = (act, label, id) => `<button class="btn primary" data-act="${act}">${label}</button>`;

  function tfLabel(i, len) { const back = len - 1 - i; return back === 0 ? "現在" : `${back}日前`; }

  function netChartBlock(tf) {
    return `
      <div class="panel chart-panel">
        <div class="panel-head">
          <div class="ph-left">
            <span class="asset-icon">◈</span>
            <div><div class="ph-title">総資産推移</div><div class="ph-sub">Net Worth</div></div>
            <div class="ph-value" id="netNow">—</div>
            <span class="pill up" id="netChange">+0.0%</span>
          </div>
          <div class="tf-toggle" id="tfToggle">
            ${["1W","1M","3M","6M","1Y","ALL"].map((t)=>`<button data-tf="${t}" class="${t===tf?"active":""}">${t}</button>`).join("")}
          </div>
        </div>
        <div class="chart-wrap"><svg id="netChart" class="net-chart" preserveAspectRatio="none"></svg><div class="chart-tooltip" hidden></div></div>
      </div>`;
  }
  let currentTF = "1M";
  function drawNetChart() {
    const svg = document.getElementById("netChart"); if (!svg) return;
    const series = Store.netWorthSeries(currentTF);
    Charts.lineChart(svg, series, tfLabel);
    drawInLine(svg);
    const now = series[series.length - 1].v, first = series[0].v;
    const chg = first ? ((now - first) / first) * 100 : 0;
    countUp(document.getElementById("netNow"), now, "jpy");
    const pill = document.getElementById("netChange");
    pill.textContent = fmtSigned(chg); pill.className = "pill " + (chg >= 0 ? "up" : "down");
  }
  function wireTF() {
    const t = document.getElementById("tfToggle"); if (!t) return;
    t.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      t.querySelectorAll("button").forEach((x) => x.classList.remove("active"));
      b.classList.add("active"); currentTF = b.dataset.tf; drawNetChart();
    });
  }

  function allocationPanel() {
    const segs = Store.allocationByGroup();
    return `<div class="panel">
      <div class="panel-head"><div class="ph-title">資産配分</div></div>
      <div class="allocation">
        <div class="donut-wrap">
          <svg id="donut" viewBox="0 0 180 180"></svg>
          <div class="donut-center"><div class="dc-label">総資産</div><div class="dc-value" data-count="${Store.totalValue()}" data-fmt="jpy">${fmtJPY(Store.totalValue())}</div></div>
        </div>
        <ul class="legend">${segs.map((a) => `<li>
          <span class="lg-swatch" style="background:${a.color}"></span>
          <span class="lg-name">${a.name}</span>
          <span class="lg-right"><div class="lg-pct">${a.pct}%</div><div class="lg-val">${fmtJPY(a.val)}</div></span>
        </li>`).join("")}</ul>
      </div></div>`;
  }
  function drawDonut() { const d = document.getElementById("donut"); if (d) Charts.donut(d, Store.allocationByGroup()); }

  function holdingRow(h, withActions) {
    const pl = Store.holdingPLPct(h);
    return `<div class="holding" data-id="${h.id}">
      <div class="hold-logo" style="background:${h.color}22;color:${h.color}">${escapeHtml(h.logo || "?")}</div>
      <div>
        <div class="hold-name">${escapeHtml(h.symbol)} <span class="hold-sub">${escapeHtml(h.name)}</span></div>
        <div class="hold-qty">${fmtQty(h.quantity)}${h.class === "cash" ? "" : " 口"}</div>
      </div>
      <div>
        <div class="hold-val">${fmtJPY(Store.holdingValue(h))}</div>
        <div class="hold-delta ${pl >= 0 ? "up" : "down"}">${h.class === "cash" ? "—" : fmtSigned(pl)}</div>
      </div>
      ${withActions ? `<div class="row-actions">
        <button class="mini" data-edit="${h.id}" title="編集">✎</button>
        <button class="mini" data-del="${h.id}" title="削除">🗑</button>
      </div>` : ""}
    </div>`;
  }

  /* ============================================================
     PAGES
     ============================================================ */
  function pageDashboard() {
    const k = Store.kpis();
    const cards = [
      { label: "総資産", glyph: "◈", num: k.total, fmt: "jpy", d: k.monthChangePct, up: k.monthChangePct >= 0 },
      { label: "今月の損益", glyph: "↗", num: k.monthChange, fmt: "sjpy", d: k.monthChangePct, up: k.monthChange >= 0 },
      { label: "評価損益", glyph: "▤", num: k.unrealizedPL, fmt: "sjpy", d: k.unrealizedPLPct, up: k.unrealizedPL >= 0 },
      { label: "現金比率", glyph: "▦", num: k.cashRatio, fmt: "pct", d: 0, up: true, flat: true },
    ];
    view.innerHTML = `
      <section class="kpi-row">${cards.map((c, i) => `
        <div class="kpi">
          <div class="kpi-head"><span class="kpi-label">${c.label}</span><span class="kpi-glyph">${c.glyph}</span></div>
          <div class="kpi-value" data-count="${c.num}" data-fmt="${c.fmt}">${FMT[c.fmt](c.num)}</div>
          <div class="kpi-delta ${c.up ? "up" : "down"}">${c.flat ? "現預金の割合" : fmtSigned(c.d) + " 今月"}</div>
          ${Charts.sparkline(Charts.seededSpark(7 + i * 13), { up: c.up, id: "kg" + i })}
        </div>`).join("")}
      </section>

      <section class="grid-2">
        ${netChartBlock(currentTF)}
        <div class="panel accounts-panel">
          <div class="panel-head"><div class="ph-title">接続口座</div><a class="link" data-route="bank">すべて</a></div>
          <div class="accounts">${Store.accounts.map(accountCard).join("")}</div>
          <button class="add-bot" data-act="add-account">+ 口座を追加</button>
        </div>
      </section>

      <section class="grid-3">
        ${allocationPanel()}
        <div class="panel">
          <div class="panel-head"><div class="ph-title">主要保有</div><a class="link" data-route="crypto">すべて</a></div>
          <div class="holdings">${Store.holdingsByClass(["crypto","stock","fund"]).slice(0,5).map((h)=>holdingRow(h,false)).join("") || emptyMini("保有なし")}</div>
        </div>
        <div class="panel">
          <div class="panel-head"><div class="ph-title">最近の取引</div><a class="link" data-route="transactions">すべて</a></div>
          <div class="trades">${Store.transactions.slice(0,6).map(tradeRow).join("") || emptyMini("取引なし")}</div>
        </div>
      </section>`;
    drawNetChart(); wireTF(); drawDonut();
  }

  function accountCard(a) {
    const bal = Store.accountBalance(a.id);
    return `<div class="acct" data-id="${a.id}">
      <div class="acct-logo" style="background:${a.color}22;color:${a.color}">${escapeHtml(a.logo)}</div>
      <div><div class="acct-name">${escapeHtml(a.name)}</div><div class="acct-type">${Store.TYPE_LABEL[a.type] || ""}</div></div>
      <div><div class="acct-bal">${fmtJPY(bal)}</div></div>
    </div>`;
  }

  function tradeRow(t) {
    const buy = t.side === "buy" || t.side === "deposit";
    const label = { buy: "買", sell: "売", deposit: "入金", withdraw: "出金" }[t.side];
    const amt = (t.side === "deposit" || t.side === "withdraw") ? fmtJPY(t.quantity || t.price) : `${buy ? "+" : "-"}${fmtQty(t.quantity)} ${escapeHtml(t.symbol)}`;
    return `<div class="trade"><span class="tr-time">${escapeHtml(t.date.slice(5))}</span>
      <span><span class="tr-tag ${buy ? "tr-buy" : "tr-sell"}">${label}</span> <span class="tr-sym">${escapeHtml(t.symbol)}</span></span>
      <span class="tr-amt">${amt}</span></div>`;
  }

  function pageNetWorth() {
    const k = Store.kpis();
    const segs = Store.allocationByGroup();
    view.innerHTML = `
      <section class="kpi-row">
        ${statCard("純資産", fmtJPY(k.total), fmtSigned(k.monthChangePct) + " 今月", k.monthChange >= 0)}
        ${statCard("今月の損益", fmtSignedJPY(k.monthChange), "前月末比", k.monthChange >= 0)}
        ${statCard("評価損益", fmtSignedJPY(k.unrealizedPL), fmtSigned(k.unrealizedPLPct), k.unrealizedPL >= 0)}
        ${statCard("現金比率", k.cashRatio.toFixed(1) + "%", "現預金の割合", true)}
      </section>
      <section class="grid-2">
        ${netChartBlock(currentTF)}
        ${allocationPanel()}
      </section>
      <section class="grid-1">
        <div class="panel">
          <div class="panel-head"><div class="ph-title">グループ別内訳</div></div>
          <div class="bar-list">${Charts.barList(segs.map((s) => ({ label: s.name, value: s.val, color: s.color })))}</div>
        </div>
      </section>`;
    drawNetChart(); wireTF(); drawDonut();
  }

  function statCard(label, value, sub, up) {
    return `<div class="kpi">
      <div class="kpi-head"><span class="kpi-label">${label}</span></div>
      <div class="kpi-value">${value}</div>
      <div class="kpi-delta ${up ? "up" : "down"}">${sub}</div></div>`;
  }

  function holdingsTable(holdings, addLabel) {
    if (!holdings.length) return emptyState("保有がありません", addLabel, "add-holding");
    return `<div class="panel">
      <div class="panel-head"><div class="ph-title">保有一覧 <span class="count">${holdings.length}</span></div>
        <button class="btn primary sm" data-act="add-holding">+ ${addLabel}</button></div>
      <div class="table">
        <div class="thead"><span>銘柄</span><span>数量</span><span>取得単価</span><span>現在値</span><span>評価額</span><span>損益</span><span></span></div>
        ${holdings.map((h) => {
          const pl = Store.holdingPL(h), plp = Store.holdingPLPct(h);
          return `<div class="trow" data-id="${h.id}">
            <span class="td-name"><span class="hold-logo sm" style="background:${h.color}22;color:${h.color}">${escapeHtml(h.logo||"?")}</span>
              <span><b>${escapeHtml(h.symbol)}</b><small>${escapeHtml(h.name)}</small></span></span>
            <span>${fmtQty(h.quantity)}</span>
            <span>${h.class === "cash" ? "—" : fmtJPY(h.costBasis)}</span>
            <span>${h.class === "cash" ? "—" : fmtJPY(h.price)}</span>
            <span class="td-val">${fmtJPY(Store.holdingValue(h))}</span>
            <span class="${pl >= 0 ? "up" : "down"}">${h.class === "cash" ? "—" : fmtSignedJPY(pl) + `<small>${fmtSigned(plp)}</small>`}</span>
            <span class="row-actions"><button class="mini" data-edit="${h.id}">✎</button><button class="mini" data-del="${h.id}">🗑</button></span>
          </div>`;
        }).join("")}
      </div></div>`;
  }

  function pageCrypto() {
    const hs = Store.holdingsByClass(["crypto"]);
    const total = hs.reduce((s, h) => s + Store.holdingValue(h), 0);
    const pl = hs.reduce((s, h) => s + Store.holdingPL(h), 0);
    const cost = hs.reduce((s, h) => s + Store.holdingCost(h), 0);
    view.innerHTML = `
      <section class="kpi-row">
        ${statCard("暗号資産 評価額", fmtJPY(total), `全資産の ${(Store.totalValue()?total/Store.totalValue()*100:0).toFixed(1)}%`, true)}
        ${statCard("評価損益", fmtSignedJPY(pl), fmtSigned(cost?pl/cost*100:0), pl >= 0)}
        ${statCard("銘柄数", hs.length + " 銘柄", "保有中", true)}
        ${statCard("最終同期", Store.settings.lastSync || "—", "価格更新", true)}
      </section>
      <section class="grid-1">${holdingsTable(hs, "暗号資産を追加")}</section>`;
  }

  function pageStocks() {
    const hs = Store.holdingsByClass(["stock", "fund"]);
    const total = hs.reduce((s, h) => s + Store.holdingValue(h), 0);
    const pl = hs.reduce((s, h) => s + Store.holdingPL(h), 0);
    const cost = hs.reduce((s, h) => s + Store.holdingCost(h), 0);
    view.innerHTML = `
      <section class="kpi-row">
        ${statCard("株式・投信 評価額", fmtJPY(total), `全資産の ${(Store.totalValue()?total/Store.totalValue()*100:0).toFixed(1)}%`, true)}
        ${statCard("評価損益", fmtSignedJPY(pl), fmtSigned(cost?pl/cost*100:0), pl >= 0)}
        ${statCard("銘柄数", hs.length + " 銘柄", "保有中", true)}
        ${statCard("最終同期", Store.settings.lastSync || "—", "価格更新", true)}
      </section>
      <section class="grid-1">${holdingsTable(hs, "銘柄を追加")}</section>`;
  }

  function pageBank() {
    const banks = Store.accounts.filter((a) => a.type === "bank");
    const cashTotal = Store.cashTotal();
    view.innerHTML = `
      <section class="kpi-row">
        ${statCard("現金・預金 合計", fmtJPY(cashTotal), `現金比率 ${Store.kpis().cashRatio.toFixed(1)}%`, true)}
        ${statCard("銀行口座数", banks.length + " 口座", "登録中", true)}
        ${statCard("総資産", fmtJPY(Store.totalValue()), "全資産", true)}
        ${statCard("最終同期", Store.settings.lastSync || "—", "—", true)}
      </section>
      <section class="grid-1">
        <div class="panel">
          <div class="panel-head"><div class="ph-title">口座一覧 <span class="count">${Store.accounts.length}</span></div>
            <button class="btn primary sm" data-act="add-account">+ 口座を追加</button></div>
          <div class="table acct-table">
            <div class="thead"><span>口座</span><span>種別</span><span>残高</span><span></span></div>
            ${Store.accounts.map((a) => `<div class="trow" data-id="${a.id}">
              <span class="td-name"><span class="hold-logo sm" style="background:${a.color}22;color:${a.color}">${escapeHtml(a.logo)}</span><span><b>${escapeHtml(a.name)}</b></span></span>
              <span><span class="chip">${Store.TYPE_LABEL[a.type]}</span></span>
              <span class="td-val">${fmtJPY(Store.accountBalance(a.id))}</span>
              <span class="row-actions"><button class="mini" data-edit-acct="${a.id}">✎</button><button class="mini" data-del-acct="${a.id}">🗑</button></span>
            </div>`).join("")}
          </div>
        </div>
      </section>`;
  }

  function pageAnalytics() {
    const segs = Store.allocationByGroup();
    const byHolding = Store.holdings.filter((h) => h.class !== "cash")
      .map((h) => ({ label: h.symbol, value: Store.holdingPL(h), color: h.color }))
      .sort((a, b) => b.value - a.value);
    const byAccount = Store.accounts.map((a) => ({ label: a.name, value: Store.accountBalance(a.id), color: a.color }))
      .sort((a, b) => b.value - a.value);
    view.innerHTML = `
      <section class="grid-2">
        ${allocationPanel()}
        <div class="panel">
          <div class="panel-head"><div class="ph-title">口座別 評価額</div></div>
          <div class="bar-list">${Charts.barList(byAccount)}</div>
        </div>
      </section>
      <section class="grid-2">
        <div class="panel">
          <div class="panel-head"><div class="ph-title">銘柄別 評価損益</div></div>
          <div class="bar-list">${byHolding.length ? Charts.barList(byHolding) : emptyMini("データなし")}</div>
        </div>
        <div class="panel">
          <div class="panel-head"><div class="ph-title">パフォーマンス推移</div></div>
          <div class="chart-wrap" style="height:240px"><svg id="netChart" class="net-chart" preserveAspectRatio="none"></svg><div class="chart-tooltip" hidden></div></div>
        </div>
      </section>`;
    drawDonut();
    const svg = document.getElementById("netChart");
    if (svg) { Charts.lineChart(svg, Store.netWorthSeries("6M"), tfLabel); drawInLine(svg); }
  }

  function pageTransactions() {
    const txs = Store.transactions;
    view.innerHTML = `
      <section class="grid-1">
        <div class="panel">
          <div class="panel-head"><div class="ph-title">取引履歴 <span class="count">${txs.length}</span></div>
            <div class="head-tools">
              <select id="txFilter" class="mini-select">
                <option value="all">すべて</option><option value="buy">買い</option><option value="sell">売り</option>
                <option value="deposit">入金</option><option value="withdraw">出金</option>
              </select>
              <button class="btn primary sm" data-act="add-tx">+ 取引を記録</button>
            </div></div>
          <div class="table tx-table" id="txTable">
            <div class="thead"><span>日付</span><span>口座</span><span>種別</span><span>銘柄</span><span>数量</span><span>単価</span><span>金額</span><span></span></div>
            ${txs.map(txRow).join("") || emptyState("取引がありません", "取引を記録", "add-tx")}
          </div>
        </div>
      </section>`;
    const f = document.getElementById("txFilter");
    f && f.addEventListener("change", () => {
      const v = f.value;
      document.getElementById("txTable").querySelectorAll(".trow").forEach((r) => {
        r.style.display = (v === "all" || r.dataset.side === v) ? "" : "none";
      });
    });
  }

  function txRow(t) {
    const acct = Store.accountById(t.accountId);
    const buy = t.side === "buy" || t.side === "deposit";
    const label = { buy: "買い", sell: "売り", deposit: "入金", withdraw: "出金" }[t.side];
    const isCash = t.side === "deposit" || t.side === "withdraw";
    const amount = isCash ? (t.quantity || t.price) : (t.quantity * t.price);
    return `<div class="trow" data-id="${t.id}" data-side="${t.side}">
      <span>${escapeHtml(t.date)}</span>
      <span><span class="acct-mini" style="color:${acct?acct.color:"#888"}">${escapeHtml(acct ? acct.name : "—")}</span></span>
      <span><span class="tr-tag ${buy ? "tr-buy" : "tr-sell"}">${label}</span></span>
      <span><b>${escapeHtml(t.symbol)}</b></span>
      <span>${isCash ? "—" : fmtQty(t.quantity)}</span>
      <span>${isCash ? "—" : fmtJPY(t.price)}</span>
      <span class="td-val">${fmtJPY(amount)}</span>
      <span class="row-actions"><button class="mini" data-del-tx="${t.id}">🗑</button></span>
    </div>`;
  }

  function pageSettings() {
    const s = Store.settings;
    view.innerHTML = `
      <section class="grid-2">
        <div class="panel">
          <div class="panel-head"><div class="ph-title">表示設定</div></div>
          <form id="settingsForm" class="form-grid">
            <label class="field"><span class="field-label">表示名</span><input name="name" value="${escapeHtml(s.name)}"/></label>
            <label class="field"><span class="field-label">基準通貨</span>
              <select name="currency"><option ${s.currency==="JPY"?"selected":""}>JPY</option><option ${s.currency==="USD"?"selected":""}>USD</option></select></label>
            <div class="field"><button class="btn primary" type="submit">保存</button></div>
          </form>
        </div>
        <div class="panel">
          <div class="panel-head"><div class="ph-title">データ管理</div></div>
          <div class="settings-actions">
            <div class="sa-row"><div><b>エクスポート</b><small>全データをJSONで書き出し</small></div><button class="btn ghost" data-act="export">書き出し</button></div>
            <div class="sa-row"><div><b>インポート</b><small>JSONファイルから復元</small></div><button class="btn ghost" data-act="import">読み込み</button></div>
            <div class="sa-row"><div><b>初期化</b><small>サンプルデータに戻す</small></div><button class="btn danger" data-act="reset">リセット</button></div>
          </div>
        </div>
      </section>
      <section class="grid-1">
        <div class="panel">
          <div class="panel-head"><div class="ph-title">サマリー</div></div>
          <div class="summary-grid">
            <div><span>口座数</span><b>${Store.accounts.length}</b></div>
            <div><span>保有銘柄</span><b>${Store.holdings.length}</b></div>
            <div><span>取引件数</span><b>${Store.transactions.length}</b></div>
            <div><span>総資産</span><b>${fmtJPY(Store.totalValue())}</b></div>
          </div>
        </div>
      </section>`;
    document.getElementById("settingsForm").onsubmit = (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      Store.updateSettings({ name: fd.get("name"), currency: fd.get("currency") });
      toast("設定を保存しました");
    };
  }

  /* ---------------- empties ---------------- */
  const emptyMini = (msg) => `<div class="empty-mini">${msg}</div>`;
  const emptyState = (msg, btn, act) => `<div class="empty"><div class="empty-ic">◌</div><p>${msg}</p><button class="btn primary" data-act="${act}">+ ${btn}</button></div>`;

  /* ============================================================
     MODALS
     ============================================================ */
  function accountOptions() { return Store.accounts.map((a) => ({ value: a.id, label: a.name })); }

  function openAccountForm(acct) {
    openForm(acct ? "口座を編集" : "口座を追加", [
      { name: "name", label: "口座名", required: true, placeholder: "例: bitFlyer" },
      { name: "type", label: "種別", type: "select", options: [
        { value: "crypto", label: "暗号資産取引所" }, { value: "securities", label: "証券口座" }, { value: "bank", label: "銀行口座" }] },
      { name: "logo", label: "アイコン(1文字)", placeholder: "₿ / ▤ / ▦" },
      { name: "color", label: "カラー", type: "color" },
    ], acct, (data) => {
      if (acct) { Store.updateAccount(acct.id, data); toast("口座を更新しました"); }
      else { Store.addAccount(data); toast("口座を追加しました"); }
    });
  }

  function openHoldingForm(holding) {
    if (!Store.accounts.length) { toast("先に口座を追加してください", "err"); return; }
    openForm(holding ? "保有を編集" : "保有を追加", [
      { name: "accountId", label: "口座", type: "select", options: accountOptions() },
      { name: "class", label: "種別", type: "select", options: [
        { value: "crypto", label: "暗号資産" }, { value: "stock", label: "株式" }, { value: "fund", label: "投資信託" }, { value: "cash", label: "現金・預金" }] },
      { name: "symbol", label: "シンボル", required: true, placeholder: "BTC / VTI / 7203" },
      { name: "name", label: "名称", placeholder: "Bitcoin" },
      { name: "quantity", label: "数量", type: "number", step: "any", required: true, min: 0 },
      { name: "price", label: "現在値(円)", type: "number", step: "any", min: 0, when: (f) => f.elements.class.value !== "cash" },
      { name: "costBasis", label: "平均取得単価(円)", type: "number", step: "any", min: 0, when: (f) => f.elements.class.value !== "cash" },
    ], holding, (data) => {
      if (data.class === "cash") { data.price = 1; data.costBasis = 1; }
      if (holding) { Store.updateHolding(holding.id, data); toast("保有を更新しました"); }
      else { Store.addHolding(data); toast("保有を追加しました"); }
    });
  }

  function openTxForm() {
    if (!Store.accounts.length) { toast("先に口座を追加してください", "err"); return; }
    const today = (() => { try { return new Date().toISOString().slice(0, 10); } catch (e) { return "2026-06-19"; } })();
    openForm("取引を記録", [
      { name: "date", label: "日付", type: "date", value: today, required: true },
      { name: "accountId", label: "口座", type: "select", options: accountOptions() },
      { name: "side", label: "種別", type: "select", options: [
        { value: "buy", label: "買い" }, { value: "sell", label: "売り" }, { value: "deposit", label: "入金" }, { value: "withdraw", label: "出金" }] },
      { name: "symbol", label: "銘柄", required: true, placeholder: "BTC / 入出金は JPY", value: "" },
      { name: "quantity", label: "数量 / 金額", type: "number", step: "any", required: true, min: 0, help: "入出金の場合は金額(円)を入力" },
      { name: "price", label: "単価(円)", type: "number", step: "any", min: 0, when: (f) => f.elements.side.value === "buy" || f.elements.side.value === "sell" },
      { name: "note", label: "メモ", placeholder: "積立 / 利確 など" },
    ], { side: "buy", symbol: "" }, (data) => {
      data.quantity = +data.quantity || 0;
      data.price = +data.price || 0;
      Store.addTransaction(data);
      toast("取引を記録しました");
    }, { okLabel: "記録" });
  }

  /* ---------- API連携（接続フロー・スキャフォルド） ---------- */
  const PROVIDERS = [
    { name: "bitFlyer", type: "crypto", color: "#f0a020", logo: "₿" },
    { name: "Coincheck", type: "crypto", color: "#11a4d8", logo: "C" },
    { name: "Binance", type: "crypto", color: "#f3ba2f", logo: "◆" },
    { name: "GMOコイン", type: "crypto", color: "#0a8f5b", logo: "G" },
    { name: "SBI証券", type: "securities", color: "#3b82f6", logo: "▤" },
    { name: "楽天証券", type: "securities", color: "#bf2d2d", logo: "▤" },
    { name: "マネックス証券", type: "securities", color: "#1463b6", logo: "▤" },
    { name: "楽天銀行", type: "bank", color: "#bf2d2d", logo: "▦" },
    { name: "住信SBIネット銀行", type: "bank", color: "#10b981", logo: "▦" },
    { name: "三菱UFJ銀行", type: "bank", color: "#e60012", logo: "▦" },
  ];

  function openConnectFlow() {
    UI.openModal("口座を接続", `
      <div class="connect-note">APIキーは<b>読み取り専用</b>を推奨します。このデモ環境では<b>キーは保存されず</b>、口座の枠だけが作成されます。実データの自動同期は今後のAPI連携で対応します。</div>
      <div class="provider-grid">${PROVIDERS.map((p, i) => `
        <div class="provider" data-pi="${i}">
          <span class="hold-logo sm" style="background:${p.color}22;color:${p.color}">${escapeHtml(p.logo)}</span>
          <span><b>${escapeHtml(p.name)}</b><small>${Store.TYPE_LABEL[p.type]}</small></span>
        </div>`).join("")}</div>
      <a class="connect-manual" data-manual>手動で口座を追加 →</a>`,
      { wide: true, onMount(ov) {
        ov.querySelectorAll(".provider").forEach((el) => el.onclick = () => {
          const p = PROVIDERS[+el.dataset.pi]; UI.closeModal(); openConnectForm(p);
        });
        ov.querySelector("[data-manual]").onclick = () => { UI.closeModal(); openAccountForm(); };
      } });
  }
  function openConnectForm(p) {
    openForm(`${p.name} と接続`, [
      { name: "apiKey", label: "APIキー（読み取り専用）", required: true, placeholder: "例: 8f2c…" },
      { name: "apiSecret", label: "APIシークレット", type: "password", placeholder: "••••••••", help: "デモ環境では保存されません" },
    ], {}, () => {
      Store.addAccount({ name: p.name, type: p.type, color: p.color, logo: p.logo });
      toast(`${p.name} を接続しました（デモ）`);
    }, { okLabel: "接続" });
  }

  /* ============================================================
     GLOBAL INTERACTIONS (event delegation)
     ============================================================ */
  document.addEventListener("click", (e) => {
    const act = e.target.closest("[data-act]");
    if (act) {
      const a = act.dataset.act;
      if (a === "add-account") return openAccountForm();
      if (a === "add-holding") return openHoldingForm();
      if (a === "add-tx") return openTxForm();
      if (a === "export") return doExport();
      if (a === "import") return doImport();
      if (a === "reset") return doReset();
    }
    // route links
    const link = e.target.closest("[data-route]");
    if (link) { e.preventDefault(); location.hash = link.dataset.route; return; }

    // row edit/delete — holdings
    const eh = e.target.closest("[data-edit]");
    if (eh) return openHoldingForm(Store.holdings.find((h) => h.id === eh.dataset.edit));
    const dh = e.target.closest("[data-del]");
    if (dh) return confirmDialog("この保有を削除しますか？").then((ok) => { if (ok) { Store.deleteHolding(dh.dataset.del); toast("削除しました"); } });
    // accounts
    const ea = e.target.closest("[data-edit-acct]");
    if (ea) return openAccountForm(Store.accountById(ea.dataset.editAcct));
    const da = e.target.closest("[data-del-acct]");
    if (da) return confirmDialog("口座を削除すると、紐づく保有・取引も削除されます。続行しますか？").then((ok) => { if (ok) { Store.deleteAccount(da.dataset.delAcct); toast("口座を削除しました"); } });
    // tx
    const dt = e.target.closest("[data-del-tx]");
    if (dt) return confirmDialog("この取引を削除しますか？").then((ok) => { if (ok) { Store.deleteTransaction(dt.dataset.delTx); toast("削除しました"); } });
  });

  // topbar buttons
  function applyTheme(t) {
    document.documentElement.dataset.theme = t;
    try { localStorage.setItem("beetfolio:theme", t); } catch (e) {}
    const b = document.getElementById("themeBtn");
    if (b) { b.textContent = t === "light" ? "☾" : "☀"; b.title = t === "light" ? "ダークに切替" : "ライトに切替"; }
    paint(false);
  }
  document.getElementById("themeBtn").onclick = () =>
    applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");

  document.getElementById("connectBtn").onclick = () => openConnectFlow();
  document.getElementById("syncBtn").onclick = () => { Store.refreshPrices(); toast("価格を更新しました"); };
  document.getElementById("searchBtn").onclick = openSearch;
  document.getElementById("notifBtn").onclick = (e) => openNotifications(e.currentTarget);
  document.getElementById("profileBtn").onclick = (e) => openProfile(e.currentTarget);

  function openSearch() {
    UI.openModal("検索", `<input id="searchInput" class="search-input" placeholder="銘柄・口座名で検索…" autocomplete="off"/>
      <div id="searchResults" class="search-results"></div>`, {
      onMount(ov) {
        const inp = ov.querySelector("#searchInput"), res = ov.querySelector("#searchResults");
        const render = () => {
          const q = inp.value.trim().toLowerCase();
          if (!q) { res.innerHTML = `<div class="empty-mini">キーワードを入力</div>`; return; }
          const hs = Store.holdings.filter((h) => (h.symbol + h.name).toLowerCase().includes(q));
          const as = Store.accounts.filter((a) => a.name.toLowerCase().includes(q));
          res.innerHTML = (as.map((a) => `<a class="sr-item" data-route="bank"><span class="hold-logo sm" style="background:${a.color}22;color:${a.color}">${escapeHtml(a.logo)}</span> ${escapeHtml(a.name)} <span class="sr-tag">口座</span></a>`).join("")
            + hs.map((h) => `<a class="sr-item" data-route="${h.class==="crypto"?"crypto":h.class==="cash"?"bank":"stocks"}"><span class="hold-logo sm" style="background:${h.color}22;color:${h.color}">${escapeHtml(h.logo||"?")}</span> <b>${escapeHtml(h.symbol)}</b> ${escapeHtml(h.name)} <span class="sr-tag">${fmtJPY(Store.holdingValue(h))}</span></a>`).join(""))
            || `<div class="empty-mini">該当なし</div>`;
        };
        inp.oninput = render; render();
        res.onclick = (e) => { const it = e.target.closest("[data-route]"); if (it) { location.hash = it.dataset.route; UI.closeModal(); } };
      },
    });
  }

  function openNotifications(anchor) {
    popover(anchor, `<div class="pop-head">通知</div>
      <div class="pop-item"><span class="pop-dot" style="background:var(--green)"></span><div><b>同期完了</b><small>全口座の残高を更新しました</small></div></div>
      <div class="pop-item"><span class="pop-dot" style="background:var(--cyan)"></span><div><b>BTC が +2.8%</b><small>保有資産が増加しています</small></div></div>
      <div class="pop-item"><span class="pop-dot" style="background:var(--magenta)"></span><div><b>積立予定</b><small>eMAXIS の積立日が近づいています</small></div></div>`);
  }

  function openProfile(anchor) {
    popover(anchor, `<div class="pop-head">${escapeHtml(Store.settings.name)}</div>
      <a class="pop-link" data-route="settings">⚙ 設定</a>
      <a class="pop-link" data-act="export">⤓ データを書き出し</a>
      <a class="pop-link" data-route="analytics">◐ 分析を見る</a>`);
  }

  /* ---------- data management ---------- */
  function doExport() {
    try {
      const blob = new Blob([Store.exportJSON()], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = "beetfolio-data.json"; a.click();
      URL.revokeObjectURL(url);
      toast("エクスポートしました");
    } catch (err) { toast("エクスポートに失敗しました", "err"); }
  }
  function doImport() {
    const input = document.createElement("input");
    input.type = "file"; input.accept = "application/json,.json";
    input.onchange = () => {
      const file = input.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try { Store.importJSON(reader.result); toast("インポートしました"); }
        catch (err) { toast("インポートに失敗: " + err.message, "err"); }
      };
      reader.readAsText(file);
    };
    input.click();
  }
  function doReset() {
    confirmDialog("すべてのデータをサンプル状態に戻します。よろしいですか？", { okLabel: "リセット" })
      .then((ok) => { if (ok) { Store.reset(); toast("初期化しました"); } });
  }

  /* ============================================================
     ROUTER
     ============================================================ */
  const ROUTES = {
    dashboard: pageDashboard, networth: pageNetWorth, crypto: pageCrypto, stocks: pageStocks,
    bank: pageBank, analytics: pageAnalytics, transactions: pageTransactions, settings: pageSettings,
  };

  let currentRoute = "dashboard";
  function paint(animate) {
    shouldAnimate = animate;
    view.classList.toggle("animate-in", animate);
    ROUTES[currentRoute]();
    enhance();
    shouldAnimate = false;
  }
  function render() {
    const route = (location.hash.slice(1) || "dashboard");
    currentRoute = ROUTES[route] ? route : "dashboard";
    document.querySelectorAll("#nav .nav-item").forEach((n) => n.classList.toggle("active", n.dataset.route === currentRoute));
    const meta = PAGE[currentRoute];
    document.getElementById("pageTitle").textContent = meta.title;
    document.getElementById("pageSub").textContent = meta.sub;
    view.scrollTop = 0;
    paint(true);
  }

  // re-render current page on data change (no entrance animation)
  Store.subscribe(() => {
    paint(false);
    syncTopbar();
  });

  function syncTopbar() {
    const s = Store.settings;
    document.getElementById("pfName").innerHTML = `${escapeHtml(s.name)} <span class="caret">▾</span>`;
    document.getElementById("avatar").textContent = (s.name || "U").slice(0, 2).toUpperCase();
    document.getElementById("syncSub").textContent = `最終同期 ${s.lastSync || "—"} • 全口座 正常`;
  }

  function tickClock() {
    const el = document.getElementById("clock"); if (!el) return;
    try {
      const d = new Date(); const p = (n) => String(n).padStart(2, "0");
      el.textContent = `${d.getFullYear()}/${p(d.getMonth() + 1)}/${p(d.getDate())} • ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())} (JST)`;
    } catch (e) { el.textContent = "2026/06/19 (JST)"; }
  }

  window.addEventListener("hashchange", render);
  window.addEventListener("resize", () => { if (document.getElementById("netChart")) drawNetChart(); });

  // boot
  (function initThemeIcon() {
    const t = document.documentElement.dataset.theme || "light";
    const b = document.getElementById("themeBtn");
    if (b) { b.textContent = t === "light" ? "☾" : "☀"; b.title = t === "light" ? "ダークに切替" : "ライトに切替"; }
  })();
  syncTopbar();
  render();
  tickClock(); setInterval(tickClock, 1000);
})();
