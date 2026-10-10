(() => {
  "use strict";

  const $ = (sel) => document.querySelector(sel);
  const state = { walks: [], q: "", when: "all", type: "all", dist: "all", year: "all", sort: "asc" };

  const TYPE_LABEL = { rond: "Rondwandeling", lijn: "Punt naar punt" };
  const TYPE_ICON = { rond: "i-loop", lijn: "i-route" };
  const fmtMonth = new Intl.DateTimeFormat("nl-BE", { month: "long", year: "numeric" });
  const fmtDow = new Intl.DateTimeFormat("nl-BE", { weekday: "short" });
  const fmtMon = new Intl.DateTimeFormat("nl-BE", { month: "short" });
  const fmtLong = new Intl.DateTimeFormat("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

  const icon = (id) => `<svg class="icon" aria-hidden="true"><use href="#${id}"/></svg>`;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const parseDate = (iso) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
  const today = () => { const t = new Date(); t.setHours(0, 0, 0, 0); return t; };
  const daysUntil = (d) => Math.round((d - today()) / 86400000);

  /* ---------- Theme ---------- */
  const root = document.documentElement;
  try { const t = localStorage.getItem("theme"); if (t) root.dataset.theme = t; } catch {}
  $("#themeToggle").addEventListener("click", () => {
    const isDark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = isDark ? "light" : "dark";
    try { localStorage.setItem("theme", root.dataset.theme); } catch {}
  });

  /* ---------- Data ---------- */
  function fillYears() {
    const years = [...new Set(state.walks.map((w) => w._date.getFullYear()))].sort();
    $("#year").insertAdjacentHTML("beforeend", years.map((y) => `<option value="${y}">${y}</option>`).join(""));
  }

  /* ---------- Filtering ---------- */
  function distRange() {
    if (state.dist === "all") return null;
    const [min, max] = state.dist.split("-").map(Number);
    return { min, max };
  }
  const inRange = (km, r) => r && km >= r.min && km < r.max;

  function filtered() {
    const t = today();
    const q = state.q.trim().toLowerCase();
    const r = distRange();
    const list = state.walks.filter((w) => {
      if (state.when === "upcoming" && w._date < t) return false;
      if (state.when === "past" && w._date >= t) return false;
      if (state.type !== "all" && w.type !== state.type) return false;
      if (state.year !== "all" && w._date.getFullYear() !== Number(state.year)) return false;
      if (r && !(w.distances || []).some((km) => inRange(km, r))) return false;
      if (q) {
        const hay = [w.name, w.location, w.region, w.start, w.finish, w.organizer, w.notes].join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    const dir = state.sort === "desc" ? -1 : 1;
    return list.sort((a, b) => dir * (a._date - b._date));
  }

  /* ---------- Rendering ---------- */
  function render() {
    const list = filtered();
    const el = $("#list");
    if (!list.length) {
      el.innerHTML = `<div class="empty">${icon("i-empty")}<p><b>Geen wandelingen gevonden.</b><br>Probeer andere filters.</p></div>`;
      return;
    }
    const groups = new Map();
    list.forEach((w) => {
      const key = `${w._date.getFullYear()}-${w._date.getMonth()}`;
      if (!groups.has(key)) groups.set(key, { label: fmtMonth.format(w._date), items: [] });
      groups.get(key).items.push(w);
    });
    let i = 0;
    el.innerHTML = [...groups.values()].map((g) => `
      <section class="month">
        <h2 class="month-label">${esc(g.label)}</h2>
        ${g.items.map((w) => card(w, i++)).join("")}
      </section>`).join("");
  }

  function card(w, i) {
    const d = w._date;
    const past = d < today();
    const days = daysUntil(d);
    const r = distRange();
    const sameStartFinish = w.start && w.finish && w.start === w.finish;

    const badges = [];
    if (w.type) badges.push(`<span class="badge type">${icon(TYPE_ICON[w.type] || "i-route")}${TYPE_LABEL[w.type] || esc(w.type)}</span>`);
    if (!past && days <= 30) badges.push(`<span class="badge soon">${days === 0 ? "Vandaag" : `Nog ${days} ${days === 1 ? "dag" : "dagen"}`}</span>`);
    if (past) badges.push(`<span class="badge">Voorbij</span>`);

    const meta = [];
    if (sameStartFinish) meta.push(metaItem("i-pin", "Start & aankomst", w.start));
    else {
      if (w.start) meta.push(metaItem("i-play", "Start", w.start));
      if (w.finish) meta.push(metaItem("i-flag", "Aankomst", w.finish));
    }
    meta.push(metaItem("i-mountain", "Hoogtemeters", w.elevation == null ? "onbekend" : typeof w.elevation === "number" ? `${w.elevation.toLocaleString("nl-BE")} m` : w.elevation));
    if (w.startTime) meta.push(metaItem("i-calendar", "Starttijd", w.startTime));
    if (w.price) meta.push(metaItem("i-euro", "Prijs", w.price));
    if (w.organizer) meta.push(metaItem("i-boot", "Organisator", w.organizer));

    const kms = (w.distances || []).slice().sort((a, b) => b - a)
      .map((km) => `<span class="km${inRange(km, r) ? " match" : ""}">${km.toLocaleString("nl-BE")} km</span>`).join("");

    return `
    <article class="card${past ? " is-past" : ""}" style="--i:${Math.min(i, 10)}" id="${esc(w.id)}">
      <div class="datebox" title="${esc(fmtLong.format(d))}">
        <span class="dow">${esc(fmtDow.format(d).replace(".", ""))}</span>
        <span class="day">${d.getDate()}</span>
        <span class="mon">${esc(fmtMon.format(d).replace(".", ""))} ${d.getFullYear()}</span>
      </div>
      <div class="card-body">
        <div class="card-top"><h3>${esc(w.name)}</h3>${badges.join("")}</div>
        <p class="place">${icon("i-pin")}${esc([w.location, w.region].filter(Boolean).join(", "))}</p>
        ${kms ? `<div class="distances" aria-label="Afstanden">${icon("i-ruler")}${kms}</div>` : ""}
        <dl class="meta">${meta.join("")}</dl>
        ${w.notes ? `<p class="notes">${icon("i-info")}<span>${esc(w.notes)}</span></p>` : ""}
        <div class="actions">
          ${w.url ? `<a class="btn primary" href="${esc(w.url)}" target="_blank" rel="noopener">Meer info ${icon("i-link")}</a>` : ""}
          ${!past ? `<button class="btn" type="button" data-ics="${esc(w.id)}">${icon("i-calendar-plus")}In agenda</button>` : ""}
          <button class="btn" type="button" data-share="${esc(w.id)}">${icon("i-share")}Deel</button>
        </div>
      </div>
    </article>`;
  }

  function metaItem(ic, label, value) { return `<div>${icon(ic)}<div><dt>${label}</dt><dd>${esc(value)}</dd></div></div>`; }

  /* ---------- Actions ---------- */
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => t.classList.remove("show"), 2200);
  }

  function downloadIcs(w) {
    const d = w._date;
    const ymd = (x) => `${x.getFullYear()}${String(x.getMonth() + 1).padStart(2, "0")}${String(x.getDate()).padStart(2, "0")}`;
    const next = new Date(d); next.setDate(d.getDate() + 1);
    const icsEsc = (s) => String(s || "").replace(/[\\;,]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
    const desc = [`Afstanden: ${(w.distances || []).join(", ")} km`, w.notes, w.url].filter(Boolean).join("\n");
    const ics = [
      "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Wandelen//NL", "BEGIN:VEVENT",
      `UID:${w.id}@wandelen`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, "").split(".")[0]}Z`,
      `DTSTART;VALUE=DATE:${ymd(d)}`, `DTEND;VALUE=DATE:${ymd(next)}`,
      `SUMMARY:${icsEsc(w.name)}`, `LOCATION:${icsEsc([w.start, w.location].filter(Boolean).join(", "))}`,
      `DESCRIPTION:${icsEsc(desc)}`, w.url ? `URL:${w.url}` : "",
      "END:VEVENT", "END:VCALENDAR",
    ].filter(Boolean).join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = `${w.id}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function share(w) {
    const url = `${location.origin}${location.pathname}#${w.id}`;
    const text = `${w.name} — ${fmtLong.format(w._date)}`;
    if (navigator.share) {
      try { await navigator.share({ title: w.name, text, url }); } catch {}
      return;
    }
    try { await navigator.clipboard.writeText(`${text}\n${url}`); toast("Link gekopieerd!"); }
    catch { toast(url); }
  }

  $("#list").addEventListener("click", (e) => {
    const b = e.target.closest("[data-ics],[data-share]");
    if (!b) return;
    const w = state.walks.find((x) => x.id === (b.dataset.ics || b.dataset.share));
    if (!w) return;
    b.dataset.ics ? downloadIcs(w) : share(w);
  });

  /* ---------- Controls & URL state ---------- */
  function syncControls() {
    document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("is-active", state[c.dataset.filter] === c.dataset.value));
    $("#q").value = state.q;
    $("#dist").value = state.dist;
    $("#year").value = state.year;
    $("#sort").value = state.sort;
  }

  function writeUrl() {
    const p = new URLSearchParams();
    if (state.q) p.set("q", state.q);
    if (state.when !== "all") p.set("when", state.when);
    if (state.type !== "all") p.set("type", state.type);
    if (state.dist !== "all") p.set("dist", state.dist);
    if (state.year !== "all") p.set("year", state.year);
    if (state.sort !== "asc") p.set("sort", state.sort);
    const qs = p.toString();
    history.replaceState(null, "", `${location.pathname}${qs ? "?" + qs : ""}${location.hash}`);
  }

  function readUrl() {
    const p = new URLSearchParams(location.search);
    for (const k of ["q", "when", "type", "dist", "year", "sort"]) if (p.has(k)) state[k] = p.get(k);
    // Deep link to a past walk: make sure it is visible
    const id = location.hash.slice(1);
    const w = id && state.walks.find((x) => x.id === id);
    if (w && w._date < today()) state.when = "all";
  }

  function update() { writeUrl(); syncControls(); render(); }

  document.querySelectorAll(".chip").forEach((c) =>
    c.addEventListener("click", () => { state[c.dataset.filter] = c.dataset.value; update(); }));
  let qTimer;
  $("#q").addEventListener("input", (e) => { clearTimeout(qTimer); qTimer = setTimeout(() => { state.q = e.target.value; writeUrl(); render(); }, 150); });
  $("#dist").addEventListener("change", (e) => { state.dist = e.target.value; update(); });
  $("#year").addEventListener("change", (e) => { state.year = e.target.value; update(); });
  $("#sort").addEventListener("change", (e) => { state.sort = e.target.value; update(); });
  $("#reset").addEventListener("click", () => {
    Object.assign(state, { q: "", when: "all", type: "all", dist: "all", year: "all", sort: "asc" });
    update();
  });

  // Scroll to & highlight a shared walk
  function focusHash() {
    const el = location.hash && document.getElementById(location.hash.slice(1));
    if (!el) return;
    setTimeout(() => {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.animate([{ boxShadow: "0 0 0 4px var(--accent)" }, { boxShadow: "var(--shadow)" }], { duration: 2000 });
    }, 300);
  }

  /* ---------- Start ---------- */
  fetch("walks.json", { cache: "no-store" })
    .then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then((data) => {
      state.walks = data.map((w) => ({ ...w, _date: parseDate(w.date) }));
      readUrl();
      fillYears();
      syncControls();
      render();
      focusHash();
    })
    .catch(() => {
      const local = location.protocol === "file:";
      $("#list").innerHTML = `<div class="empty">${icon("i-empty")}<p><b>Kon de wandelingen niet laden.</b><br>${local
        ? "Lokaal openen werkt niet rechtstreeks: start <code>python3 -m http.server</code> en open http://localhost:8000."
        : "Controleer <code>walks.json</code> op tikfouten (komma's, aanhalingstekens)."}</p></div>`;
    });
})();
