/* ============================================================================
   EZ EXAM · LIVE EXAM MODE
   Adds a Practice/Exam mode picker to each hub's Practice Exam setup screen.

   Practice Mode  → untouched: the hub's own instant-feedback flow.
   Exam Mode      → full simulation: 3–5 random PBQ scenarios first, then
                    MCQs, a real-exam countdown, NO feedback until submit,
                    partial-credit PBQ grading, and a full post-exam review.

   One engine, three hubs — selected via <script data-hub="..."> attribute.
   ========================================================================== */
(function () {
  "use strict";

  /* ------------------------------------------------------------------ *
   * Hub profiles (real-exam simulation parameters)
   * ------------------------------------------------------------------ */
  var PROFILES = {
    secplus: {
      name: "Security+ SY0-701",
      minutes: 90,
      total: 80,            // ≈ real exam length (max 90 incl. PBQs)
      passPct: 83,          // 750 / 900 scaled
      mcq: function () {
        return fetch("data/questions.json").then(function (r) { return r.json(); })
          .then(function (list) { return list.map(normStdMcq); });
      },
      pbq: function () {
        var bank = (window.PBQ_TEST || []).filter(function (p) {
          return p.type === "grid" || p.type === "dragdrop" || p.type === "logselect";
        });
        return Promise.resolve(bank);
      }
    },
    az900: {
      name: "Azure Fundamentals AZ-900",
      minutes: 45,
      total: 46,            // real exam: 40–60 questions in 45 min
      passPct: 70,          // 700 / 1000
      mcq: function () {
        return fetch("data/questions.json").then(function (r) { return r.json(); })
          .then(function (list) { return list.map(normStdMcq); });
      },
      pbq: function () {
        var bank = (window.PBQ_TEST || []).filter(function (p) {
          return p.type === "grid" || p.type === "dragdrop";
        });
        return Promise.resolve(bank);
      }
    },
    cysa: {
      name: "CySA+ CS0-003",
      minutes: 165,
      total: 70,            // real exam: max 85 incl. PBQs in 165 min
      passPct: 83,          // 750 / 900 scaled
      mcq: function () {
        return fetch("data/questions.json").then(function (r) { return r.json(); })
          .then(function (list) { return list.map(normCysaMcq); });
      },
      pbq: function () {
        return fetch("data/pbq.json").then(function (r) { return r.json(); })
          .then(function (d) { return Array.isArray(d) ? d : (d.pbqs || []); });
      }
    }
  };

  var scriptEl = document.currentScript;
  var HUB = scriptEl ? scriptEl.getAttribute("data-hub") : null;
  var P = PROFILES[HUB];
  if (!P) return;

  /* ------------------------------------------------------------------ *
   * Normalizers → common MCQ model {stem, options:[{key,text}], correct:Set,
   *                                 multi, explanation, exhibit}
   * ------------------------------------------------------------------ */
  function normStdMcq(q) {
    var opts = Object.keys(q.options || {}).sort().map(function (k) {
      return { key: k, text: q.options[k] };
    });
    return {
      stem: q.question, options: opts,
      correct: (q.correct || []).slice(),
      multi: (q.correct || []).length > 1,
      explanation: q.explanation || "", exhibit: null
    };
  }
  function normCysaMcq(q) {
    var opts = Object.keys(q.choices || {}).sort().map(function (k) {
      return { key: k, text: q.choices[k] };
    });
    var letters = String(q.answer || "").replace(/[^A-Z]/g, "").split("");
    var ex = q.exhibit && q.exhibit !== "None" && q.exhibit !== "" ? q.exhibit : null;
    if (ex && ex.indexOf("/") === -1) ex = "exhibits/" + ex;
    return {
      stem: q.question, options: opts,
      correct: letters, multi: letters.length > 1,
      explanation: q.explanation || "", exhibit: ex
    };
  }

  /* ------------------------------------------------------------------ *
   * Utilities
   * ------------------------------------------------------------------ */
  function shuffle(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }
  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html !== undefined) e.innerHTML = html;
    return e;
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function fmtTime(sec) {
    sec = Math.max(0, sec);
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    function p(n) { return (n < 10 ? "0" : "") + n; }
    return h > 0 ? h + ":" + p(m) + ":" + p(s) : p(m) + ":" + p(s);
  }
  function setEq(a, b) {
    if (a.length !== b.length) return false;
    var sb = {};
    b.forEach(function (x) { sb[x] = 1; });
    return a.every(function (x) { return sb[x]; });
  }

  /* ------------------------------------------------------------------ *
   * Styles (scoped under #ezx-root / .ezx-picker)
   * ------------------------------------------------------------------ */
  var CSS = "" +
    ".ezx-picker{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:12px;margin:18px 0 22px}" +
    ".ezx-mode{position:relative;text-align:left;font:inherit;color:inherit;cursor:pointer;border-radius:12px;padding:16px 16px 14px;background:var(--lab-bg-soft,var(--bg-soft,var(--bg-card,#1e293b)));border:2px solid var(--lab-border,var(--border,#334155));transition:border-color .15s ease,background .15s ease}" +
    ".ezx-mode:hover{border-color:var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)))}" +
    ".ezx-mode:focus-visible{outline:none;box-shadow:var(--focus-ring,0 0 0 3px rgba(129,140,248,.7))}" +
    ".ezx-mode.is-on{border-color:var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)));background:var(--lab-accent-bg,var(--accent-bg,rgba(99,102,241,.15)))}" +
    ".ezx-mode-tag{font-family:var(--lab-mono,monospace);font-size:.68rem;letter-spacing:.1em;text-transform:uppercase;color:var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)));display:block;margin-bottom:6px}" +
    ".ezx-mode-name{font-family:var(--lab-display,inherit);font-weight:700;font-size:1.08rem;display:block;margin-bottom:6px}" +
    ".ezx-mode-desc{font-size:.88rem;line-height:1.45;color:var(--lab-muted,var(--text-muted,#94a3b8));display:block}" +
    ".ezx-mode .ezx-check{position:absolute;top:12px;right:12px;width:20px;height:20px;border-radius:50%;border:2px solid var(--lab-border,var(--border,#334155));display:grid;place-items:center;font-size:.7rem;color:var(--lab-ink,#ffffff)}" +
    ".ezx-mode.is-on .ezx-check{background:var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)));border-color:var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)))}" +
    ".ezx-dim{opacity:.35;pointer-events:none;transition:opacity .2s ease}" +
    ".ezx-begin{display:inline-flex;align-items:center;gap:10px;font:inherit;font-weight:700;cursor:pointer;color:var(--lab-ink,#ffffff);background:var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)));border:1px solid var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)));border-radius:10px;padding:12px 22px;font-size:1rem}" +
    ".ezx-begin:hover{background:var(--lab-accent-strong,var(--accent-strong,var(--primary-light,#a5b4fc)))}" +
    ".ezx-begin:focus-visible{outline:none;box-shadow:var(--focus-ring,0 0 0 3px rgba(129,140,248,.7))}" +
    /* ---- overlay ---- */
    "#ezx-root{position:fixed;inset:0;z-index:9000;overflow-y:auto;background:var(--lab-bg,var(--bg,var(--bg-dark,#0f172a)));color:var(--lab-text,var(--text,var(--text-primary,#f8fafc)));font-family:var(--lab-body,inherit)}" +
    ".ezx-top{position:sticky;top:0;z-index:5;display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 22px;background:var(--lab-bg,var(--bg,var(--bg-dark,#0f172a)));border-bottom:1px solid var(--lab-border,var(--border,#334155))}" +
    ".ezx-live{font-family:var(--lab-mono,monospace);font-size:.7rem;letter-spacing:.12em;font-weight:600;color:var(--lab-ink,#ffffff);background:var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)));border-radius:6px;padding:4px 9px;white-space:nowrap}" +
    ".ezx-title{font-family:var(--lab-display,inherit);font-weight:700;font-size:.98rem;white-space:nowrap}" +
    ".ezx-prog{font-family:var(--lab-mono,monospace);font-size:.82rem;color:var(--lab-muted,var(--text-muted,#94a3b8))}" +
    ".ezx-timer{margin-left:auto;font-family:var(--lab-mono,monospace);font-variant-numeric:tabular-nums;font-size:1.15rem;font-weight:600;padding:4px 12px;border-radius:8px;border:1px solid var(--lab-border,var(--border,#334155))}" +
    ".ezx-timer.warn{color:oklch(0.67 0.18 27);border-color:oklch(0.67 0.18 27);animation:ezxPulse 1s steps(2,end) infinite}" +
    "@keyframes ezxPulse{50%{opacity:.55}}" +
    ".ezx-submit{font:inherit;font-weight:700;cursor:pointer;color:var(--lab-text,var(--text,var(--text-primary,#f8fafc)));background:transparent;border:1px solid var(--lab-border,var(--border,#334155));border-radius:8px;padding:8px 16px}" +
    ".ezx-submit:hover{border-color:var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)));color:var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)))}" +
    ".ezx-wrap{max-width:900px;margin:0 auto;padding:28px 22px 90px}" +
    ".ezx-dots{display:flex;flex-wrap:wrap;gap:5px;margin-bottom:22px}" +
    ".ezx-dot{width:17px;height:17px;border-radius:4px;border:1px solid var(--lab-border,var(--border,#334155));background:transparent;cursor:pointer;padding:0}" +
    ".ezx-dot.done{background:var(--lab-accent-bg,var(--accent-bg,rgba(99,102,241,.15)));border-color:var(--lab-accent-deep,var(--accent,var(--primary,#6366f1)))}" +
    ".ezx-dot.cur{outline:2px solid var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)));outline-offset:1px}" +
    ".ezx-kicker{font-family:var(--lab-mono,monospace);font-size:.72rem;letter-spacing:.1em;text-transform:uppercase;color:var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)));margin:0 0 10px}" +
    ".ezx-stem{font-size:1.12rem;line-height:1.6;margin:0 0 18px;font-weight:600}" +
    ".ezx-scenario{font-size:1rem;line-height:1.6;color:var(--lab-muted,var(--text-muted,#94a3b8));margin:0 0 16px}" +
    ".ezx-card{background:var(--lab-surface,var(--surface,var(--bg-card,#1e293b)));border:1px solid var(--lab-border,var(--border,#334155));border-radius:14px;padding:26px}" +
    ".ezx-opt{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:left;font:inherit;color:inherit;cursor:pointer;background:var(--lab-bg-soft,var(--bg-soft,var(--bg-card,#1e293b)));border:2px solid var(--lab-border,var(--border,#334155));border-radius:10px;padding:13px 15px;margin-bottom:9px;transition:border-color .12s ease,background .12s ease}" +
    ".ezx-opt:hover{border-color:var(--lab-accent-deep,var(--accent,var(--primary,#6366f1)))}" +
    ".ezx-opt:focus-visible{outline:none;box-shadow:var(--focus-ring,0 0 0 3px rgba(129,140,248,.7))}" +
    ".ezx-opt.sel{border-color:var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)));background:var(--lab-accent-bg,var(--accent-bg,rgba(99,102,241,.15)))}" +
    ".ezx-letter{flex:0 0 auto;font-family:var(--lab-mono,monospace);font-weight:600;font-size:.85rem;width:26px;height:26px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--lab-border,var(--border,#334155))}" +
    ".ezx-opt.sel .ezx-letter{background:var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)));color:var(--lab-ink,#ffffff);border-color:var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)))}" +
    ".ezx-multi-hint{font-size:.82rem;color:var(--lab-muted,var(--text-muted,#94a3b8));margin:0 0 12px;font-style:italic}" +
    ".ezx-table{width:100%;border-collapse:collapse;font-size:.92rem;margin-top:6px}" +
    ".ezx-table th{font-family:var(--lab-mono,monospace);font-size:.7rem;letter-spacing:.08em;text-transform:uppercase;color:var(--lab-muted,var(--text-muted,#94a3b8));text-align:left;padding:8px 10px;border-bottom:1px solid var(--lab-border,var(--border,#334155))}" +
    ".ezx-table td{padding:10px;border-bottom:1px solid var(--lab-border,var(--border,#334155));vertical-align:top}" +
    ".ezx-table select,.ezx-table input[type=text]{width:100%;min-width:110px;font:inherit;font-size:.88rem;color:var(--lab-text,var(--text,var(--text-primary,#f8fafc)));background:var(--lab-bg,var(--bg,var(--bg-dark,#0f172a)));border:1px solid var(--lab-border,var(--border,#334155));border-radius:7px;padding:7px 9px}" +
    ".ezx-table select:focus-visible,.ezx-table input:focus-visible{outline:none;box-shadow:var(--focus-ring,0 0 0 3px rgba(129,140,248,.7))}" +
    ".ezx-zone{margin-bottom:18px}" +
    ".ezx-zone-prompt{font-weight:600;margin:0 0 10px}" +
    ".ezx-chips{display:flex;flex-wrap:wrap;gap:8px}" +
    ".ezx-chip{font-family:var(--lab-mono,monospace);font-size:.82rem;cursor:pointer;color:inherit;background:var(--lab-bg-soft,var(--bg-soft,var(--bg-card,#1e293b)));border:1.5px solid var(--lab-border,var(--border,#334155));border-radius:8px;padding:8px 13px}" +
    ".ezx-chip[aria-pressed=true]{background:var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)));border-color:var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)));color:var(--lab-ink,#ffffff);font-weight:600}" +
    ".ezx-chip:focus-visible{outline:none;box-shadow:var(--focus-ring,0 0 0 3px rgba(129,140,248,.7))}" +
    ".ezx-log{font-family:var(--lab-mono,monospace);font-size:.78rem;line-height:1.5;display:block;width:100%;text-align:left;cursor:pointer;color:inherit;background:var(--lab-bg,var(--bg,var(--bg-dark,#0f172a)));border:1.5px solid var(--lab-border,var(--border,#334155));border-radius:7px;padding:8px 11px;margin-bottom:7px;word-break:break-all}" +
    ".ezx-log[aria-pressed=true]{border-color:var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)));background:var(--lab-accent-bg,var(--accent-bg,rgba(99,102,241,.15)))}" +
    ".ezx-img{max-width:100%;border:1px solid var(--lab-border,var(--border,#334155));border-radius:10px;margin:0 0 14px;display:block}" +
    ".ezx-nav{display:flex;gap:12px;justify-content:space-between;margin-top:22px}" +
    ".ezx-btn{font:inherit;font-weight:600;cursor:pointer;border-radius:9px;padding:11px 20px;border:1px solid var(--lab-border,var(--border,#334155));background:transparent;color:var(--lab-text,var(--text,var(--text-primary,#f8fafc)))}" +
    ".ezx-btn:hover{border-color:var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)))}" +
    ".ezx-btn:focus-visible{outline:none;box-shadow:var(--focus-ring,0 0 0 3px rgba(129,140,248,.7))}" +
    ".ezx-btn.pri{background:var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)));border-color:var(--lab-accent,var(--accent-strong,var(--primary-light,#818cf8)));color:var(--lab-ink,#ffffff);font-weight:700}" +
    ".ezx-btn.pri:hover{background:var(--lab-accent-strong,var(--accent-strong,var(--primary-light,#a5b4fc)))}" +
    ".ezx-btn:disabled{opacity:.4;cursor:default}" +
    ".ezx-modal-bg{position:fixed;inset:0;z-index:9500;background:oklch(0.1 0.01 245/.7);display:grid;place-items:center;padding:20px}" +
    ".ezx-modal{max-width:430px;width:100%;background:var(--lab-surface,var(--surface,var(--bg-card,#1e293b)));border:1px solid var(--lab-border,var(--border,#334155));border-radius:14px;padding:26px}" +
    ".ezx-modal h3{font-family:var(--lab-display,inherit);margin:0 0 10px}" +
    ".ezx-modal p{color:var(--lab-muted,var(--text-muted,#94a3b8));margin:0 0 20px;line-height:1.55}" +
    ".ezx-score{font-family:var(--lab-mono,monospace);font-variant-numeric:tabular-nums;font-size:3.4rem;font-weight:600;line-height:1;margin:8px 0 4px}" +
    ".ezx-pass{font-family:var(--lab-mono,monospace);font-size:.85rem;letter-spacing:.06em;padding:5px 12px;border-radius:999px;display:inline-block;margin:8px 0 20px}" +
    ".ezx-pass.ok{color:oklch(0.72 0.14 150);border:1px solid oklch(0.72 0.14 150)}" +
    ".ezx-pass.no{color:oklch(0.67 0.18 27);border:1px solid oklch(0.67 0.18 27)}" +
    ".ezx-rstats{display:flex;flex-wrap:wrap;gap:10px 26px;font-family:var(--lab-mono,monospace);font-size:.86rem;color:var(--lab-muted,var(--text-muted,#94a3b8));border-top:1px solid var(--lab-border,var(--border,#334155));padding-top:16px;margin-bottom:26px}" +
    ".ezx-rstats b{color:var(--lab-text,var(--text,var(--text-primary,#f8fafc)))}" +
    ".ezx-rev{border:1px solid var(--lab-border,var(--border,#334155));border-radius:12px;padding:18px 20px;margin-bottom:14px;background:var(--lab-surface,var(--surface,var(--bg-card,#1e293b)))}" +
    ".ezx-rev.good{border-left:4px solid oklch(0.72 0.14 150)}" +
    ".ezx-rev.bad{border-left:4px solid oklch(0.67 0.18 27)}" +
    ".ezx-rev.part{border-left:4px solid oklch(0.8 0.14 80)}" +
    ".ezx-rev-head{display:flex;gap:10px;align-items:baseline;flex-wrap:wrap;margin-bottom:8px}" +
    ".ezx-rev-num{font-family:var(--lab-mono,monospace);font-size:.78rem;color:var(--lab-muted,var(--text-muted,#94a3b8))}" +
    ".ezx-rev-score{font-family:var(--lab-mono,monospace);font-size:.78rem;margin-left:auto}" +
    ".ezx-rev-ans{font-size:.9rem;line-height:1.55;margin:8px 0 0}" +
    ".ezx-rev-ans b{font-weight:600}" +
    ".ezx-rev-exp{font-size:.88rem;line-height:1.55;color:var(--lab-muted,var(--text-muted,#94a3b8));margin:10px 0 0;border-top:1px dashed var(--lab-border,var(--border,#334155));padding-top:10px}" +
    "@media (prefers-reduced-motion: reduce){.ezx-timer.warn{animation:none}}";

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */
  var state = {
    mode: "practice",
    items: [],          // [{kind:'mcq'|'pbq', data, response}]
    idx: 0,
    secondsLeft: 0,
    timerId: null,
    startedAt: 0,
    active: false
  };

  /* ------------------------------------------------------------------ *
   * Mode picker injection
   * ------------------------------------------------------------------ */
  function injectPicker() {
    var setup = document.getElementById("exam-setup");
    if (!setup) return;

    var style = document.createElement("style");
    style.textContent = CSS;
    document.head.appendChild(style);

    var startBtn = HUB === "cysa"
      ? setup.querySelector(".btn-primary")
      : document.getElementById("start-btn");
    if (!startBtn) return;

    var pbqRange = "3–5";
    var picker = el("div", "ezx-picker");
    picker.setAttribute("role", "radiogroup");
    picker.setAttribute("aria-label", "Exam mode");

    function card(id, tag, name, desc) {
      var b = el("button", "ezx-mode", "");
      b.type = "button";
      b.id = id;
      b.setAttribute("role", "radio");
      b.innerHTML =
        '<span class="ezx-check" aria-hidden="true">✓</span>' +
        '<span class="ezx-mode-tag">' + tag + "</span>" +
        '<span class="ezx-mode-name">' + name + "</span>" +
        '<span class="ezx-mode-desc">' + desc + "</span>";
      return b;
    }

    var practiceCard = card("ezx-pick-practice", "Learn as you go", "Practice Mode",
      "Instant feedback — every answer is graded the moment you pick it, with the explanation shown right away. The classic hub experience.");
    var examCard = card("ezx-pick-exam", "Simulate exam day", "Exam Mode",
      "The real thing: <b>" + P.total + " questions</b>, a <b>" + P.minutes +
      "-minute countdown</b>, " + pbqRange + " random <b>PBQ scenarios up front</b>, and no feedback until you submit.");

    picker.appendChild(practiceCard);
    picker.appendChild(examCard);

    var begin = el("button", "ezx-begin", "Begin Live Exam <span aria-hidden=\"true\">→</span>");
    begin.type = "button";
    begin.style.display = "none";
    begin.addEventListener("click", launchExam);

    // Place the picker at the top of the setup card, and the Begin button
    // next to the hub's own (hidden-in-exam-mode) start button.
    var host = HUB === "cysa" ? setup.querySelector(".setup-card") || setup : setup;
    var anchor = host.querySelector("h1, h2");
    if (anchor && anchor.nextSibling) {
      // skip the intro paragraph if present
      var after = anchor.nextElementSibling && anchor.nextElementSibling.tagName === "P"
        ? anchor.nextElementSibling : anchor;
      after.insertAdjacentElement("afterend", picker);
    } else {
      host.insertBefore(picker, host.firstChild);
    }
    startBtn.insertAdjacentElement("afterend", begin);

    function dimTargets() {
      var sel = HUB === "cysa" ? ".form-group" : ".control";
      return Array.prototype.slice.call(host.querySelectorAll(sel));
    }
    function setMode(mode) {
      state.mode = mode;
      var exam = mode === "exam";
      practiceCard.classList.toggle("is-on", !exam);
      practiceCard.setAttribute("aria-checked", String(!exam));
      examCard.classList.toggle("is-on", exam);
      examCard.setAttribute("aria-checked", String(exam));
      startBtn.style.display = exam ? "none" : "";
      begin.style.display = exam ? "" : "none";
      dimTargets().forEach(function (n) { n.classList.toggle("ezx-dim", exam); });
    }
    practiceCard.addEventListener("click", function () { setMode("practice"); });
    examCard.addEventListener("click", function () { setMode("exam"); });
    setMode("practice");
  }

  /* ------------------------------------------------------------------ *
   * Exam assembly
   * ------------------------------------------------------------------ */
  function launchExam() {
    Promise.all([P.mcq(), P.pbq()]).then(function (res) {
      var mcqs = res[0], pbqs = res[1];
      var k = Math.min(3 + Math.floor(Math.random() * 3), pbqs.length); // 3–5
      var picksP = shuffle(pbqs).slice(0, k);
      var picksM = shuffle(mcqs).slice(0, Math.max(0, P.total - k));
      state.items = picksP.map(function (p) { return { kind: "pbq", data: p, response: freshResponse(p) }; })
        .concat(picksM.map(function (m) { return { kind: "mcq", data: m, response: { sel: [] } }; }));
      state.idx = 0;
      state.secondsLeft = P.minutes * 60;
      state.startedAt = Date.now();
      state.active = true;
      buildOverlay();
      startTimer();
      window.addEventListener("beforeunload", unloadGuard);
    }).catch(function (err) {
      alert("Could not load the exam data: " + err.message);
    });
  }

  function freshResponse(p) {
    if (p.type === "grid") {
      return { cells: p.rows.map(function () { return {}; }) };
    }
    if (p.type === "dragdrop") {
      return { zones: p.zones.map(function () { return []; }) };
    }
    if (p.type === "logselect") {
      return { lines: [], attack: "" };
    }
    return { sel: [] };
  }

  function unloadGuard(e) {
    if (state.active) { e.preventDefault(); e.returnValue = ""; }
  }

  /* ------------------------------------------------------------------ *
   * Timer
   * ------------------------------------------------------------------ */
  function startTimer() {
    var elT = document.getElementById("ezx-timer");
    function tick() {
      state.secondsLeft--;
      if (elT) {
        elT.textContent = fmtTime(state.secondsLeft);
        elT.classList.toggle("warn", state.secondsLeft <= 300);
      }
      if (state.secondsLeft <= 0) {
        stopTimer();
        submitExam(true);
      }
    }
    if (elT) elT.textContent = fmtTime(state.secondsLeft);
    state.timerId = setInterval(tick, 1000);
  }
  function stopTimer() {
    if (state.timerId) { clearInterval(state.timerId); state.timerId = null; }
  }

  /* ------------------------------------------------------------------ *
   * Overlay UI
   * ------------------------------------------------------------------ */
  function buildOverlay() {
    var root = el("div", "");
    root.id = "ezx-root";
    root.innerHTML =
      '<div class="ezx-top">' +
      '  <span class="ezx-live">● LIVE EXAM</span>' +
      '  <span class="ezx-title">' + esc(P.name) + "</span>" +
      '  <span class="ezx-prog" id="ezx-prog"></span>' +
      '  <span class="ezx-timer" id="ezx-timer" role="timer" aria-label="Time remaining"></span>' +
      '  <button class="ezx-submit" id="ezx-submit-btn" type="button">Submit exam</button>' +
      "</div>" +
      '<div class="ezx-wrap">' +
      '  <div class="ezx-dots" id="ezx-dots" aria-label="Question navigator"></div>' +
      '  <div id="ezx-q"></div>' +
      '  <div class="ezx-nav">' +
      '    <button class="ezx-btn" id="ezx-prev" type="button">‹ Previous</button>' +
      '    <button class="ezx-btn pri" id="ezx-next" type="button">Next ›</button>' +
      "  </div>" +
      "</div>";
    document.body.appendChild(root);
    document.body.style.overflow = "hidden";

    document.getElementById("ezx-prev").addEventListener("click", function () { go(state.idx - 1); });
    document.getElementById("ezx-next").addEventListener("click", function () {
      if (state.idx === state.items.length - 1) confirmSubmit();
      else go(state.idx + 1);
    });
    document.getElementById("ezx-submit-btn").addEventListener("click", confirmSubmit);

    buildDots();
    go(0);
  }

  function buildDots() {
    var dots = document.getElementById("ezx-dots");
    dots.innerHTML = "";
    state.items.forEach(function (it, i) {
      var d = el("button", "ezx-dot", "");
      d.type = "button";
      d.setAttribute("aria-label", "Question " + (i + 1));
      d.addEventListener("click", function () { go(i); });
      dots.appendChild(d);
    });
  }

  function refreshDots() {
    var dots = document.getElementById("ezx-dots").children;
    state.items.forEach(function (it, i) {
      dots[i].classList.toggle("done", isAnswered(it));
      dots[i].classList.toggle("cur", i === state.idx);
    });
  }

  function isAnswered(it) {
    var r = it.response;
    if (it.kind === "mcq") return r.sel.length > 0;
    var p = it.data;
    if (p.type === "grid") return r.cells.some(function (c) { return Object.keys(c).length > 0; });
    if (p.type === "dragdrop") return r.zones.some(function (z) { return z.length > 0; });
    if (p.type === "logselect") return r.lines.length > 0 || !!r.attack;
    return false;
  }

  function go(i) {
    if (i < 0 || i >= state.items.length) return;
    state.idx = i;
    var it = state.items[i];
    var q = document.getElementById("ezx-q");
    q.innerHTML = "";
    q.appendChild(renderItem(it, i));
    document.getElementById("ezx-prog").textContent = "Q " + (i + 1) + " / " + state.items.length;
    document.getElementById("ezx-prev").disabled = i === 0;
    document.getElementById("ezx-next").textContent = i === state.items.length - 1 ? "Finish & submit" : "Next ›";
    refreshDots();
    var stem = q.querySelector(".ezx-stem, .ezx-kicker");
    if (stem) { stem.setAttribute("tabindex", "-1"); stem.focus({ preventScroll: false }); }
    document.getElementById("ezx-root").scrollTop = 0;
  }

  /* ------------------------------------------------------------------ *
   * Item renderers
   * ------------------------------------------------------------------ */
  function renderItem(it, i) {
    var card = el("div", "ezx-card");
    if (it.kind === "mcq") renderMcq(card, it);
    else renderPbq(card, it);
    return card;
  }

  function renderMcq(card, it) {
    var d = it.data;
    card.appendChild(el("p", "ezx-kicker", "Multiple choice" + (d.multi ? " · choose " + d.correct.length : "")));
    if (d.exhibit) {
      var img = el("img", "ezx-img");
      img.src = d.exhibit; img.alt = "Question exhibit"; img.loading = "lazy";
      card.appendChild(img);
    }
    card.appendChild(el("p", "ezx-stem", esc(d.stem)));
    if (d.multi) card.appendChild(el("p", "ezx-multi-hint", "Select " + d.correct.length + " answers."));
    d.options.forEach(function (o) {
      var b = el("button", "ezx-opt", '<span class="ezx-letter">' + esc(o.key) + '</span><span>' + esc(o.text) + "</span>");
      b.type = "button";
      b.setAttribute("aria-pressed", String(it.response.sel.indexOf(o.key) !== -1));
      if (it.response.sel.indexOf(o.key) !== -1) b.classList.add("sel");
      b.addEventListener("click", function () {
        var sel = it.response.sel;
        var at = sel.indexOf(o.key);
        if (d.multi) {
          if (at === -1) sel.push(o.key); else sel.splice(at, 1);
        } else {
          it.response.sel = at === -1 ? [o.key] : [];
        }
        go(state.idx); // re-render to reflect selection
      });
      card.appendChild(b);
    });
  }

  function renderPbq(card, it) {
    var p = it.data, r = it.response;
    card.appendChild(el("p", "ezx-kicker", "PBQ scenario · " + esc(p.title || "Performance-based question")));
    if (p.scenario) card.appendChild(el("p", "ezx-scenario", esc(p.scenario)));
    if (p.diagram) card.appendChild(el("div", "ezx-diagram", p.diagram)); // authored HTML from the hub's own bank
    (p.exhibits || []).forEach(function (src) {
      if (src.indexOf("/") === -1) src = "exhibits/" + src;
      var img = el("img", "ezx-img");
      img.src = src; img.alt = "PBQ exhibit"; img.loading = "lazy";
      card.appendChild(img);
    });

    if (p.type === "grid") {
      var tbl = el("table", "ezx-table");
      var thead = "<tr><th>" + esc(p.rowLabel || "Item") + "</th>";
      p.columns.forEach(function (c) { thead += "<th>" + esc(c.label) + "</th>"; });
      tbl.innerHTML = "<thead>" + thead + "</tr></thead>";
      var tbody = el("tbody", "");
      p.rows.forEach(function (row, ri) {
        var tr = el("tr", "");
        tr.appendChild(el("td", "", esc(row.prompt)));
        p.columns.forEach(function (c) {
          var td = el("td", "");
          if (c.kind === "text") {
            var inp = document.createElement("input");
            inp.type = "text";
            inp.placeholder = c.placeholder || "";
            inp.setAttribute("aria-label", c.label + " for row " + (ri + 1));
            inp.value = r.cells[ri][c.key] || "";
            inp.addEventListener("input", function () {
              r.cells[ri][c.key] = inp.value;
              refreshDots();
            });
            td.appendChild(inp);
          } else {
            var s = document.createElement("select");
            s.setAttribute("aria-label", c.label + " for row " + (ri + 1));
            s.innerHTML = '<option value="">—</option>' + (c.options || []).map(function (o) {
              return '<option value="' + esc(o) + '">' + esc(o) + "</option>";
            }).join("");
            s.value = r.cells[ri][c.key] || "";
            s.addEventListener("change", function () {
              r.cells[ri][c.key] = s.value;
              refreshDots();
            });
            td.appendChild(s);
          }
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      });
      tbl.appendChild(tbody);
      var wrap = el("div", "");
      wrap.style.overflowX = "auto";
      wrap.appendChild(tbl);
      card.appendChild(wrap);
    }

    if (p.type === "dragdrop") {
      card.appendChild(el("p", "ezx-multi-hint", "Tap every option that belongs in each answer area."));
      p.zones.forEach(function (z, zi) {
        var zone = el("div", "ezx-zone");
        zone.appendChild(el("p", "ezx-zone-prompt", esc(z.prompt || "Answer area")));
        var chips = el("div", "ezx-chips");
        (p.items || []).forEach(function (itm) {
          var c = el("button", "ezx-chip", esc(itm));
          c.type = "button";
          var on = r.zones[zi].indexOf(itm) !== -1;
          c.setAttribute("aria-pressed", String(on));
          c.addEventListener("click", function () {
            var arr = r.zones[zi];
            var at = arr.indexOf(itm);
            if (at === -1) arr.push(itm); else arr.splice(at, 1);
            c.setAttribute("aria-pressed", String(at === -1));
            refreshDots();
          });
          chips.appendChild(c);
        });
        zone.appendChild(chips);
        card.appendChild(zone);
      });
    }

    if (p.type === "logselect") {
      card.appendChild(el("p", "ezx-multi-hint", "Select every log line that looks malicious, then identify the attack."));
      (p.lines || []).forEach(function (ln, li) {
        var b = el("button", "ezx-log", esc(ln.level ? "[" + ln.level + "] " : "") + esc(ln.text));
        b.type = "button";
        var on = r.lines.indexOf(li) !== -1;
        b.setAttribute("aria-pressed", String(on));
        b.addEventListener("click", function () {
          var at = r.lines.indexOf(li);
          if (at === -1) r.lines.push(li); else r.lines.splice(at, 1);
          b.setAttribute("aria-pressed", String(at === -1));
          refreshDots();
        });
        card.appendChild(b);
      });
      var zone = el("div", "ezx-zone");
      zone.appendChild(el("p", "ezx-zone-prompt", "Attack type observed:"));
      var s = document.createElement("select");
      s.setAttribute("aria-label", "Attack type");
      s.style.cssText = "font:inherit;font-size:.9rem;color:var(--lab-text,var(--text,var(--text-primary,#f8fafc)));background:var(--lab-bg,var(--bg,var(--bg-dark,#0f172a)));border:1px solid var(--lab-border,var(--border,#334155));border-radius:7px;padding:8px 10px;max-width:340px;width:100%";
      s.innerHTML = '<option value="">—</option>' + (p.attackOptions || []).map(function (o) {
        return '<option value="' + esc(o) + '">' + esc(o) + "</option>";
      }).join("");
      s.value = r.attack || "";
      s.addEventListener("change", function () { r.attack = s.value; refreshDots(); });
      zone.appendChild(s);
      card.appendChild(zone);
    }
  }

  /* ------------------------------------------------------------------ *
   * Grading (PBQs earn partial credit; each item is worth 1 point)
   * ------------------------------------------------------------------ */
  function gradeItem(it) {
    if (it.kind === "mcq") {
      return setEq(it.response.sel, it.data.correct) ? 1 : 0;
    }
    var p = it.data, r = it.response;
    if (p.type === "grid") {
      var got = 0, cells = 0;
      p.rows.forEach(function (row, ri) {
        Object.keys(row.answer || {}).forEach(function (key) {
          cells++;
          var want = row.answer[key], have = r.cells[ri][key];
          if (Array.isArray(want)) {
            var hv = String(have || "").trim().toLowerCase();
            if (want.some(function (w) { return String(w).trim().toLowerCase() === hv; })) got++;
          } else if (String(have || "").trim().toLowerCase() === String(want).trim().toLowerCase()) {
            got++;
          }
        });
      });
      return cells ? got / cells : 0;
    }
    if (p.type === "dragdrop") {
      var sum = 0;
      p.zones.forEach(function (z, zi) {
        var want = z.answer || [], have = r.zones[zi] || [];
        var hits = have.filter(function (h) { return want.indexOf(h) !== -1; }).length;
        var denom = Math.max(want.length, have.length, 1);
        sum += hits / denom;
      });
      return p.zones.length ? sum / p.zones.length : 0;
    }
    if (p.type === "logselect") {
      var badIdx = [];
      (p.lines || []).forEach(function (ln, i) { if (ln.bad) badIdx.push(i); });
      var hits2 = r.lines.filter(function (i) { return badIdx.indexOf(i) !== -1; }).length;
      var lineScore = hits2 / Math.max(badIdx.length, r.lines.length, 1);
      var attackScore = r.attack === p.attackAnswer ? 1 : 0;
      return (lineScore + attackScore) / 2;
    }
    return 0;
  }

  function describeCorrect(it) {
    var p = it.data;
    if (it.kind === "mcq") {
      return "Correct answer: <b>" + esc(it.data.correct.join(", ")) + "</b>" +
        (it.response.sel.length ? " · you picked " + esc(it.response.sel.join(", ")) : " · you left this blank");
    }
    if (p.type === "grid") {
      return p.rows.map(function (row, ri) {
        var parts = Object.keys(row.answer || {}).map(function (k) {
          var w = row.answer[k];
          return esc(k) + " = <b>" + esc(Array.isArray(w) ? w.join(" / ") : w) + "</b>";
        });
        return "Row " + (ri + 1) + ": " + parts.join(" · ");
      }).join("<br>");
    }
    if (p.type === "dragdrop") {
      return p.zones.map(function (z, zi) {
        return esc(z.prompt || "Answer area") + ": <b>" + esc((z.answer || []).join(", ")) + "</b>";
      }).join("<br>");
    }
    if (p.type === "logselect") {
      var bad = (p.lines || []).map(function (ln, i) { return ln.bad ? "#" + (i + 1) : null; })
        .filter(Boolean).join(", ");
      return "Malicious lines: <b>" + bad + "</b> · Attack: <b>" + esc(p.attackAnswer) + "</b>";
    }
    return "";
  }

  /* ------------------------------------------------------------------ *
   * Submit + results
   * ------------------------------------------------------------------ */
  function confirmSubmit() {
    var unanswered = state.items.filter(function (it) { return !isAnswered(it); }).length;
    var bg = el("div", "ezx-modal-bg");
    bg.innerHTML =
      '<div class="ezx-modal" role="dialog" aria-modal="true" aria-labelledby="ezx-mt">' +
      '<h3 id="ezx-mt">Submit exam?</h3>' +
      "<p>" + (unanswered
        ? "You still have <b>" + unanswered + " unanswered</b> question" + (unanswered === 1 ? "" : "s") + ". Unanswered questions score zero."
        : "All questions answered. Ready to see your score?") + "</p>" +
      '<div style="display:flex;gap:10px;justify-content:flex-end">' +
      '<button class="ezx-btn" id="ezx-cancel" type="button">Keep working</button>' +
      '<button class="ezx-btn pri" id="ezx-go" type="button">Submit</button>' +
      "</div></div>";
    document.body.appendChild(bg);
    bg.querySelector("#ezx-cancel").addEventListener("click", function () { bg.remove(); });
    bg.querySelector("#ezx-go").addEventListener("click", function () { bg.remove(); submitExam(false); });
  }

  function submitExam(auto) {
    stopTimer();
    state.active = false;
    window.removeEventListener("beforeunload", unloadGuard);

    var scores = state.items.map(gradeItem);
    var earned = scores.reduce(function (a, b) { return a + b; }, 0);
    var pct = Math.round((earned / state.items.length) * 100);
    var pass = pct >= P.passPct;
    var usedSec = Math.min(P.minutes * 60, Math.round((Date.now() - state.startedAt) / 1000));
    var pbqCount = state.items.filter(function (i) { return i.kind === "pbq"; }).length;
    var pbqEarned = state.items.reduce(function (a, it, i) { return a + (it.kind === "pbq" ? scores[i] : 0); }, 0);
    var mcqRight = state.items.reduce(function (a, it, i) { return a + (it.kind === "mcq" && scores[i] === 1 ? 1 : 0); }, 0);

    var root = document.getElementById("ezx-root");
    root.innerHTML =
      '<div class="ezx-top">' +
      '  <span class="ezx-live">■ EXAM COMPLETE</span>' +
      '  <span class="ezx-title">' + esc(P.name) + "</span>" +
      '  <button class="ezx-submit" id="ezx-exit" type="button" style="margin-left:auto">Exit to hub</button>' +
      "</div>" +
      '<div class="ezx-wrap">' +
      (auto ? '<p class="ezx-multi-hint">⏱ Time expired — the exam was submitted automatically.</p>' : "") +
      '<p class="ezx-kicker">Your result</p>' +
      '<div class="ezx-score">' + pct + "%</div>" +
      '<span class="ezx-pass ' + (pass ? "ok" : "no") + '">' +
      (pass ? "ABOVE" : "BELOW") + " the ~" + P.passPct + "% estimated pass line</span>" +
      '<div class="ezx-rstats">' +
      "<span><b>" + earned.toFixed(1) + "</b> / " + state.items.length + " points</span>" +
      "<span><b>" + mcqRight + "</b> / " + (state.items.length - pbqCount) + " MCQs correct</span>" +
      "<span><b>" + pbqEarned.toFixed(1) + "</b> / " + pbqCount + " PBQ credit</span>" +
      "<span><b>" + fmtTime(usedSec) + "</b> used of " + fmtTime(P.minutes * 60) + "</span>" +
      "</div>" +
      '<p class="ezx-kicker">Review</p>' +
      '<div id="ezx-review"></div>' +
      "</div>";

    var rev = root.querySelector("#ezx-review");
    state.items.forEach(function (it, i) {
      var s = scores[i];
      var cls = s === 1 ? "good" : s === 0 ? "bad" : "part";
      var box = el("div", "ezx-rev " + cls);
      var label = it.kind === "pbq" ? "PBQ · " + esc(it.data.title || "Scenario") : "MCQ";
      box.innerHTML =
        '<div class="ezx-rev-head">' +
        '<span class="ezx-rev-num">Q' + (i + 1) + " · " + label + "</span>" +
        '<span class="ezx-rev-score">' + (s === 1 ? "✓ full credit" : s === 0 ? "✗ no credit" : "◐ " + Math.round(s * 100) + "% credit") + "</span>" +
        "</div>" +
        '<div>' + esc(it.kind === "mcq" ? it.data.stem : (it.data.scenario || it.data.title || "")) + "</div>" +
        '<p class="ezx-rev-ans">' + describeCorrect(it) + "</p>" +
        (it.data.explanation ? '<p class="ezx-rev-exp">' + esc(it.data.explanation) + "</p>" : "");
      rev.appendChild(box);
    });

    root.querySelector("#ezx-exit").addEventListener("click", closeOverlay);
    root.scrollTop = 0;
  }

  function closeOverlay() {
    stopTimer();
    state.active = false;
    window.removeEventListener("beforeunload", unloadGuard);
    var root = document.getElementById("ezx-root");
    if (root) root.remove();
    document.body.style.overflow = "";
  }

  /* ------------------------------------------------------------------ */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", injectPicker, { once: true });
  } else {
    injectPicker();
  }
})();
