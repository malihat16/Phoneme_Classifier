import { useState, useRef, useCallback } from "react";
import { Upload, Mic, Play, Pause, ChevronRight, BarChart2, Waveform, Zap, AlertCircle, CheckCircle, RefreshCw } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

// ─── Mock API (replace with real endpoint later) ───────────────────────────
const mockProcess = async (model) => {
  await new Promise(r => setTimeout(r, 1800 + Math.random() * 1200));
  const responses = {
    baseline: {
      phonemes: "h iː s l oʊ l i t eɪ k s ɐ ʃ ɔː t w ɑː k ɪ n ð ɪ oʊ p ə n æ ɹ",
      words: "he slowly takes a short walk in the open air",
      per: 0.614,
      confidence: 0.38,
    },
    finetuned: {
      phonemes: "h iː s l oʊ l i t eɪ k s ə ʃ ɔːɹ t w ɔː k ɪ n ð ə oʊ p ə n ɛ ɹ",
      words: "he slowly takes a short walk in the open air",
      per: 0.186,
      confidence: 0.81,
    },
  };
  return responses[model];
};

// ─── Waveform visualizer (decorative) ──────────────────────────────────────
const WaveformBars = ({ active, color = "#22d3ee" }) => (
  <div className="flex items-center gap-[3px] h-8">
    {Array.from({ length: 28 }).map((_, i) => (
      <div
        key={i}
        style={{
          height: active
            ? `${20 + Math.sin(i * 0.8) * 14 + Math.random() * 8}px`
            : `${4 + Math.sin(i * 0.5) * 3}px`,
          background: color,
          width: "3px",
          borderRadius: "2px",
          transition: active ? `height ${0.15 + (i % 5) * 0.05}s ease ${i * 0.02}s` : "height 0.4s ease",
          opacity: active ? 0.9 : 0.3,
        }}
      />
    ))}
  </div>
);

// ─── Phoneme token display ──────────────────────────────────────────────────
const PhonemeDisplay = ({ phonemes, highlight = false }) => (
  <div className="flex flex-wrap gap-1.5 font-mono text-sm">
    {phonemes.split(" ").map((ph, i) => (
      <span
        key={i}
        className="px-1.5 py-0.5 rounded text-xs font-mono"
        style={{
          background: highlight ? "rgba(34,211,238,0.12)" : "rgba(255,255,255,0.06)",
          border: `1px solid ${highlight ? "rgba(34,211,238,0.3)" : "rgba(255,255,255,0.1)"}`,
          color: highlight ? "#a5f3fc" : "#94a3b8",
          letterSpacing: "0.05em",
        }}
      >
        {ph}
      </span>
    ))}
  </div>
);

// ─── PER gauge ──────────────────────────────────────────────────────────────
const PERGauge = ({ value, label }) => {
  const pct = Math.round(value * 100);
  const color = pct < 25 ? "#4ade80" : pct < 50 ? "#facc15" : "#f87171";
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className="relative w-20 h-20 rounded-full flex items-center justify-center"
        style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(255,255,255,0.07) 0deg)` }}
      >
        <div className="absolute inset-[5px] rounded-full" style={{ background: "#0f172a" }} />
        <span className="relative font-bold text-lg" style={{ color }}>{pct}%</span>
      </div>
      <span className="text-xs text-slate-500 text-center">{label}</span>
    </div>
  );
};

// ─── Main App ───────────────────────────────────────────────────────────────
export default function App() {
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [processing, setProcessing] = useState({ baseline: false, finetuned: false });
  const [results, setResults] = useState({ baseline: null, finetuned: null });
  const [activeTab, setActiveTab] = useState("transcription");
  const [runMode, setRunMode] = useState("both"); // 'baseline' | 'finetuned' | 'both'
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith("audio/")) return;
    setAudioFile(file);
    setAudioUrl(URL.createObjectURL(file));
    setResults({ baseline: null, finetuned: null });
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const runAnalysis = async () => {
    if (!audioFile) return;
    const models = runMode === "both" ? ["baseline", "finetuned"] : [runMode];
    
    setResults({ baseline: null, finetuned: null });
    models.forEach(m => setProcessing(p => ({ ...p, [m]: true })));

    await Promise.all(
      models.map(async (m) => {
        const result = await mockProcess(m);
        setProcessing(p => ({ ...p, [m]: false }));
        setResults(r => ({ ...r, [m]: result }));
      })
    );
  };

  const hasResults = results.baseline || results.finetuned;
  const bothDone = results.baseline && results.finetuned;

  const chartData = bothDone ? [
    { name: "Baseline", per: +(results.baseline.per * 100).toFixed(1), fill: "#f87171" },
    { name: "Fine-tuned\n(V2)", per: +(results.finetuned.per * 100).toFixed(1), fill: "#4ade80" },
  ] : [];

  return (
    <div style={{ minHeight: "100vh", background: "#080d1a", color: "#e2e8f0", fontFamily: "'DM Sans', 'Segoe UI', sans-serif" }}>
      
      {/* ── Background grain ── */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E\")",
      }} />

      {/* ── Glow orb ── */}
      <div style={{
        position: "fixed", top: "-200px", left: "50%", transform: "translateX(-50%)",
        width: "800px", height: "600px", borderRadius: "50%",
        background: "radial-gradient(ellipse, rgba(34,211,238,0.06) 0%, transparent 70%)",
        pointerEvents: "none", zIndex: 0,
      }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "900px", margin: "0 auto", padding: "0 24px 80px" }}>

        {/* ── Header ── */}
        <header style={{ padding: "48px 0 40px", textAlign: "center" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "5px 14px", borderRadius: "100px", marginBottom: "20px",
            background: "rgba(34,211,238,0.08)", border: "1px solid rgba(34,211,238,0.2)",
          }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#22d3ee" }} />
            <span style={{ fontSize: "12px", color: "#67e8f9", fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              FYP Demo — Dysarthric ASR
            </span>
          </div>

          <h1 style={{ fontSize: "clamp(28px, 5vw, 46px)", fontWeight: 800, lineHeight: 1.1, margin: "0 0 16px", letterSpacing: "-0.02em" }}>
            Speech Recognition for{" "}
            <span style={{ background: "linear-gradient(135deg, #22d3ee, #818cf8)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              Dysarthric Speech
            </span>
          </h1>
          <p style={{ color: "#64748b", fontSize: "16px", maxWidth: "520px", margin: "0 auto", lineHeight: 1.6 }}>
            Upload an audio clip to compare the off-the-shelf wav2vec2 baseline against the fine-tuned model on TORGO data.
          </p>
        </header>

        {/* ── Upload zone ── */}
        <section
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !audioFile && fileInputRef.current?.click()}
          style={{
            border: `2px dashed ${isDragging ? "#22d3ee" : audioFile ? "rgba(34,211,238,0.4)" : "rgba(255,255,255,0.1)"}`,
            borderRadius: "16px",
            padding: audioFile ? "20px 24px" : "48px 24px",
            textAlign: "center",
            cursor: audioFile ? "default" : "pointer",
            transition: "all 0.25s ease",
            background: isDragging ? "rgba(34,211,238,0.04)" : audioFile ? "rgba(34,211,238,0.03)" : "rgba(255,255,255,0.02)",
            marginBottom: "24px",
          }}
        >
          <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
          
          {audioFile ? (
            <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
              <button
                onClick={togglePlay}
                style={{
                  width: "44px", height: "44px", borderRadius: "50%", border: "none",
                  background: "linear-gradient(135deg, #22d3ee, #818cf8)",
                  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                }}
              >
                {isPlaying ? <Pause size={18} color="#000" /> : <Play size={18} color="#000" />}
              </button>

              <div style={{ flex: 1, minWidth: "120px" }}>
                <p style={{ margin: 0, fontWeight: 600, fontSize: "14px", color: "#e2e8f0" }}>{audioFile.name}</p>
                <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#475569" }}>{(audioFile.size / 1024).toFixed(0)} KB · audio</p>
              </div>

              <WaveformBars active={isPlaying} />

              <button
                onClick={(e) => { e.stopPropagation(); setAudioFile(null); setAudioUrl(null); setResults({ baseline: null, finetuned: null }); setIsPlaying(false); }}
                style={{ background: "none", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "6px 12px", color: "#64748b", cursor: "pointer", fontSize: "12px" }}
              >
                Remove
              </button>

              {audioUrl && (
                <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} style={{ display: "none" }} />
              )}
            </div>
          ) : (
            <>
              <div style={{ width: "48px", height: "48px", borderRadius: "12px", background: "rgba(255,255,255,0.05)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                <Upload size={22} color="#22d3ee" />
              </div>
              <p style={{ margin: "0 0 6px", fontWeight: 600, fontSize: "16px" }}>Drop an audio file here</p>
              <p style={{ margin: 0, color: "#475569", fontSize: "14px" }}>or click to browse — .wav, .mp3, .flac supported</p>
            </>
          )}
        </section>

        {/* ── Model selection + run ── */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "32px", flexWrap: "wrap", alignItems: "flex-start" }}>
          
          {/* Model cards */}
          {[
            { id: "baseline", label: "Baseline", sub: "Off-the-shelf wav2vec2", per: "~61.6% PER", color: "#f87171" },
            { id: "finetuned", label: "Fine-tuned (V2)", sub: "Trained on TORGO", per: "~18.6% PER", color: "#4ade80" },
            { id: "both", label: "Compare Both", sub: "Run side by side", per: "See difference", color: "#22d3ee" },
          ].map(({ id, label, sub, per, color }) => (
            <button
              key={id}
              onClick={() => setRunMode(id)}
              style={{
                flex: 1, minWidth: "140px", padding: "14px 16px", borderRadius: "12px", cursor: "pointer", textAlign: "left",
                background: runMode === id ? `rgba(${id === "baseline" ? "248,113,113" : id === "finetuned" ? "74,222,128" : "34,211,238"},0.08)` : "rgba(255,255,255,0.03)",
                border: `1.5px solid ${runMode === id ? color : "rgba(255,255,255,0.08)"}`,
                transition: "all 0.2s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color }} />
                <span style={{ fontWeight: 700, fontSize: "14px", color: runMode === id ? color : "#e2e8f0" }}>{label}</span>
              </div>
              <p style={{ margin: 0, fontSize: "12px", color: "#475569" }}>{sub}</p>
              <p style={{ margin: "4px 0 0", fontSize: "11px", color: color, opacity: 0.8, fontWeight: 600 }}>{per}</p>
            </button>
          ))}

          {/* Run button */}
          <button
            onClick={runAnalysis}
            disabled={!audioFile || Object.values(processing).some(Boolean)}
            style={{
              padding: "14px 28px", borderRadius: "12px", border: "none", cursor: audioFile ? "pointer" : "not-allowed",
              background: audioFile ? "linear-gradient(135deg, #22d3ee, #818cf8)" : "rgba(255,255,255,0.05)",
              color: audioFile ? "#000" : "#334155", fontWeight: 700, fontSize: "15px",
              display: "flex", alignItems: "center", gap: "8px", flexShrink: 0,
              opacity: Object.values(processing).some(Boolean) ? 0.7 : 1,
              transition: "all 0.2s ease", alignSelf: "stretch",
            }}
          >
            {Object.values(processing).some(Boolean) ? (
              <><RefreshCw size={16} style={{ animation: "spin 1s linear infinite" }} /> Processing...</>
            ) : (
              <><Zap size={16} /> Analyse</>
            )}
          </button>
        </div>

        {/* ── Results ── */}
        {(hasResults || Object.values(processing).some(Boolean)) && (
          <div style={{ marginBottom: "32px" }}>
            
            {/* Tabs */}
            <div style={{ display: "flex", gap: "4px", marginBottom: "20px", background: "rgba(255,255,255,0.03)", borderRadius: "10px", padding: "4px", width: "fit-content" }}>
              {[
                { id: "transcription", label: "Transcription", icon: <Mic size={14} /> },
                { id: "comparison", label: "Comparison", icon: <BarChart2 size={14} />, disabled: !bothDone },
              ].map(({ id, label, icon, disabled }) => (
                <button
                  key={id}
                  onClick={() => !disabled && setActiveTab(id)}
                  disabled={disabled}
                  style={{
                    padding: "8px 18px", borderRadius: "7px", border: "none", cursor: disabled ? "not-allowed" : "pointer",
                    background: activeTab === id ? "rgba(34,211,238,0.12)" : "transparent",
                    color: activeTab === id ? "#22d3ee" : disabled ? "#334155" : "#64748b",
                    fontWeight: activeTab === id ? 600 : 400, fontSize: "13px",
                    display: "flex", alignItems: "center", gap: "6px", transition: "all 0.2s ease",
                  }}
                >
                  {icon}{label}
                </button>
              ))}
            </div>

            {/* Transcription tab */}
            {activeTab === "transcription" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "16px" }}>
                {[
                  { key: "baseline", label: "Baseline", color: "#f87171" },
                  { key: "finetuned", label: "Fine-tuned (V2)", color: "#4ade80" },
                ].filter(({ key }) => runMode === "both" || runMode === key).map(({ key, label, color }) => (
                  <div
                    key={key}
                    style={{
                      borderRadius: "14px", padding: "20px",
                      background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: color }} />
                        <span style={{ fontWeight: 700, color }}>{label}</span>
                      </div>
                      {results[key] && (
                        <span style={{
                          fontSize: "12px", padding: "3px 10px", borderRadius: "100px",
                          background: `rgba(${key === "baseline" ? "248,113,113" : "74,222,128"},0.1)`,
                          color, fontWeight: 600,
                        }}>
                          PER {(results[key].per * 100).toFixed(1)}%
                        </span>
                      )}
                    </div>

                    {processing[key] && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                        <WaveformBars active color={color} />
                        <p style={{ margin: 0, fontSize: "13px", color: "#475569" }}>Transcribing audio...</p>
                        <div style={{ height: "2px", background: "rgba(255,255,255,0.05)", borderRadius: "1px", overflow: "hidden" }}>
                          <div style={{ height: "100%", background: color, width: "60%", borderRadius: "1px", animation: "progress 1.5s ease-in-out infinite" }} />
                        </div>
                      </div>
                    )}

                    {results[key] && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        <div>
                          <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Phonemes (IPA)</p>
                          <PhonemeDisplay phonemes={results[key].phonemes} highlight={key === "finetuned"} />
                        </div>
                        <div>
                          <p style={{ margin: "0 0 6px", fontSize: "11px", color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Decoded Words</p>
                          <p style={{ margin: 0, fontSize: "15px", fontWeight: 500, color: "#e2e8f0", background: "rgba(255,255,255,0.04)", padding: "10px 14px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.06)" }}>
                            "{results[key].words}"
                          </p>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          {key === "finetuned" ? <CheckCircle size={14} color="#4ade80" /> : <AlertCircle size={14} color="#f87171" />}
                          <span style={{ fontSize: "12px", color: "#475569" }}>
                            Confidence: {(results[key].confidence * 100).toFixed(0)}%
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Comparison tab */}
            {activeTab === "comparison" && bothDone && (
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

                {/* PER gauges + headline */}
                <div style={{
                  borderRadius: "14px", padding: "24px",
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
                }}>
                  <h3 style={{ margin: "0 0 20px", fontSize: "15px", fontWeight: 700, color: "#94a3b8" }}>Phoneme Error Rate</h3>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", flexWrap: "wrap", gap: "20px" }}>
                    <PERGauge value={results.baseline.per} label="Baseline" />
                    <div style={{ textAlign: "center" }}>
                      <p style={{ margin: "0 0 4px", fontSize: "28px", fontWeight: 800, color: "#4ade80" }}>
                        {(((results.baseline.per - results.finetuned.per) / results.baseline.per) * 100).toFixed(0)}%
                      </p>
                      <p style={{ margin: 0, fontSize: "13px", color: "#475569" }}>relative improvement</p>
                    </div>
                    <PERGauge value={results.finetuned.per} label="Fine-tuned" />
                  </div>
                </div>

                {/* Bar chart */}
                <div style={{
                  borderRadius: "14px", padding: "24px",
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
                }}>
                  <h3 style={{ margin: "0 0 20px", fontSize: "15px", fontWeight: 700, color: "#94a3b8" }}>PER Comparison</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={chartData} barSize={56}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: "#64748b", fontSize: 13 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: "#64748b", fontSize: 12 }} axisLine={false} tickLine={false} domain={[0, 70]} tickFormatter={v => `${v}%`} />
                      <Tooltip
                        cursor={{ fill: "rgba(255,255,255,0.03)" }}
                        contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", color: "#e2e8f0" }}
                        formatter={(v) => [`${v}%`, "PER"]}
                      />
                      <Bar dataKey="per" radius={[6, 6, 0, 0]}>
                        {chartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Phoneme diff */}
                <div style={{
                  borderRadius: "14px", padding: "24px",
                  background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.07)",
                }}>
                  <h3 style={{ margin: "0 0 6px", fontSize: "15px", fontWeight: 700, color: "#94a3b8" }}>Phoneme Output Comparison</h3>
                  <p style={{ margin: "0 0 16px", fontSize: "13px", color: "#475569" }}>Both models transcribing the same audio</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    <div>
                      <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#f87171", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Baseline</p>
                      <PhonemeDisplay phonemes={results.baseline.phonemes} />
                    </div>
                    <div>
                      <p style={{ margin: "0 0 8px", fontSize: "11px", color: "#4ade80", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.08em" }}>Fine-tuned (V2)</p>
                      <PhonemeDisplay phonemes={results.finetuned.phonemes} highlight />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Empty state ── */}
        {!hasResults && !Object.values(processing).some(Boolean) && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <Mic size={40} color="rgba(255,255,255,0.08)" style={{ margin: "0 auto 16px" }} />
            <p style={{ color: "#334155", fontSize: "15px" }}>Upload an audio file and click Analyse to see results</p>
          </div>
        )}

        {/* ── Footer ── */}
        <footer style={{ marginTop: "64px", paddingTop: "24px", borderTop: "1px solid rgba(255,255,255,0.06)", textAlign: "center" }}>
          <p style={{ margin: 0, fontSize: "12px", color: "#1e293b" }}>
            FYP Demo · wav2vec2-lv-60-espeak-cv-ft · TORGO Dataset · {new Date().getFullYear()}
          </p>
        </footer>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes progress { 0% { transform: translateX(-100%); } 100% { transform: translateX(200%); } }
        * { box-sizing: border-box; }
        button:hover:not(:disabled) { filter: brightness(1.1); }
      `}</style>
    </div>
  );
}
