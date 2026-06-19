/* ============================================================
   Beetfolio — UI primitives: formatting, modal, form, toast, confirm
   ============================================================ */
(function (global) {
  "use strict";

  const fmtJPY = (n) => "¥" + Math.round(n || 0).toLocaleString("ja-JP");
  const fmtSigned = (n, suffix = "%") => (n >= 0 ? "+" : "") + (n || 0).toFixed(2) + suffix;
  const fmtSignedJPY = (n) => (n >= 0 ? "+" : "−") + "¥" + Math.abs(Math.round(n || 0)).toLocaleString("ja-JP");
  const fmtQty = (n) => {
    if (n == null) return "—";
    if (Number.isInteger(n)) return n.toLocaleString("ja-JP");
    return n.toLocaleString("ja-JP", { maximumFractionDigits: 6 });
  };
  const escapeHtml = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- toast ----------
  function toast(msg, type = "ok") {
    let host = document.getElementById("toastHost");
    if (!host) { host = document.createElement("div"); host.id = "toastHost"; document.body.appendChild(host); }
    const t = document.createElement("div");
    t.className = "toast toast-" + type;
    t.innerHTML = `<span class="toast-ic">${type === "ok" ? "✓" : type === "err" ? "!" : "i"}</span><span>${escapeHtml(msg)}</span>`;
    host.appendChild(t);
    requestAnimationFrame(() => t.classList.add("show"));
    setTimeout(() => { t.classList.remove("show"); setTimeout(() => t.remove(), 300); }, 2800);
  }

  // ---------- modal ----------
  function closeModal() {
    const ov = document.getElementById("modalOverlay");
    if (ov) { ov.classList.remove("show"); setTimeout(() => ov.remove(), 200); }
  }
  function openModal(title, bodyHTML, { footer, onMount, wide } = {}) {
    closeModal();
    const ov = document.createElement("div");
    ov.id = "modalOverlay"; ov.className = "modal-overlay";
    ov.innerHTML = `
      <div class="modal ${wide ? "modal-wide" : ""}" role="dialog" aria-modal="true">
        <div class="modal-head">
          <h3>${escapeHtml(title)}</h3>
          <button class="modal-x" aria-label="閉じる">✕</button>
        </div>
        <div class="modal-body">${bodyHTML}</div>
        ${footer ? `<div class="modal-foot">${footer}</div>` : ""}
      </div>`;
    document.body.appendChild(ov);
    requestAnimationFrame(() => ov.classList.add("show"));
    ov.querySelector(".modal-x").onclick = closeModal;
    ov.onclick = (e) => { if (e.target === ov) closeModal(); };
    document.addEventListener("keydown", function esc(e) { if (e.key === "Escape") { closeModal(); document.removeEventListener("keydown", esc); } });
    if (onMount) onMount(ov);
    return ov;
  }

  // ---------- confirm ----------
  function confirmDialog(message, { danger = true, okLabel = "削除" } = {}) {
    return new Promise((resolve) => {
      const ov = openModal("確認", `<p class="confirm-msg">${escapeHtml(message)}</p>`, {
        footer: `<button class="btn ghost" data-act="cancel">キャンセル</button>
                 <button class="btn ${danger ? "danger" : "primary"}" data-act="ok">${escapeHtml(okLabel)}</button>`,
      });
      ov.querySelector('[data-act="cancel"]').onclick = () => { closeModal(); resolve(false); };
      ov.querySelector('[data-act="ok"]').onclick = () => { closeModal(); resolve(true); };
    });
  }

  // ---------- form modal ----------
  // fields: [{name,label,type,options,required,value,step,placeholder,help,when}]
  function formField(f, values) {
    const v = values && values[f.name] != null ? values[f.name] : (f.value != null ? f.value : "");
    const req = f.required ? "required" : "";
    let input;
    if (f.type === "select") {
      input = `<select name="${f.name}" ${req}>${f.options.map((o) => `<option value="${escapeHtml(o.value)}" ${String(o.value) === String(v) ? "selected" : ""}>${escapeHtml(o.label)}</option>`).join("")}</select>`;
    } else if (f.type === "textarea") {
      input = `<textarea name="${f.name}" rows="2" placeholder="${escapeHtml(f.placeholder || "")}">${escapeHtml(v)}</textarea>`;
    } else if (f.type === "color") {
      input = `<input type="color" name="${f.name}" value="${escapeHtml(v || "#a78bfa")}" />`;
    } else {
      input = `<input type="${f.type || "text"}" name="${f.name}" value="${escapeHtml(v)}" ${req}
        ${f.step ? `step="${f.step}"` : ""} ${f.min != null ? `min="${f.min}"` : ""} placeholder="${escapeHtml(f.placeholder || "")}" />`;
    }
    return `<label class="field" data-field="${f.name}">
      <span class="field-label">${escapeHtml(f.label)}${f.required ? ' <em>*</em>' : ""}</span>
      ${input}
      ${f.help ? `<span class="field-help">${escapeHtml(f.help)}</span>` : ""}
    </label>`;
  }

  function openForm(title, fields, values, onSubmit, { okLabel = "保存" } = {}) {
    const body = `<form id="modalForm" class="form-grid">${fields.map((f) => formField(f, values)).join("")}</form>`;
    const ov = openModal(title, body, {
      footer: `<button class="btn ghost" data-act="cancel">キャンセル</button>
               <button class="btn primary" data-act="save">${escapeHtml(okLabel)}</button>`,
      onMount(ov) {
        const form = ov.querySelector("#modalForm");
        const submit = () => {
          if (!form.reportValidity()) return;
          const data = {};
          fields.forEach((f) => {
            let val = form.elements[f.name].value;
            if (f.type === "number") val = val === "" ? null : +val;
            data[f.name] = val;
          });
          Promise.resolve(onSubmit(data)).then((ok) => { if (ok !== false) closeModal(); });
        };
        ov.querySelector('[data-act="save"]').onclick = submit;
        ov.querySelector('[data-act="cancel"]').onclick = closeModal;
        form.onsubmit = (e) => { e.preventDefault(); submit(); };
        // live field toggles
        if (fields.some((f) => f.when)) {
          const refresh = () => {
            fields.forEach((f) => {
              if (!f.when) return;
              const wrap = form.querySelector(`[data-field="${f.name}"]`);
              wrap.style.display = f.when(form) ? "" : "none";
            });
          };
          form.addEventListener("input", refresh); refresh();
        }
        const first = form.querySelector("input,select,textarea");
        if (first) first.focus();
      },
    });
    return ov;
  }

  // ---------- dropdown (anchored popover) ----------
  function popover(anchor, html) {
    document.querySelectorAll(".popover").forEach((p) => p.remove());
    const pop = document.createElement("div");
    pop.className = "popover";
    pop.innerHTML = html;
    document.body.appendChild(pop);
    const r = anchor.getBoundingClientRect();
    pop.style.top = r.bottom + 8 + "px";
    pop.style.right = (window.innerWidth - r.right) + "px";
    const close = (e) => { if (!pop.contains(e.target) && e.target !== anchor) { pop.remove(); document.removeEventListener("mousedown", close); } };
    setTimeout(() => document.addEventListener("mousedown", close), 0);
    return pop;
  }

  global.UI = { fmtJPY, fmtSigned, fmtSignedJPY, fmtQty, escapeHtml, toast, openModal, closeModal, confirmDialog, openForm, popover };
})(window);
