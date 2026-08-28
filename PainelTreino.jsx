import React, { useState, useMemo, useCallback } from "react";
import Papa from "papaparse";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Upload, Plus, X, Check, Flag, Activity, Dumbbell } from "lucide-react";

// ---------------------------------------------------------------------------
// Design tokens
// ink #0A0E12 · painel #11161C · borda #1E2731
// texto #E8EDF2 · apagado #6B7684 · ténue #3A4450 · destaque #35D9C4
// zonas: Z1 #4A90D9 · Z2 #4AD9B8 · Z3 #D9C94A · Z4 #D97A4A · Z5 #D9454A
// números: Space Mono · corpo: Manrope
// ---------------------------------------------------------------------------

const HR_MAX = 197; // teste de Cooper
const HR_REST = 49; // média Garmin

const FONT_ID = "painel-treino-fonts";
function ensureFonts() {
  if (typeof document === "undefined") return;
  if (document.getElementById(FONT_ID)) return;
  const link = document.createElement("link");
  link.id = FONT_ID;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Manrope:wght@400;500;600;700;800&display=swap";
  document.head.appendChild(link);
}

const ZONES = [
  { id: "Z1", label: "Recuperação", lo: 0.5, hi: 0.6, color: "#4A90D9" },
  { id: "Z2", label: "Base aeróbica", lo: 0.6, hi: 0.7, color: "#4AD9B8" },
  { id: "Z3", label: "Aeróbico", lo: 0.7, hi: 0.8, color: "#D9C94A" },
  { id: "Z4", label: "Limiar", lo: 0.8, hi: 0.9, color: "#D97A4A" },
  { id: "Z5", label: "VO2 máx", lo: 0.9, hi: 1.0, color: "#D9454A" },
];

const karvonen = (pct) => Math.round((HR_MAX - HR_REST) * pct + HR_REST);

function zoneForHR(hr) {
  for (const z of ZONES) {
    if (hr >= karvonen(z.lo) && hr <= karvonen(z.hi)) return z;
  }
  return hr > karvonen(1) ? ZONES[4] : ZONES[0];
}

function paceToSec(pace) {
  if (!pace) return null;
  const m = String(pace).trim().match(/^(\d+):(\d{2})$/);
  if (m) return +m[1] * 60 + +m[2];
  const n = parseFloat(pace);
  return isNaN(n) ? null : n * 60;
}

function secToPace(sec) {
  if (sec == null || isNaN(sec)) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

const fmtDate = (d) =>
  new Date(d).toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });

function daysUntil(iso) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(iso);
  target.setHours(0, 0, 0, 0);
  return Math.round((target - today) / 86400000);
}

function isoWeekKey(iso) {
  const d = new Date(iso);
  const day = (d.getDay() + 6) % 7; // segunda = 0
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

// --- Dados -----------------------------------------------------------------

// Treinos reais, dos exports do Garmin Connect.
const SEED_RUNS = [
  {
    date: "2026-07-27",
    distanceKm: 6.01,
    paceStr: "5:45",
    avgHr: 158,
    note: "Sagres · 31 °C",
  },
  {
    date: "2026-08-10",
    distanceKm: 3.12,
    paceStr: "6:13",
    avgHr: 145,
    note: "Parado aos 3 km, pernas cansadas",
  },
  {
    date: "2026-08-12",
    distanceKm: 4.23,
    paceStr: "5:54",
    avgHr: 152,
    note: "Splits negativos",
  },
  {
    date: "2026-08-22",
    distanceKm: 5.54,
    paceStr: "6:13",
    avgHr: 139,
    note: "8 × 400 m · melhor rep. 3:53",
  },
  {
    date: "2026-08-24",
    distanceKm: 6.01,
    paceStr: "6:11",
    avgHr: 143,
    note: "+152 m de subida",
  },
];

// Plano da semana. É aqui que passa a viver o treino, em vez do calendário.
const WEEK = {
  label: "24 – 30 agosto",
  block: "Base · consistência",
  days: [
    {
      dow: "Seg",
      date: "2026-08-24",
      run: "Corrida fácil 4–5 km · Z2",
      lift: "Push — peito, ombros, tríceps",
      exercises: [
        "Flexões 4 × até perto da falha",
        "Floor press 3 × 10-12",
        "Shoulder press 3 × 8-10",
        "Elevação lateral 3 × 12-15",
        "Extensão tríceps 3 × 10-12",
        "Prancha 3 × 40 s",
      ],
      done: true,
    },
    { dow: "Ter", date: "2026-08-25", rest: true },
    {
      dow: "Qua",
      date: "2026-08-26",
      run: "Corrida fácil 4–5 km · Z2",
      lift: "Braços e ombros — extra curto",
      exercises: [
        "Rosca bíceps 3 × 10-12",
        "Rosca martelo 3 × 10-12",
        "Extensão tríceps testa 3 × 10-12",
        "Elevação lateral 3 × 12-15",
        "Elevação frontal 3 × 12",
      ],
      done: false,
    },
    { dow: "Qui", date: "2026-08-27", rest: true },
    {
      dow: "Sex",
      date: "2026-08-28",
      run: "Corrida fácil 4–5 km · Z2",
      lift: "Pull — costas, bíceps",
      exercises: [
        "Dominadas 4 × 6-10",
        "Remo curvado 4 × 10-12",
        "Reverse fly 3 × 12-15",
        "Rosca bíceps 3 × 10-12",
        "Rosca martelo 3 × 10-12",
      ],
      done: false,
    },
    {
      dow: "Sáb",
      date: "2026-08-29",
      run: "Corrida moderada 6–7 km",
      done: false,
    },
    { dow: "Dom", date: "2026-08-30", rest: true },
  ],
};

const RACES = [
  {
    date: "2026-09-20",
    name: "Corrida Porto de Leixões",
    distance: "10 km",
    role: "Teste de forma",
    confirmed: true,
  },
  {
    date: "2026-09-26",
    name: "Corrida BeActive Guimarães",
    distance: "5 km",
    role: "Teste de forma",
    confirmed: true,
  },
  {
    date: "2026-10-04",
    name: "Corrida IPO Porto",
    distance: "5 km",
    role: "Teste de forma",
    confirmed: true,
  },
  {
    date: "2026-11-08",
    name: "Maratona do Porto",
    distance: "10 km",
    role: "Prova principal · alvo sub-40",
    confirmed: true,
    primary: true,
  },
];

const GOAL = { distanceKm: 10, seconds: 40 * 60 };

// --- Componentes -----------------------------------------------------------

function Card({ title, icon: Icon, right, children, style }) {
  return (
    <section className="card" style={style}>
      {title && (
        <header className="card-head">
          <div className="card-title">
            {Icon && <Icon size={15} color="#35D9C4" strokeWidth={2.2} />}
            <h2>{title}</h2>
          </div>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

function Stat({ value, unit, label, tone }) {
  return (
    <div>
      <div className="num stat-value" style={tone ? { color: tone } : undefined}>
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      <div className="stat-label">{label}</div>
    </div>
  );
}

export default function PainelTreino() {
  ensureFonts();

  const [runs, setRuns] = useState(SEED_RUNS);
  const [openDay, setOpenDay] = useState(null);
  const [error, setError] = useState(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manual, setManual] = useState({
    date: "",
    distanceKm: "",
    paceStr: "",
    avgHr: "",
  });

  const handleFile = useCallback((file) => {
    setError(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const get = (row, ...keys) => {
          for (const k of keys) {
            const hit = Object.keys(row).find(
              (h) => h.trim().toLowerCase() === k.toLowerCase()
            );
            if (hit && row[hit] !== undefined && row[hit] !== "") return row[hit];
          }
        };
        const parsed = res.data
          .map((row) => {
            const date = get(row, "Date", "Data", "Início", "Start Time");
            const dist = get(row, "Distance", "Distância", "Distance (km)");
            const pace = get(row, "Avg Pace", "Ritmo médio", "Ritmo Médio", "Pace");
            const hr = get(row, "Avg HR", "FC média", "Frequência Cardíaca Média");
            if (!date || dist === undefined) return null;
            const distanceKm = parseFloat(String(dist).replace(",", "."));
            if (isNaN(distanceKm)) return null;
            const avgHr = hr ? parseInt(String(hr).replace(/[^\d]/g, ""), 10) : null;
            return {
              date: String(date).slice(0, 10),
              distanceKm,
              paceStr: pace ? String(pace).trim() : null,
              avgHr: avgHr && !isNaN(avgHr) ? avgHr : null,
            };
          })
          .filter(Boolean);
        if (!parsed.length) {
          setError(
            "Não reconheci colunas de data e distância neste ficheiro. Usa o botão de adicionar."
          );
          return;
        }
        setRuns((prev) =>
          [...prev, ...parsed].sort((a, b) => a.date.localeCompare(b.date))
        );
      },
      error: () => setError("Não foi possível ler o ficheiro CSV."),
    });
  }, []);

  const addManual = () => {
    if (!manual.date || !manual.distanceKm) {
      setError("Preenche pelo menos a data e a distância.");
      return;
    }
    setRuns((prev) =>
      [
        ...prev,
        {
          date: manual.date,
          distanceKm: parseFloat(manual.distanceKm),
          paceStr: manual.paceStr || null,
          avgHr: manual.avgHr ? parseInt(manual.avgHr, 10) : null,
        },
      ].sort((a, b) => a.date.localeCompare(b.date))
    );
    setManual({ date: "", distanceKm: "", paceStr: "", avgHr: "" });
    setManualOpen(false);
    setError(null);
  };

  const removeRun = (idx) => setRuns((p) => p.filter((_, i) => i !== idx));

  const totalKm = useMemo(
    () => runs.reduce((s, r) => s + r.distanceKm, 0),
    [runs]
  );

  const bestPaceSec = useMemo(() => {
    const p = runs.map((r) => paceToSec(r.paceStr)).filter(Boolean);
    return p.length ? Math.min(...p) : null;
  }, [runs]);

  const goalPaceSec = GOAL.seconds / GOAL.distanceKm;

  const paceSeries = useMemo(
    () =>
      runs
        .filter((r) => r.paceStr)
        .map((r) => ({ date: fmtDate(r.date), paceSec: paceToSec(r.paceStr) })),
    [runs]
  );

  // Eficiência aeróbica: metros por minuto a dividir pela FC média.
  const efficiencySeries = useMemo(
    () =>
      runs
        .filter((r) => r.paceStr && r.avgHr)
        .map((r) => ({
          date: fmtDate(r.date),
          ef: +(60000 / paceToSec(r.paceStr) / r.avgHr).toFixed(3),
        })),
    [runs]
  );

  const weeklyVolume = useMemo(() => {
    const acc = {};
    runs.forEach((r) => {
      const k = isoWeekKey(r.date);
      acc[k] = (acc[k] || 0) + r.distanceKm;
    });
    return Object.entries(acc)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, km]) => ({ week: fmtDate(week), km: +km.toFixed(1) }));
  }, [runs]);

  const zoneMinutes = useMemo(() => {
    const acc = Object.fromEntries(ZONES.map((z) => [z.id, 0]));
    runs.forEach((r) => {
      if (!r.avgHr) return;
      const sec = paceToSec(r.paceStr);
      const min = sec ? (sec * r.distanceKm) / 60 : r.distanceKm * 6;
      acc[zoneForHR(r.avgHr).id] += min;
    });
    return acc;
  }, [runs]);

  const totalZoneMin =
    Object.values(zoneMinutes).reduce((a, b) => a + b, 0) || 1;

  const mainRace = RACES.find((r) => r.primary);
  const daysToMain = daysUntil(mainRace.date);
  const todayIso = new Date().toISOString().slice(0, 10);

  const doneThisWeek = WEEK.days.filter((d) => d.done).length;
  const sessionsThisWeek = WEEK.days.filter((d) => !d.rest).length;

  const tooltipStyle = {
    background: "#0A0E12",
    border: "1px solid #1E2731",
    fontFamily: "Space Mono, monospace",
    fontSize: 12,
  };

  return (
    <div className="wrap">
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { margin: 0; background: #0A0E12; }
        .num { font-family: 'Space Mono', monospace; font-variant-numeric: tabular-nums; }
        .wrap {
          font-family: 'Manrope', sans-serif;
          background: #0A0E12; color: #E8EDF2; min-height: 100vh;
          padding: clamp(16px, 4vw, 44px);
          max-width: 1180px; margin: 0 auto;
        }
        h1, h2 { margin: 0; }
        p { margin: 0; }
        .eyebrow {
          font-size: 11px; letter-spacing: .2em; text-transform: uppercase; color: #6B7684;
        }
        .card { background: #11161C; border: 1px solid #1E2731; padding: 20px; }
        .card-head {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; margin-bottom: 18px; flex-wrap: wrap;
        }
        .card-title { display: flex; align-items: center; gap: 8px; }
        .card-title h2 { font-size: 13px; font-weight: 700; }
        .grid { display: grid; gap: 18px; }
        .cols-2 { grid-template-columns: repeat(auto-fit, minmax(330px, 1fr)); }

        .hero { margin-bottom: 28px; }
        .hero-count {
          font-family: 'Space Mono', monospace; font-weight: 700;
          font-size: clamp(46px, 11vw, 92px); line-height: .95;
          letter-spacing: -.03em; margin-top: 10px;
        }
        .hero-count small {
          font-size: .24em; color: #6B7684; letter-spacing: .12em; margin-left: 12px;
        }
        .hero-sub { color: #9AA5B1; font-size: 14px; margin-top: 10px; }
        .hero-stats {
          display: flex; flex-wrap: wrap; gap: 26px 34px; margin-top: 22px;
          padding-top: 20px; border-top: 1px solid #1E2731;
        }
        .stat-value { font-size: 23px; font-weight: 700; }
        .stat-unit { font-size: 12px; color: #6B7684; margin-left: 4px; }
        .stat-label { font-size: 11px; color: #6B7684; margin-top: 3px; }

        .day {
          display: grid; grid-template-columns: 52px 1fr auto; gap: 14px;
          align-items: start; width: 100%; text-align: left;
          padding: 14px 0; border: 0; border-top: 1px solid #1E2731;
          background: none; color: inherit; font: inherit; cursor: pointer;
        }
        .day:first-of-type { border-top: 0; }
        .day:disabled { cursor: default; opacity: .4; }
        .day-dow { font-family: 'Space Mono', monospace; font-size: 12px; color: #6B7684; }
        .day-dow b { display: block; color: #E8EDF2; font-size: 16px; margin-top: 2px; }
        .day-run { font-size: 14px; font-weight: 600; }
        .day-lift {
          font-size: 12.5px; color: #9AA5B1; margin-top: 4px;
          display: flex; gap: 6px; align-items: center; flex-wrap: wrap;
        }
        .day.today { box-shadow: inset 2px 0 0 #35D9C4; padding-left: 12px; }
        .pill {
          font-family: 'Space Mono', monospace; font-size: 10px;
          padding: 3px 8px; border: 1px solid currentColor; white-space: nowrap;
        }
        .ex { list-style: none; padding: 6px 0 12px 66px; margin: 0; }
        .ex li {
          font-size: 12.5px; color: #9AA5B1; padding: 4px 0;
          font-family: 'Space Mono', monospace;
        }
        .ex li::before { content: "·"; color: #35D9C4; margin-right: 8px; }

        .race {
          display: flex; align-items: center; justify-content: space-between;
          gap: 16px; padding: 15px 0; border-top: 1px solid #1E2731;
        }
        .race:first-of-type { border-top: 0; }
        .race-name { font-size: 14.5px; font-weight: 700; }
        .race-meta { font-size: 12px; color: #6B7684; margin-top: 3px; }
        .race-days { text-align: right; font-family: 'Space Mono', monospace; }
        .race-days b { font-size: 24px; font-weight: 700; display: block; line-height: 1; }
        .race-days span { font-size: 10px; color: #6B7684; letter-spacing: .1em; }

        .zbar { display: flex; height: 8px; margin-bottom: 14px; gap: 2px; }
        .zrow {
          display: grid; grid-template-columns: 32px 1fr auto 44px; gap: 12px;
          align-items: center; padding: 9px 0; border-top: 1px solid #1E2731; font-size: 13px;
        }

        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th {
          text-align: left; font-weight: 500; font-size: 10.5px; color: #6B7684;
          padding: 0 8px 8px; letter-spacing: .06em; text-transform: uppercase;
        }
        td { padding: 10px 8px; border-top: 1px solid #1E2731; vertical-align: top; }
        .note { font-size: 11.5px; color: #6B7684; line-height: 1.5; }

        .btn {
          border: 1px solid #1E2731; background: none; color: #E8EDF2;
          padding: 8px 13px; font-size: 12px; font-family: 'Manrope', sans-serif;
          cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
        }
        .btn:hover { border-color: #35D9C4; color: #35D9C4; }
        .btn-primary {
          background: #35D9C4; color: #0A0E12; border-color: #35D9C4; font-weight: 700;
        }
        input {
          background: #0A0E12; border: 1px solid #1E2731; color: #E8EDF2;
          padding: 8px 10px; font-family: 'Space Mono', monospace;
          font-size: 13px; outline: none; width: 100%;
        }
        input:focus { border-color: #35D9C4; }
        label { font-size: 11px; color: #6B7684; display: block; margin-bottom: 4px; }
        :focus-visible { outline: 2px solid #35D9C4; outline-offset: 2px; }
        .foot { margin-top: 28px; font-size: 11px; color: #3A4450; line-height: 1.7; }
        @media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
        @media (max-width: 560px) {
          .day { grid-template-columns: 46px 1fr; }
          .day .pill { grid-column: 2; justify-self: start; margin-top: 8px; }
          .ex { padding-left: 60px; }
        }
      `}</style>

      <header className="hero">
        <div className="eyebrow">Painel de treino · Paulo</div>
        <div className="hero-count">
          {daysToMain}
          <small>DIAS ATÉ À PROVA</small>
        </div>
        <p className="hero-sub">
          {mainRace.name} · {mainRace.distance} ·{" "}
          {new Date(mainRace.date).toLocaleDateString("pt-PT", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
        <div className="hero-stats">
          <Stat value={secToPace(goalPaceSec)} unit="/km" label="Ritmo alvo" tone="#35D9C4" />
          <Stat value={secToPace(bestPaceSec)} unit="/km" label="Melhor ritmo" />
          <Stat value={totalKm.toFixed(1)} unit="km" label="Volume acumulado" />
          <Stat value={runs.length} label="Treinos registados" />
          <Stat value={`${doneThisWeek}/${sessionsThisWeek}`} label="Sessões esta semana" />
        </div>
      </header>

      <div className="grid">
        <Card
          title={`Semana de treino · ${WEEK.label}`}
          icon={Activity}
          right={<span className="eyebrow">{WEEK.block}</span>}
        >
          {WEEK.days.map((d) => {
            const isToday = d.date === todayIso;
            const open = openDay === d.date;
            return (
              <div key={d.date}>
                <button
                  className={`day${isToday ? " today" : ""}`}
                  onClick={() => !d.rest && setOpenDay(open ? null : d.date)}
                  disabled={!!d.rest}
                  aria-expanded={d.exercises ? open : undefined}
                >
                  <span className="day-dow">
                    {d.dow}
                    <b>{new Date(d.date).getDate()}</b>
                  </span>
                  <span>
                    <span className="day-run">{d.rest ? "Descanso" : d.run}</span>
                    {d.lift && (
                      <span className="day-lift">
                        <Dumbbell size={12} color="#6B7684" />
                        {d.lift}
                        {d.exercises && (
                          <span style={{ color: "#3A4450" }}>
                            {open ? "· fechar" : "· ver exercícios"}
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  {!d.rest && (
                    <span
                      className="pill"
                      style={{
                        color: d.done ? "#4AD9B8" : isToday ? "#35D9C4" : "#3A4450",
                      }}
                    >
                      {d.done ? "FEITO" : isToday ? "HOJE" : "POR FAZER"}
                    </span>
                  )}
                </button>
                {open && d.exercises && (
                  <ul className="ex">
                    {d.exercises.map((e) => (
                      <li key={e}>{e}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </Card>

        <Card title="Calendário de provas" icon={Flag}>
          {RACES.map((r) => (
            <div className="race" key={r.name}>
              <div>
                <div
                  className="race-name"
                  style={{ color: r.primary ? "#35D9C4" : "#E8EDF2" }}
                >
                  {r.name}
                </div>
                <div className="race-meta">
                  {r.distance} · {r.role}
                </div>
              </div>
              <div className="race-days">
                <b style={{ color: r.primary ? "#35D9C4" : "#E8EDF2" }}>
                  {daysUntil(r.date)}
                </b>
                <span>DIAS</span>
              </div>
            </div>
          ))}
        </Card>

        <div className="grid cols-2">
          <Card title="Evolução do ritmo">
            <div style={{ width: "100%", height: 205 }}>
              <ResponsiveContainer>
                <LineChart data={paceSeries} margin={{ left: -12, right: 8, top: 4 }}>
                  <CartesianGrid stroke="#1E2731" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#6B7684", fontSize: 11 }}
                    axisLine={{ stroke: "#1E2731" }}
                    tickLine={false}
                  />
                  <YAxis
                    reversed
                    domain={["dataMin - 15", "dataMax + 15"]}
                    tickFormatter={secToPace}
                    tick={{ fill: "#6B7684", fontSize: 11 }}
                    axisLine={{ stroke: "#1E2731" }}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(v) => [secToPace(v) + " /km", "ritmo"]}
                  />
                  <Line
                    type="monotone"
                    dataKey="paceSec"
                    stroke="#35D9C4"
                    strokeWidth={2}
                    dot={{ fill: "#35D9C4", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="note" style={{ marginTop: 10 }}>
              Mais alto é mais rápido. O calor e o desnível explicam boa parte das
              oscilações.
            </p>
          </Card>

          <Card title="Volume por semana">
            <div style={{ width: "100%", height: 205 }}>
              <ResponsiveContainer>
                <BarChart data={weeklyVolume} margin={{ left: -18, right: 8, top: 4 }}>
                  <CartesianGrid stroke="#1E2731" vertical={false} />
                  <XAxis
                    dataKey="week"
                    tick={{ fill: "#6B7684", fontSize: 11 }}
                    axisLine={{ stroke: "#1E2731" }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#6B7684", fontSize: 11 }}
                    axisLine={{ stroke: "#1E2731" }}
                    tickLine={false}
                    width={42}
                  />
                  <Tooltip
                    cursor={{ fill: "rgba(53,217,196,.06)" }}
                    contentStyle={tooltipStyle}
                    formatter={(v) => [v + " km", "volume"]}
                  />
                  <Bar dataKey="km" fill="#4AD9B8" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="note" style={{ marginTop: 10 }}>
              Semanas de segunda a domingo. Subir o volume aos poucos é o que
              protege de lesões.
            </p>
          </Card>

          <Card title="Eficiência aeróbica">
            <div style={{ width: "100%", height: 205 }}>
              <ResponsiveContainer>
                <LineChart data={efficiencySeries} margin={{ left: -12, right: 8, top: 4 }}>
                  <CartesianGrid stroke="#1E2731" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#6B7684", fontSize: 11 }}
                    axisLine={{ stroke: "#1E2731" }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={["dataMin - 0.05", "dataMax + 0.05"]}
                    tick={{ fill: "#6B7684", fontSize: 11 }}
                    axisLine={{ stroke: "#1E2731" }}
                    tickLine={false}
                    width={48}
                  />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [v, "índice"]} />
                  <Line
                    type="monotone"
                    dataKey="ef"
                    stroke="#D9C94A"
                    strokeWidth={2}
                    dot={{ fill: "#D9C94A", r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <p className="note" style={{ marginTop: 10 }}>
              Metros por minuto a dividir pela FC média. Sobe quando corres mais
              depressa com o mesmo esforço do coração — é o sinal mais fiável de
              que a forma está a melhorar.
            </p>
          </Card>

          <Card title="Distribuição por zonas">
            <div className="zbar">
              {ZONES.map((z) => (
                <div
                  key={z.id}
                  style={{
                    flex: Math.max(zoneMinutes[z.id], 0.001),
                    background: z.color,
                  }}
                  title={`${z.label}: ${Math.round(zoneMinutes[z.id])} min`}
                />
              ))}
            </div>
            {ZONES.map((z) => (
              <div className="zrow" key={z.id}>
                <span className="num" style={{ color: z.color, fontWeight: 700 }}>
                  {z.id}
                </span>
                <span style={{ color: "#9AA5B1" }}>{z.label}</span>
                <span className="num" style={{ color: "#6B7684", fontSize: 12 }}>
                  {karvonen(z.lo)}–{karvonen(z.hi)}
                </span>
                <span className="num" style={{ textAlign: "right" }}>
                  {Math.round((zoneMinutes[z.id] / totalZoneMin) * 100)}%
                </span>
              </div>
            ))}
            <p className="note" style={{ marginTop: 12 }}>
              Karvonen · FC máx {HR_MAX} · FC repouso {HR_REST}
            </p>
          </Card>
        </div>

        <Card
          title="Últimos treinos"
          icon={Check}
          right={
            <div style={{ display: "flex", gap: 8 }}>
              <label className="btn" style={{ color: "#35D9C4", marginBottom: 0 }}>
                <Upload size={13} /> Importar CSV
                <input
                  type="file"
                  accept=".csv"
                  style={{ display: "none" }}
                  onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
                />
              </label>
              <button className="btn" onClick={() => setManualOpen((v) => !v)}>
                <Plus size={13} /> Adicionar
              </button>
            </div>
          }
        >
          {manualOpen && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(130px,1fr))",
                gap: 12,
                marginBottom: 18,
                paddingBottom: 18,
                borderBottom: "1px solid #1E2731",
              }}
            >
              <div>
                <label htmlFor="m-date">Data</label>
                <input
                  id="m-date"
                  type="date"
                  value={manual.date}
                  onChange={(e) => setManual({ ...manual, date: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="m-dist">Distância (km)</label>
                <input
                  id="m-dist"
                  type="number"
                  step="0.01"
                  placeholder="6.01"
                  value={manual.distanceKm}
                  onChange={(e) => setManual({ ...manual, distanceKm: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="m-pace">Ritmo (min:seg)</label>
                <input
                  id="m-pace"
                  type="text"
                  placeholder="5:45"
                  value={manual.paceStr}
                  onChange={(e) => setManual({ ...manual, paceStr: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="m-hr">FC média</label>
                <input
                  id="m-hr"
                  type="number"
                  placeholder="150"
                  value={manual.avgHr}
                  onChange={(e) => setManual({ ...manual, avgHr: e.target.value })}
                />
              </div>
              <div style={{ display: "flex", alignItems: "flex-end" }}>
                <button className="btn btn-primary" onClick={addManual}>
                  Guardar treino
                </button>
              </div>
            </div>
          )}

          {error && (
            <p style={{ color: "#D9454A", fontSize: 13, marginBottom: 12 }}>{error}</p>
          )}

          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Dist.</th>
                  <th>Ritmo</th>
                  <th>FC</th>
                  <th>Zona / nota</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {runs
                  .map((r, i) => ({ ...r, i }))
                  .reverse()
                  .map((r) => {
                    const z = r.avgHr ? zoneForHR(r.avgHr) : null;
                    return (
                      <tr key={r.i}>
                        <td className="num">{fmtDate(r.date)}</td>
                        <td className="num">{r.distanceKm.toFixed(2)} km</td>
                        <td className="num">{r.paceStr || "—"}</td>
                        <td className="num">{r.avgHr || "—"}</td>
                        <td>
                          {z && (
                            <span className="num pill" style={{ color: z.color }}>
                              {z.id}
                            </span>
                          )}
                          {r.note && (
                            <div className="note" style={{ marginTop: 5 }}>
                              {r.note}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <button
                            onClick={() => removeRun(r.i)}
                            aria-label={`Remover treino de ${fmtDate(r.date)}`}
                            style={{
                              background: "none",
                              border: "none",
                              color: "#3A4450",
                              cursor: "pointer",
                            }}
                          >
                            <X size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <p className="foot">
        Os treinos adicionados aqui ficam só nesta sessão do browser — ao
        recarregar a página, volta à lista base. O plano da semana e as provas
        são atualizados no código.
      </p>
    </div>
  );
}
