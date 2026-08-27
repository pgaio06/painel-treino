import React, { useState, useMemo, useCallback } from "react";
import Papa from "papaparse";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Upload, Timer, TrendingUp, Target, Plus, X } from "lucide-react";

// ---------------------------------------------------------------------------
// Design tokens
// bg ink #0A0E12 · panel #11161C · border #1E2731
// text #E8EDF2 · muted #6B7684 · accent (timer glow) #35D9C4
// zones: Z1 #4A90D9  Z2 #4AD9B8  Z3 #D9C94A  Z4 #D97A4A  Z5 #D9454A
// display/numeric: Space Mono · body: Manrope
// ---------------------------------------------------------------------------

const FONT_IMPORT_ID = "painel-treino-fonts";
function ensureFonts() {
  if (typeof document === "undefined") return;
  if (document.getElementById(FONT_IMPORT_ID)) return;
  const link = document.createElement("link");
  link.id = FONT_IMPORT_ID;
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Manrope:wght@400;500;600;700;800&display=swap";
  document.head.appendChild(link);
}

const ZONES = [
  { id: "Z1", label: "Recuperação", lo: 0.5, hi: 0.6, color: "#4A90D9" },
  { id: "Z2", label: "Base aeróbica", lo: 0.6, hi: 0.7, color: "#4AD9B8" },
  { id: "Z3", label: "Tempo", lo: 0.7, hi: 0.8, color: "#D9C94A" },
  { id: "Z4", label: "Limiar", lo: 0.8, hi: 0.9, color: "#D97A4A" },
  { id: "Z5", label: "VO2 máx", lo: 0.9, hi: 1.0, color: "#D9454A" },
];

function karvonen(hrMax, hrRest, pct) {
  return Math.round((hrMax - hrRest) * pct + hrRest);
}

function zoneForHR(hr, hrMax, hrRest) {
  for (const z of ZONES) {
    const lo = karvonen(hrMax, hrRest, z.lo);
    const hi = karvonen(hrMax, hrRest, z.hi);
    if (hr >= lo && hr <= hi) return z;
  }
  if (hr > karvonen(hrMax, hrRest, 1.0)) return ZONES[ZONES.length - 1];
  return ZONES[0];
}

function parsePaceToSeconds(pace) {
  // accepts "5:32" (min:sec per km) -> seconds
  if (!pace) return null;
  const s = String(pace).trim();
  const m = s.match(/^(\d+):(\d{2})$/);
  if (m) return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  const n = parseFloat(s);
  return isNaN(n) ? null : n * 60;
}

function secondsToPace(sec) {
  if (sec == null || isNaN(sec)) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtDate(d) {
  try {
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return d;
    return dt.toLocaleDateString("pt-PT", { day: "2-digit", month: "short" });
  } catch {
    return d;
  }
}

// Dados reais do Paulo, registados a partir dos exports do Garmin Connect.
const SEED_RUNS = [
  { date: "2026-07-27", distanceKm: 6.01, paceStr: "5:45", avgHr: 158 },
  { date: "2026-08-10", distanceKm: 3.12, paceStr: "6:13", avgHr: 145 },
  { date: "2026-08-12", distanceKm: 4.23, paceStr: "5:54", avgHr: 152 },
  { date: "2026-08-22", distanceKm: 5.54, paceStr: "6:13", avgHr: 139 },
  { date: "2026-08-24", distanceKm: 6.01, paceStr: "6:11", avgHr: 143 },
];

function normalizeRow(row) {
  // Flexible mapping across common Garmin export header variants
  const get = (...keys) => {
    for (const k of keys) {
      const hit = Object.keys(row).find(
        (h) => h.trim().toLowerCase() === k.toLowerCase()
      );
      if (hit && row[hit] !== undefined && row[hit] !== "") return row[hit];
    }
    return undefined;
  };
  const date = get("Date", "Data", "Início", "Start Time");
  const distance = get("Distance", "Distância", "Distance (km)");
  const pace = get("Avg Pace", "Ritmo Médio", "Pace", "Average Pace");
  const hr = get("Avg HR", "FC Média", "Average HR", "Avg Heart Rate");
  if (!date || distance === undefined) return null;
  const distanceKm = parseFloat(String(distance).replace(",", "."));
  const avgHr = hr ? parseInt(String(hr).replace(/[^\d]/g, ""), 10) : null;
  if (isNaN(distanceKm)) return null;
  return {
    date: String(date).slice(0, 10),
    distanceKm,
    paceStr: pace ? String(pace).trim() : null,
    avgHr: avgHr && !isNaN(avgHr) ? avgHr : null,
  };
}

export default function PainelTreino() {
  ensureFonts();

  const [hrMax, setHrMax] = useState(197);
  const [hrRest, setHrRest] = useState(49);
  const [runs, setRuns] = useState(SEED_RUNS);
  const [goalSeconds, setGoalSeconds] = useState(40 * 60);
  const [goalDistance, setGoalDistance] = useState(10);
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
      complete: (results) => {
        const parsed = results.data.map(normalizeRow).filter(Boolean);
        if (parsed.length === 0) {
          setError(
            "Não consegui reconhecer colunas de data/distância neste ficheiro. Podes adicionar o treino manualmente abaixo."
          );
          return;
        }
        setRuns((prev) =>
          [...prev, ...parsed].sort((a, b) => a.date.localeCompare(b.date))
        );
      },
      error: () => setError("Erro a ler o ficheiro CSV."),
    });
  }, []);

  const onDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

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

  const removeRun = (idx) => {
    setRuns((prev) => prev.filter((_, i) => i !== idx));
  };

  const zoneBounds = useMemo(
    () =>
      ZONES.map((z) => ({
        ...z,
        loBpm: karvonen(hrMax, hrRest, z.lo),
        hiBpm: karvonen(hrMax, hrRest, z.hi),
      })),
    [hrMax, hrRest]
  );

  // time-in-zone estimate: distribute each run's duration into its avg-HR zone
  const zoneMinutes = useMemo(() => {
    const acc = Object.fromEntries(ZONES.map((z) => [z.id, 0]));
    runs.forEach((r) => {
      if (!r.avgHr) return;
      const z = zoneForHR(r.avgHr, hrMax, hrRest);
      const paceSec = parsePaceToSeconds(r.paceStr);
      const durationMin = paceSec ? (paceSec * r.distanceKm) / 60 : r.distanceKm * 5.5;
      acc[z.id] += durationMin;
    });
    return acc;
  }, [runs, hrMax, hrRest]);

  const totalZoneMinutes = Object.values(zoneMinutes).reduce((a, b) => a + b, 0) || 1;

  const chartData = useMemo(
    () =>
      runs
        .filter((r) => r.paceStr)
        .map((r) => ({
          date: fmtDate(r.date),
          paceSec: parsePaceToSeconds(r.paceStr),
          pace: r.paceStr,
        })),
    [runs]
  );

  const bestPaceSec = useMemo(() => {
    const paces = runs.map((r) => parsePaceToSeconds(r.paceStr)).filter(Boolean);
    return paces.length ? Math.min(...paces) : null;
  }, [runs]);

  const goalPaceSec = goalSeconds / goalDistance;
  const onTrack = bestPaceSec != null && bestPaceSec <= goalPaceSec * 1.03;

  return (
    <div
      style={{
        fontFamily: "'Manrope', sans-serif",
        background: "#0A0E12",
        color: "#E8EDF2",
        minHeight: "100vh",
        padding: "clamp(16px, 4vw, 48px)",
      }}
    >
      <style>{`
        .num { font-family: 'Space Mono', monospace; font-variant-numeric: tabular-nums; }
        .card {
          background: #11161C;
          border: 1px solid #1E2731;
          padding: 20px;
        }
        input[type="text"], input[type="number"], input[type="date"] {
          background: #0A0E12;
          border: 1px solid #1E2731;
          color: #E8EDF2;
          padding: 8px 10px;
          font-family: 'Space Mono', monospace;
          font-size: 13px;
          outline: none;
          width: 100%;
        }
        input:focus { border-color: #35D9C4; }
        button:focus-visible, input:focus-visible, [tabindex]:focus-visible {
          outline: 2px solid #35D9C4;
          outline-offset: 2px;
        }
        @media (prefers-reduced-motion: reduce) {
          * { transition: none !important; animation: none !important; }
        }
      `}</style>

      {/* Header / hero */}
      <div style={{ marginBottom: 32 }}>
        <div
          style={{
            fontSize: 11,
            letterSpacing: "0.18em",
            color: "#6B7684",
            textTransform: "uppercase",
            marginBottom: 8,
          }}
        >
          Registo de treino · Karvonen HRR
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "baseline",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <h1
            className="num"
            style={{
              fontSize: "clamp(32px, 6vw, 56px)",
              fontWeight: 700,
              margin: 0,
              color: onTrack ? "#4AD9B8" : "#E8EDF2",
            }}
          >
            {secondsToPace(bestPaceSec)}
            <span style={{ fontSize: 18, color: "#6B7684" }}> /km melhor</span>
          </h1>
        </div>
        <div style={{ color: "#6B7684", fontSize: 14, marginTop: 6 }}>
          Meta: {goalDistance} km em {Math.floor(goalSeconds / 60)}:
          {String(goalSeconds % 60).padStart(2, "0")} · ritmo alvo{" "}
          <span className="num" style={{ color: "#35D9C4" }}>
            {secondsToPace(goalPaceSec)}/km
          </span>
        </div>
        <div style={{ color: "#3A4450", fontSize: 12, marginTop: 4 }}>
          Maratona do Porto (10km) · 8 nov 2026 &nbsp;·&nbsp; teste: Corrida Porto de Leixões · 20 set 2026
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0,1fr)",
          gap: 20,
        }}
      >
        {/* Upload */}
        <div
          className="card"
          onDragOver={(e) => e.preventDefault()}
          onDrop={onDrop}
          style={{
            borderStyle: "dashed",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <Upload size={18} color="#35D9C4" />
            <div>
              <div style={{ fontWeight: 600, fontSize: 14 }}>
                Importar CSV do Garmin
              </div>
              <div style={{ fontSize: 12, color: "#6B7684" }}>
                Arrasta o ficheiro para aqui, ou escolhe manualmente
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <label
              style={{
                cursor: "pointer",
                border: "1px solid #1E2731",
                padding: "8px 14px",
                fontSize: 12,
                color: "#35D9C4",
              }}
            >
              Escolher ficheiro
              <input
                type="file"
                accept=".csv"
                style={{ display: "none" }}
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
            </label>
            <button
              onClick={() => setManualOpen((v) => !v)}
              style={{
                cursor: "pointer",
                border: "1px solid #1E2731",
                background: "none",
                padding: "8px 14px",
                fontSize: 12,
                color: "#E8EDF2",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Plus size={14} /> Adicionar manualmente
            </button>
          </div>
        </div>

        {manualOpen && (
          <div className="card">
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(120px,1fr))",
                gap: 12,
              }}
            >
              <div>
                <label style={{ fontSize: 11, color: "#6B7684" }}>Data</label>
                <input
                  type="date"
                  value={manual.date}
                  onChange={(e) => setManual({ ...manual, date: e.target.value })}
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6B7684" }}>Distância (km)</label>
                <input
                  type="number"
                  value={manual.distanceKm}
                  onChange={(e) =>
                    setManual({ ...manual, distanceKm: e.target.value })
                  }
                  placeholder="10"
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6B7684" }}>Ritmo (min:seg/km)</label>
                <input
                  type="text"
                  value={manual.paceStr}
                  onChange={(e) => setManual({ ...manual, paceStr: e.target.value })}
                  placeholder="5:30"
                />
              </div>
              <div>
                <label style={{ fontSize: 11, color: "#6B7684" }}>FC média</label>
                <input
                  type="number"
                  value={manual.avgHr}
                  onChange={(e) => setManual({ ...manual, avgHr: e.target.value })}
                  placeholder="155"
                />
              </div>
            </div>
            <button
              onClick={addManual}
              style={{
                marginTop: 14,
                background: "#35D9C4",
                color: "#0A0E12",
                border: "none",
                padding: "8px 16px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Guardar treino
            </button>
          </div>
        )}

        {error && (
          <div
            className="card"
            style={{ borderColor: "#D9454A", color: "#D9454A", fontSize: 13 }}
          >
            {error}
          </div>
        )}

        {/* HR inputs */}
        <div className="card">
          <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 12 }}>
            Parâmetros de FC
          </div>
          <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
            <div>
              <label style={{ fontSize: 11, color: "#6B7684" }}>FC máx (bpm)</label>
              <input
                type="number"
                value={hrMax}
                onChange={(e) => setHrMax(parseInt(e.target.value || "0", 10))}
                style={{ width: 100 }}
              />
            </div>
            <div>
              <label style={{ fontSize: 11, color: "#6B7684" }}>FC repouso (bpm)</label>
              <input
                type="number"
                value={hrRest}
                onChange={(e) => setHrRest(parseInt(e.target.value || "0", 10))}
                style={{ width: 100 }}
              />
            </div>
          </div>
        </div>

        {/* Signature element: split board — zones as timing-sheet segments */}
        <div className="card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <Timer size={16} color="#35D9C4" />
            <div style={{ fontSize: 13, fontWeight: 700 }}>
              Zonas de FC — quadro de splits
            </div>
          </div>

          {/* segmented bar */}
          <div style={{ display: "flex", width: "100%", height: 10, marginBottom: 16 }}>
            {ZONES.map((z) => (
              <div
                key={z.id}
                style={{
                  flex: totalZoneMinutes
                    ? Math.max(zoneMinutes[z.id], 0.001)
                    : 1,
                  background: z.color,
                  marginRight: 2,
                }}
                title={`${z.label}: ${Math.round(zoneMinutes[z.id])} min`}
              />
            ))}
          </div>

          <div style={{ display: "grid", gap: 0 }}>
            {zoneBounds.map((z) => {
              const pct = Math.round((zoneMinutes[z.id] / totalZoneMinutes) * 100);
              return (
                <div
                  key={z.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "40px 1fr 90px 60px",
                    alignItems: "center",
                    gap: 12,
                    padding: "10px 0",
                    borderTop: "1px solid #1E2731",
                    fontSize: 13,
                  }}
                >
                  <div
                    className="num"
                    style={{ color: z.color, fontWeight: 700 }}
                  >
                    {z.id}
                  </div>
                  <div style={{ color: "#9AA5B1" }}>{z.label}</div>
                  <div className="num" style={{ color: "#6B7684", fontSize: 12 }}>
                    {z.loBpm}–{z.hiBpm} bpm
                  </div>
                  <div className="num" style={{ textAlign: "right" }}>
                    {isNaN(pct) ? "0" : pct}%
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Pace trend */}
        <div className="card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <TrendingUp size={16} color="#35D9C4" />
            <div style={{ fontSize: 13, fontWeight: 700 }}>Evolução do ritmo</div>
          </div>
          <div style={{ width: "100%", height: 220 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ left: -10, right: 10 }}>
                <CartesianGrid stroke="#1E2731" vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#6B7684", fontSize: 11 }}
                  axisLine={{ stroke: "#1E2731" }}
                  tickLine={false}
                />
                <YAxis
                  reversed
                  tickFormatter={(v) => secondsToPace(v)}
                  tick={{ fill: "#6B7684", fontSize: 11 }}
                  axisLine={{ stroke: "#1E2731" }}
                  tickLine={false}
                  width={50}
                />
                <Tooltip
                  contentStyle={{
                    background: "#11161C",
                    border: "1px solid #1E2731",
                    fontFamily: "Space Mono, monospace",
                    fontSize: 12,
                  }}
                  formatter={(v) => [secondsToPace(v) + " /km", "ritmo"]}
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
        </div>

        {/* Runs table */}
        <div className="card">
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 16,
            }}
          >
            <Target size={16} color="#35D9C4" />
            <div style={{ fontSize: 13, fontWeight: 700 }}>Treinos registados</div>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ color: "#6B7684", textAlign: "left" }}>
                  <th style={{ padding: "6px 8px", fontWeight: 500 }}>Data</th>
                  <th style={{ padding: "6px 8px", fontWeight: 500 }}>Dist.</th>
                  <th style={{ padding: "6px 8px", fontWeight: 500 }}>Ritmo</th>
                  <th style={{ padding: "6px 8px", fontWeight: 500 }}>FC média</th>
                  <th style={{ padding: "6px 8px", fontWeight: 500 }}>Zona</th>
                  <th style={{ padding: "6px 8px" }}></th>
                </tr>
              </thead>
              <tbody>
                {runs
                  .slice()
                  .reverse()
                  .map((r, i) => {
                    const z = r.avgHr ? zoneForHR(r.avgHr, hrMax, hrRest) : null;
                    const realIdx = runs.length - 1 - i;
                    return (
                      <tr key={realIdx} style={{ borderTop: "1px solid #1E2731" }}>
                        <td className="num" style={{ padding: "8px" }}>
                          {fmtDate(r.date)}
                        </td>
                        <td className="num" style={{ padding: "8px" }}>
                          {r.distanceKm} km
                        </td>
                        <td className="num" style={{ padding: "8px" }}>
                          {r.paceStr || "—"}
                        </td>
                        <td className="num" style={{ padding: "8px" }}>
                          {r.avgHr || "—"}
                        </td>
                        <td style={{ padding: "8px" }}>
                          {z && (
                            <span
                              style={{
                                color: z.color,
                                border: `1px solid ${z.color}`,
                                padding: "2px 6px",
                                fontSize: 11,
                              }}
                              className="num"
                            >
                              {z.id}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "8px", textAlign: "right" }}>
                          <button
                            onClick={() => removeRun(realIdx)}
                            aria-label="Remover treino"
                            style={{
                              background: "none",
                              border: "none",
                              color: "#6B7684",
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
        </div>
      </div>

      <div style={{ marginTop: 24, fontSize: 11, color: "#3A4450" }}>
        Painel de treino pessoal · dados processados localmente, nada é enviado para um servidor
      </div>
    </div>
  );
}
