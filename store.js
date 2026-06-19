/* ============================================================
   Beetfolio — data store (localStorage backed)
   将来 API/DB に差し替える際は、ここのCRUDと selectors を
   サーバ呼び出しに置き換えるだけで上位UIはほぼ無改修で済む。
   ============================================================ */
(function (global) {
  "use strict";

  const KEY = "beetfolio:v1";

  // ---- seed (初期ダミーデータ) ----
  const SEED = {
    settings: { currency: "JPY", name: "Trader K.", lastSync: "2026/06/19 10:30" },
    accounts: [
      { id: "a_bf", name: "bitFlyer", type: "crypto", color: "#f0a020", logo: "₿" },
      { id: "a_sbi", name: "SBI証券", type: "securities", color: "#3b82f6", logo: "▤" },
      { id: "a_rk", name: "楽天銀行", type: "bank", color: "#bf2d2d", logo: "▦" },
      { id: "a_bn", name: "Binance", type: "crypto", color: "#f3ba2f", logo: "◆" },
      { id: "a_ss", name: "住信SBIネット銀行", type: "bank", color: "#10b981", logo: "▦" },
    ],
    holdings: [
      { id: "h_btc", accountId: "a_bf", class: "crypto", symbol: "BTC", name: "Bitcoin", quantity: 0.412, price: 10000000, costBasis: 8600000, logo: "₿", color: "#f0a020" },
      { id: "h_eth", accountId: "a_bn", class: "crypto", symbol: "ETH", name: "Ethereum", quantity: 9.2, price: 227000, costBasis: 240000, logo: "◆", color: "#7c83ff" },
      { id: "h_sol", accountId: "a_bn", class: "crypto", symbol: "SOL", name: "Solana", quantity: 72, price: 13620, costBasis: 9800, logo: "◇", color: "#14f195" },
      { id: "h_vti", accountId: "a_sbi", class: "stock", symbol: "VTI", name: "全米株式ETF", quantity: 18, price: 128361, costBasis: 119000, logo: "▤", color: "#2de2e6" },
      { id: "h_toyota", accountId: "a_sbi", class: "stock", symbol: "7203", name: "トヨタ自動車", quantity: 800, price: 3213, costBasis: 2780, logo: "車", color: "#e11d48" },
      { id: "h_emx", accountId: "a_sbi", class: "fund", symbol: "eMAXIS", name: "S&P500 投信", quantity: 100, price: 18400, costBasis: 15200, logo: "投", color: "#10b981" },
      { id: "h_cash_rk", accountId: "a_rk", class: "cash", symbol: "JPY", name: "普通預金", quantity: 3120000, price: 1, costBasis: 1, logo: "¥", color: "#bf2d2d" },
      { id: "h_cash_ss", accountId: "a_ss", class: "cash", symbol: "JPY", name: "普通+定期", quantity: 741000, price: 1, costBasis: 1, logo: "¥", color: "#10b981" },
    ],
    transactions: [
      { id: "t1", date: "2026-06-19", accountId: "a_bf", side: "buy", symbol: "BTC", quantity: 0.012, price: 10000000, note: "積立" },
      { id: "t2", date: "2026-06-19", accountId: "a_bn", side: "sell", symbol: "ETH", quantity: 1.5, price: 227000, note: "" },
      { id: "t3", date: "2026-06-18", accountId: "a_sbi", side: "buy", symbol: "VTI", quantity: 3, price: 128000, note: "" },
      { id: "t4", date: "2026-06-18", accountId: "a_bn", side: "buy", symbol: "SOL", quantity: 10, price: 13500, note: "" },
      { id: "t5", date: "2026-06-17", accountId: "a_bf", side: "sell", symbol: "BTC", quantity: 0.005, price: 9900000, note: "利確" },
      { id: "t6", date: "2026-06-16", accountId: "a_sbi", side: "buy", symbol: "eMAXIS", quantity: 3, price: 18000, note: "積立" },
    ],
  };

  // ---- persistence ----
  let state = load();

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* ignore */ }
    return structuredClone(SEED);
  }
  function save() {
    localStorage.setItem(KEY, JSON.stringify(state));
    emit();
  }

  // ---- pub/sub ----
  const subs = new Set();
  function subscribe(fn) { subs.add(fn); return () => subs.delete(fn); }
  function emit() { subs.forEach((fn) => fn(state)); }

  const uid = (p) => p + "_" + Math.random().toString(36).slice(2, 9);

  // ---- helpers ----
  const CLASS_LABEL = { crypto: "暗号資産", stock: "株式", fund: "投資信託", cash: "現金・預金" };
  const CLASS_GROUP = { crypto: "暗号資産", stock: "株式・投信", fund: "株式・投信", cash: "現金・預金" };
  const CLASS_COLOR = { crypto: "#a78bfa", stock: "#2de2e6", fund: "#36cfa0", cash: "#ff4d9d" };
  const TYPE_LABEL = { crypto: "暗号資産取引所", securities: "証券口座", bank: "銀行口座" };
  const TYPE_TO_CLASS = { crypto: "crypto", securities: "stock", bank: "cash" };

  const holdingValue = (h) => h.quantity * h.price;
  const holdingCost = (h) => h.quantity * h.costBasis;
  const holdingPL = (h) => holdingValue(h) - holdingCost(h);
  const holdingPLPct = (h) => (holdingCost(h) ? (holdingPL(h) / holdingCost(h)) * 100 : 0);

  // ---- selectors ----
  function totalValue() { return state.holdings.reduce((s, h) => s + holdingValue(h), 0); }
  function cashTotal() { return state.holdings.filter((h) => h.class === "cash").reduce((s, h) => s + holdingValue(h), 0); }
  function unrealizedPL() { return state.holdings.filter((h) => h.class !== "cash").reduce((s, h) => s + holdingPL(h), 0); }
  function unrealizedCost() { return state.holdings.filter((h) => h.class !== "cash").reduce((s, h) => s + holdingCost(h), 0); }

  function accountBalance(id) { return state.holdings.filter((h) => h.accountId === id).reduce((s, h) => s + holdingValue(h), 0); }
  function accountById(id) { return state.accounts.find((a) => a.id === id); }

  function allocationByGroup() {
    const map = {};
    state.holdings.forEach((h) => {
      const g = CLASS_GROUP[h.class];
      map[g] = (map[g] || 0) + holdingValue(h);
    });
    const total = totalValue() || 1;
    const colors = { "暗号資産": "#a78bfa", "株式・投信": "#2de2e6", "現金・預金": "#ff4d9d" };
    return Object.entries(map).map(([name, val]) => ({
      name, val, pct: +(val / total * 100).toFixed(1), color: colors[name] || "#8b90a8",
    })).sort((a, b) => b.val - a.val);
  }

  function holdingsByClass(classes) {
    return state.holdings.filter((h) => classes.includes(h.class))
      .sort((a, b) => holdingValue(b) - holdingValue(a));
  }

  function kpis() {
    const total = totalValue();
    const series = netWorthSeries("1M");
    const monthStart = series[0].v;
    const monthChange = total - monthStart;
    const pl = unrealizedPL();
    const cost = unrealizedCost();
    return {
      total,
      monthChange,
      monthChangePct: monthStart ? (monthChange / monthStart) * 100 : 0,
      unrealizedPL: pl,
      unrealizedPLPct: cost ? (pl / cost) * 100 : 0,
      cashRatio: total ? (cashTotal() / total) * 100 : 0,
    };
  }

  // deterministic net-worth history anchored to current total
  function seededSeries(points, vol, seed) {
    let s = seed; const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const out = []; let v = 1;
    for (let i = 0; i < points; i++) { v += (rand() - 0.46) * vol; out.push(v); }
    return out;
  }
  const TF_POINTS = { "1W": 7, "1M": 30, "3M": 90, "6M": 180, "1Y": 365, "ALL": 500 };
  const TF_DROP = { "1W": 0.04, "1M": 0.09, "3M": 0.18, "6M": 0.28, "1Y": 0.42, "ALL": 0.62 };
  function netWorthSeries(tf) {
    const total = totalValue();
    const n = TF_POINTS[tf] || 30;
    const raw = seededSeries(n, 0.025, ({ "1W": 11, "1M": 23, "3M": 37, "6M": 51, "1Y": 73, "ALL": 97 })[tf] || 23);
    // normalize 0..1 then map start≈total*(1-drop) .. end≈total
    const min = Math.min(...raw), max = Math.max(...raw), span = max - min || 1;
    const startVal = total * (1 - (TF_DROP[tf] || 0.1));
    const norm = raw.map((r) => (r - min) / span);
    const last = norm[norm.length - 1];
    return norm.map((r, i) => {
      // shift so last point equals total
      const base = startVal + (total - startVal) * r;
      const v = base + (total - (startVal + (total - startVal) * last));
      return { i, v: Math.max(v, total * 0.3) };
    });
  }

  // ---- mutations ----
  function applyTransaction(tx) {
    const acct = accountById(tx.accountId);
    if (!acct) return;
    const q = +tx.quantity, p = +tx.price;
    if (tx.side === "deposit" || tx.side === "withdraw") {
      let cash = state.holdings.find((h) => h.accountId === tx.accountId && h.class === "cash");
      if (!cash) {
        cash = { id: uid("h"), accountId: tx.accountId, class: "cash", symbol: "JPY", name: "現金", quantity: 0, price: 1, costBasis: 1, logo: "¥", color: acct.color };
        state.holdings.push(cash);
      }
      cash.quantity += (tx.side === "deposit" ? 1 : -1) * (q || p || 0);
      cash.quantity = Math.max(0, cash.quantity);
      return;
    }
    let h = state.holdings.find((x) => x.accountId === tx.accountId && x.symbol.toUpperCase() === tx.symbol.toUpperCase());
    if (tx.side === "buy") {
      if (h) {
        const newQ = h.quantity + q;
        h.costBasis = newQ ? (holdingCost(h) + q * p) / newQ : p;
        h.quantity = newQ;
        h.price = p;
      } else {
        const cls = TYPE_TO_CLASS[acct.type] || "stock";
        state.holdings.push({ id: uid("h"), accountId: tx.accountId, class: cls, symbol: tx.symbol.toUpperCase(), name: tx.symbol.toUpperCase(), quantity: q, price: p, costBasis: p, logo: tx.symbol[0] || "?", color: CLASS_COLOR[cls] });
      }
    } else if (tx.side === "sell" && h) {
      h.quantity = Math.max(0, h.quantity - q);
      h.price = p;
    }
  }

  const Store = {
    CLASS_LABEL, CLASS_GROUP, CLASS_COLOR, TYPE_LABEL, TYPE_TO_CLASS,
    subscribe,
    get state() { return state; },
    get accounts() { return state.accounts; },
    get holdings() { return state.holdings; },
    get transactions() { return [...state.transactions].sort((a, b) => (a.date < b.date ? 1 : -1)); },
    get settings() { return state.settings; },

    holdingValue, holdingCost, holdingPL, holdingPLPct,
    totalValue, cashTotal, unrealizedPL, unrealizedCost,
    accountBalance, accountById, allocationByGroup, holdingsByClass, kpis, netWorthSeries,

    // account CRUD
    addAccount(data) {
      state.accounts.push({ id: uid("a"), logo: data.logo || (data.type === "crypto" ? "◆" : data.type === "bank" ? "▦" : "▤"), color: data.color || "#a78bfa", ...data });
      save();
    },
    updateAccount(id, data) { Object.assign(accountById(id), data); save(); },
    deleteAccount(id) {
      state.accounts = state.accounts.filter((a) => a.id !== id);
      state.holdings = state.holdings.filter((h) => h.accountId !== id);
      state.transactions = state.transactions.filter((t) => t.accountId !== id);
      save();
    },

    // holding CRUD
    addHolding(data) {
      const cls = data.class || "stock";
      state.holdings.push({ id: uid("h"), logo: (data.symbol || "?")[0], color: CLASS_COLOR[cls], costBasis: data.costBasis ?? data.price, ...data, class: cls });
      save();
    },
    updateHolding(id, data) { Object.assign(state.holdings.find((h) => h.id === id), data); save(); },
    deleteHolding(id) { state.holdings = state.holdings.filter((h) => h.id !== id); save(); },

    // transaction CRUD (also mutates holdings)
    addTransaction(data) {
      const tx = { id: uid("t"), ...data };
      state.transactions.push(tx);
      applyTransaction(tx);
      save();
    },
    deleteTransaction(id) { state.transactions = state.transactions.filter((t) => t.id !== id); save(); },

    updateSettings(data) { Object.assign(state.settings, data); save(); },

    // price refresh simulation
    refreshPrices() {
      let s = (Date.now ? 1 : 1); // Date.now may be unavailable in some sandboxes; fall back
      let seed = 12345;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      state.holdings.forEach((h) => {
        if (h.class === "cash") return;
        const drift = (rnd() - 0.45) * 0.04; // ±~2%
        h.price = Math.max(1, Math.round(h.price * (1 + drift)));
      });
      try { state.settings.lastSync = new Date().toLocaleString("ja-JP", { hour: "2-digit", minute: "2-digit", year: "numeric", month: "2-digit", day: "2-digit" }); } catch (e) {}
      save();
    },

    // data management
    exportJSON() { return JSON.stringify(state, null, 2); },
    importJSON(json) {
      const parsed = typeof json === "string" ? JSON.parse(json) : json;
      if (!parsed.accounts || !parsed.holdings) throw new Error("不正なデータ形式です");
      state = parsed;
      save();
    },
    reset() { state = structuredClone(SEED); save(); },
  };

  global.Store = Store;
})(window);
