import { useState, useRef, useCallback, useEffect } from "react";
import {
  Upload, Mic, Play, Pause, Zap, AlertCircle, CheckCircle,
  RefreshCw, ChevronDown, BarChart3, ArrowRight, Waves
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from "recharts";

// ─── API config ──────────────────────────────────────────────────────────────
const API = process.env.REACT_APP_API_URL || "http://localhost:8000";

const transcribeFile = async (audioFile) => {
  const form = new FormData();
  form.append("audio", audioFile);
  const res = await fetch(`${API}/transcribe`, { method: "POST", body: form });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
};

const transcribeSample = async (sampleId) => {
  const res = await fetch(`${API}/transcribe-sample/${sampleId}`, { method: "POST" });
  if (!res.ok) throw new Error(`Server error: ${res.status}`);
  return res.json();
};

const fetchSamples = async () => {
  const res = await fetch(`${API}/samples`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.samples || [];
};

// ─── Palette ──────────────────────────────────────────────────────────────────
const C = {
  bg:        "#05070f",
  bgSoft:    "#0a0f1f",
  navy:      "#0e1733",
  navyLine:  "#1c2a52",
  ink:       "#e8edff",
  sub:       "#8a98c4",
  faint:     "#4a567e",
  accent:    "#4f7cff",   // primary navy-blue accent
  accentSoft:"#2a3f7a",
  good:      "#46d39a",
  warn:      "#f5c451",
  bad:       "#f4737d",
};

// ─── Animated waveform ────────────────────────────────────────────────────────
const WaveformBars = ({ active, color = C.accent }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "3px", height: "32px" }}>
    {Array.from({ length: 32 }).map((_, i) => (
      <div key={i} style={{
        height: active ? `${18 + Math.sin(i * 0.7) * 12 + Math.random() * 8}px` : `${3 + Math.sin(i * 0.5) * 3}px`,
        background: color, width: "3px", borderRadius: "3px",
        transition: active ? `height ${0.15 + (i % 5) * 0.05}s ease ${i * 0.02}s` : "height 0.4s ease",
        opacity: active ? 0.85 : 0.25,
      }} />
    ))}
  </div>
);

// ─── Phoneme tokens ───────────────────────────────────────────────────────────
const PhonemeDisplay = ({ phonemes, highlight = false }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: "5px", fontFamily: "'JetBrains Mono', monospace" }}>
    {(phonemes || "").split(" ").filter(Boolean).map((ph, i) => (
      <span key={i} style={{
        padding: "2px 7px", borderRadius: "5px", fontSize: "12px", letterSpacing: "0.04em",
        background: highlight ? "rgba(79,124,255,0.14)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${highlight ? "rgba(79,124,255,0.4)" : "rgba(255,255,255,0.08)"}`,
        color: highlight ? "#aec3ff" : C.sub,
      }}>{ph}</span>
    ))}
  </div>
);

// ─── Severity badge ───────────────────────────────────────────────────────────
const SeverityBadge = ({ severity }) => {
  const map = { severe: C.bad, moderate: "#f59e6b", mild: C.warn, control: C.good };
  const col = map[severity] || C.faint;
  return (
    <span style={{
      fontSize: "10.5px", padding: "2px 9px", borderRadius: "100px", fontWeight: 700,
      letterSpacing: "0.05em", textTransform: "uppercase",
      background: `${col}1c`, color: col, border: `1px solid ${col}44`,
    }}>{severity}</span>
  );
};

// ─── Metric gauge (PER / WER) ────────────────────────────────────────────────
const MetricRing = ({ value, label, sublabel }) => {
  const pct = value == null ? null : Math.round(value * 100);
  const col = pct == null ? C.faint : pct < 25 ? C.good : pct < 50 ? C.warn : C.bad;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "8px" }}>
      <div style={{
        position: "relative", width: "104px", height: "104px", borderRadius: "50%",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: pct == null ? "rgba(255,255,255,0.04)"
          : `conic-gradient(${col} ${pct * 3.6}deg, rgba(255,255,255,0.06) 0deg)`,
      }}>
        <div style={{ position: "absolute", inset: "7px", borderRadius: "50%", background: C.bgSoft }} />
        <div style={{ position: "relative", textAlign: "center" }}>
          <div style={{ fontWeight: 800, fontSize: "24px", color: col, lineHeight: 1 }}>
            {pct == null ? "—" : `${pct}%`}
          </div>
        </div>
      </div>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontSize: "13px", fontWeight: 700, color: C.ink }}>{label}</div>
        {sublabel && <div style={{ fontSize: "11px", color: C.faint }}>{sublabel}</div>}
      </div>
    </div>
  );
};

// ─── Model result card ────────────────────────────────────────────────────────
const ModelCard = ({ tag, title, subtitle, data, isProcessing, accent, highlight }) => (
  <div style={{
    borderRadius: "18px", padding: "24px",
    background: highlight
      ? "linear-gradient(160deg, rgba(79,124,255,0.08), rgba(10,15,31,0.4))"
      : "rgba(255,255,255,0.02)",
    border: `1px solid ${highlight ? "rgba(79,124,255,0.28)" : C.navyLine}`,
    position: "relative", overflow: "hidden",
  }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "18px" }}>
      <div>
        <div style={{
          fontSize: "10.5px", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase",
          color: accent, marginBottom: "3px",
        }}>{tag}</div>
        <div style={{ fontSize: "17px", fontWeight: 700, color: C.ink }}>{title}</div>
        <div style={{ fontSize: "12px", color: C.faint }}>{subtitle}</div>
      </div>
      {data?.per != null && (
        <span style={{
          fontSize: "12px", padding: "4px 12px", borderRadius: "100px", fontWeight: 700,
          background: `${accent}1c`, color: accent, border: `1px solid ${accent}44`,
        }}>PER {(data.per * 100).toFixed(1)}%</span>
      )}
    </div>

    {isProcessing && !data && (
      <div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "10px 0" }}>
        <WaveformBars active color={accent} />
        <span style={{ fontSize: "13px", color: C.faint }}>Transcribing…</span>
      </div>
    )}

    {data && (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div>
          <div style={LBL}>Phonemes (IPA)</div>
          <PhonemeDisplay phonemes={data.phonemes} highlight={highlight} />
        </div>
        <div>
          <div style={LBL}>Transcription</div>
          <div style={{
            fontSize: "16px", fontWeight: 600, color: C.ink, lineHeight: 1.5,
            background: "rgba(255,255,255,0.03)", padding: "12px 15px", borderRadius: "10px",
            border: `1px solid ${C.navyLine}`,
          }}>“{data.words}”</div>
        </div>
        <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: C.faint }}>
            {highlight ? <CheckCircle size={13} color={C.good} /> : <AlertCircle size={13} color={accent} />}
            Confidence {data.confidence != null ? `${(data.confidence * 100).toFixed(0)}%` : "—"}
          </span>
          {data.infer_time != null && (
            <span style={{ fontSize: "12px", color: C.faint }}>· {data.infer_time}s</span>
          )}
        </div>
      </div>
    )}
  </div>
);

const LBL = {
  fontSize: "10.5px", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
  color: C.faint, marginBottom: "8px",
};

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function App() {
  const [started, setStarted]       = useState(false);
  const [audioFile, setAudioFile]   = useState(null);
  const [audioUrl, setAudioUrl]     = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPlaying, setIsPlaying]   = useState(false);
  const [isProcessing, setIsProc]   = useState(false);
  const [results, setResults]       = useState(null);
  const [showCompare, setShowCompare] = useState(false);
  const [samples, setSamples]       = useState([]);
  const [activeSample, setActiveSample] = useState(null);
  const [sampleOpen, setSampleOpen] = useState(false);
  const [error, setError]           = useState(null);
  const audioRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => { fetchSamples().then(setSamples).catch(() => {}); }, []);

  const handleFile = useCallback((file) => {
    if (!file || !file.type.startsWith("audio/")) return;
    setAudioFile(file); setAudioUrl(URL.createObjectURL(file));
    setResults(null); setActiveSample(null); setError(null); setShowCompare(false);
  }, []);

  const handleDrop = (e) => { e.preventDefault(); setIsDragging(false); handleFile(e.dataTransfer.files[0]); };

  const pickSample = (s) => {
    setActiveSample(s); setAudioFile(null); setAudioUrl(null);
    setResults(null); setError(null); setSampleOpen(false); setShowCompare(false);
  };

  const togglePlay = () => {
    if (!audioRef.current) return;
    isPlaying ? audioRef.current.pause() : audioRef.current.play();
    setIsPlaying(!isPlaying);
  };

  const reset = () => {
    setAudioFile(null); setAudioUrl(null); setActiveSample(null);
    setResults(null); setError(null); setIsPlaying(false); setShowCompare(false);
  };

  const runAnalysis = async () => {
    setError(null); setResults(null); setShowCompare(false); setIsProc(true);
    try {
      let data;
      if (activeSample)      data = await transcribeSample(activeSample.id);
      else if (audioFile)    data = await transcribeFile(audioFile);
      else return;
      setResults(data);
    } catch (err) {
      setError(err.message || "Something went wrong — is the backend running?");
    } finally { setIsProc(false); }
  };

  const hasInput   = audioFile || activeSample;
  const bothDone   = results?.baseline && results?.finetuned;

  // metrics
  const blPer = results?.baseline?.per  ?? results?.model_metrics?.baseline_test_per ?? null;
  const v2Per = results?.finetuned?.per ?? results?.model_metrics?.v2_late_test_per  ?? null;
  const blWer = results?.baseline?.wer  ?? null;
  const v2Wer = results?.finetuned?.wer ?? null;

  const perChart = (blPer != null && v2Per != null) ? [
    { name: "Baseline",   v: +(blPer * 100).toFixed(1), fill: C.bad },
    { name: "Version 2",  v: +(v2Per * 100).toFixed(1), fill: C.good },
  ] : [];
  const werChart = (blWer != null && v2Wer != null) ? [
    { name: "Baseline",   v: +(blWer * 100).toFixed(1), fill: C.bad },
    { name: "Version 2",  v: +(v2Wer * 100).toFixed(1), fill: C.good },
  ] : [];

  const perImp = (blPer != null && v2Per != null && blPer > 0)
    ? (((blPer - v2Per) / blPer) * 100).toFixed(1) : null;

  // ── WELCOME SCREEN ──────────────────────────────────────────────────────────
  if (!started) {
    return (
      <div style={SHELL}>
        <Backdrop />
        <div style={{ position: "relative", zIndex: 1, minHeight: "100vh", display: "flex",
          alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ maxWidth: "640px", textAlign: "center" }}>
            <div style={{
              display: "inline-flex", alignItems: "center", gap: "9px", padding: "7px 16px",
              borderRadius: "100px", marginBottom: "32px",
              background: "rgba(79,124,255,0.1)", border: "1px solid rgba(79,124,255,0.25)",
              animation: "fadeUp 0.6s ease both",
            }}>
              <Waves size={15} color={C.accent} />
              <span style={{ fontSize: "12.5px", color: "#aec3ff", fontWeight: 600, letterSpacing: "0.06em" }}>
                Dysarthric Speech Recognition
              </span>
            </div>

            <h1 style={{
              fontSize: "clamp(38px, 7vw, 68px)", fontWeight: 800, lineHeight: 1.05, margin: "0 0 22px",
              letterSpacing: "-0.03em", color: C.ink, animation: "fadeUp 0.6s ease 0.1s both",
            }}>
              Can AI tell what's<br />
              <span style={{
                background: `linear-gradient(120deg, ${C.accent}, #8fb0ff)`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
              }}>behind the voice?</span>
            </h1>

            <p style={{
              fontSize: "17px", color: C.sub, lineHeight: 1.65, maxWidth: "500px", margin: "0 auto 40px",
              animation: "fadeUp 0.6s ease 0.2s both",
            }}>
              A phoneme-informed speech model that hears impaired speech more clearly.
              Upload a clip and compare the off-the-shelf baseline against our trained model.
            </p>

            <button onClick={() => setStarted(true)} style={{
              ...BTN_PRIMARY, fontSize: "16px", padding: "15px 34px",
              animation: "fadeUp 0.6s ease 0.3s both",
            }}>
              Get started <ArrowRight size={18} />
            </button>
          </div>
        </div>
        <GlobalStyle />
      </div>
    );
  }

  // ── MAIN APP ────────────────────────────────────────────────────────────────
  return (
    <div style={SHELL}>
      <Backdrop />
      <div style={{ position: "relative", zIndex: 1, maxWidth: "920px", margin: "0 auto", padding: "0 24px 90px" }}>

        {/* Header */}
        <header style={{ padding: "32px 0 28px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "11px", cursor: "pointer" }} onClick={() => { setStarted(false); reset(); }}>
            <div style={{ width: "34px", height: "34px", borderRadius: "9px",
              background: `linear-gradient(135deg, ${C.accent}, ${C.accentSoft})`,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Waves size={18} color="#fff" />
            </div>
            <span style={{ fontWeight: 700, fontSize: "15px", color: C.ink, letterSpacing: "-0.01em" }}>
              Behind the Voice
            </span>
          </div>
          <span style={{ fontSize: "12px", color: C.faint }}>wav2vec2 · TORGO</span>
        </header>

        {/* Title */}
        <div style={{ marginBottom: "26px" }}>
          <h2 style={{ fontSize: "26px", fontWeight: 800, color: C.ink, margin: "0 0 6px", letterSpacing: "-0.02em" }}>
            Analyse a speech sample
          </h2>
          <p style={{ fontSize: "14.5px", color: C.sub, margin: 0 }}>
            Drop an audio file or choose a TORGO sample, then run both models side by side.
          </p>
        </div>

        {/* Upload zone */}
        <section
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !hasInput && fileInputRef.current?.click()}
          style={{
            border: `1.5px dashed ${isDragging ? C.accent : hasInput ? "rgba(79,124,255,0.4)" : C.navyLine}`,
            borderRadius: "16px", padding: hasInput ? "20px 22px" : "44px 24px", textAlign: "center",
            cursor: hasInput ? "default" : "pointer", transition: "all 0.25s ease",
            background: isDragging ? "rgba(79,124,255,0.05)" : "rgba(255,255,255,0.015)", marginBottom: "14px",
          }}>
          <input ref={fileInputRef} type="file" accept="audio/*" style={{ display: "none" }}
            onChange={(e) => handleFile(e.target.files[0])} />

          {activeSample ? (
            <div style={ROW}>
              <div style={ICON_CIRCLE}><Mic size={19} color={C.accent} /></div>
              <div style={{ flex: 1, textAlign: "left" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "3px" }}>
                  <span style={{ fontWeight: 600, color: C.ink, fontSize: "14px" }}>{activeSample.speaker}</span>
                  <SeverityBadge severity={activeSample.severity} />
                </div>
                <span style={{ fontSize: "13px", color: C.faint }}>“{activeSample.transcript}”</span>
              </div>
              <button onClick={(e) => { e.stopPropagation(); reset(); }} style={BTN_GHOST}>Remove</button>
            </div>
          ) : audioFile ? (
            <div style={ROW}>
              <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} style={{
                width: "44px", height: "44px", borderRadius: "50%", border: "none", flexShrink: 0,
                background: `linear-gradient(135deg, ${C.accent}, ${C.accentSoft})`, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center" }}>
                {isPlaying ? <Pause size={17} color="#fff" /> : <Play size={17} color="#fff" />}
              </button>
              <div style={{ flex: 1, textAlign: "left", minWidth: "120px" }}>
                <div style={{ fontWeight: 600, color: C.ink, fontSize: "14px" }}>{audioFile.name}</div>
                <div style={{ fontSize: "12px", color: C.faint }}>{(audioFile.size / 1024).toFixed(0)} KB</div>
              </div>
              <WaveformBars active={isPlaying} />
              <button onClick={(e) => { e.stopPropagation(); reset(); }} style={BTN_GHOST}>Remove</button>
              {audioUrl && <audio ref={audioRef} src={audioUrl} onEnded={() => setIsPlaying(false)} style={{ display: "none" }} />}
            </div>
          ) : (
            <>
              <div style={{ ...ICON_CIRCLE, margin: "0 auto 16px", width: "52px", height: "52px", borderRadius: "14px" }}>
                <Upload size={23} color={C.accent} />
              </div>
              <div style={{ fontWeight: 600, fontSize: "16px", color: C.ink, marginBottom: "5px" }}>Drop an audio file</div>
              <div style={{ fontSize: "13.5px", color: C.faint }}>or click to browse · .wav .mp3 .flac</div>
            </>
          )}
        </section>

        {/* Sample picker */}
        {!hasInput && samples.length > 0 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", margin: "14px 0" }}>
              <div style={{ flex: 1, height: "1px", background: C.navyLine }} />
              <span style={{ fontSize: "11px", color: C.faint, fontWeight: 600, letterSpacing: "0.08em" }}>OR TRY A TORGO SAMPLE</span>
              <div style={{ flex: 1, height: "1px", background: C.navyLine }} />
            </div>
            <div style={{ position: "relative", marginBottom: "8px" }}>
              <button onClick={() => setSampleOpen((o) => !o)} style={{
                width: "100%", padding: "13px 16px", borderRadius: "12px", cursor: "pointer",
                background: "rgba(255,255,255,0.02)", border: `1px solid ${C.navyLine}`, color: C.sub,
                display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: "14px" }}>
                <span>Select a pre-loaded clip…</span>
                <ChevronDown size={16} style={{ transition: "transform 0.2s", transform: sampleOpen ? "rotate(180deg)" : "none" }} />
              </button>
              {sampleOpen && (
                <div style={{
                  position: "absolute", top: "calc(100% + 6px)", left: 0, right: 0, zIndex: 20,
                  background: C.navy, border: `1px solid ${C.navyLine}`, borderRadius: "12px",
                  overflow: "hidden", maxHeight: "320px", overflowY: "auto",
                  boxShadow: "0 24px 60px rgba(0,0,0,0.6)" }}>
                  {samples.map((s) => (
                    <button key={s.id} onClick={() => pickSample(s)} style={{
                      width: "100%", padding: "12px 16px", background: "none", border: "none",
                      borderBottom: `1px solid ${C.navyLine}`, cursor: "pointer", textAlign: "left",
                      display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(79,124,255,0.06)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "none")}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
                          <span style={{ fontWeight: 600, fontSize: "13px", color: C.ink }}>{s.speaker}</span>
                          <SeverityBadge severity={s.severity} />
                        </div>
                        <span style={{ fontSize: "12px", color: C.faint }}>“{s.transcript}”</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Analyse button */}
        <button onClick={runAnalysis} disabled={!hasInput || isProcessing} style={{
          ...BTN_PRIMARY, width: "100%", justifyContent: "center", marginTop: "10px",
          opacity: hasInput && !isProcessing ? 1 : 0.4,
          cursor: hasInput && !isProcessing ? "pointer" : "not-allowed",
        }}>
          {isProcessing
            ? <><RefreshCw size={17} style={{ animation: "spin 1s linear infinite" }} /> Analysing…</>
            : <><Zap size={17} /> Analyse!</>}
        </button>

        {/* Error */}
        {error && (
          <div style={{ marginTop: "20px", padding: "14px 18px", borderRadius: "12px",
            background: "rgba(244,115,125,0.08)", border: "1px solid rgba(244,115,125,0.3)",
            display: "flex", gap: "10px", alignItems: "flex-start" }}>
            <AlertCircle size={16} color={C.bad} style={{ flexShrink: 0, marginTop: "2px" }} />
            <div>
              <div style={{ fontWeight: 600, color: C.bad, fontSize: "14px", marginBottom: "3px" }}>Backend error</div>
              <div style={{ fontSize: "13px", color: C.sub }}>{error}</div>
              <div style={{ fontSize: "12px", color: C.faint, marginTop: "6px" }}>
                Make sure the backend is running: <code style={{ color: C.accent }}>python server.py</code>
              </div>
            </div>
          </div>
        )}

        {/* Reference banner */}
        {results?.reference && (
          <div style={{ marginTop: "24px", padding: "12px 16px", borderRadius: "12px",
            background: "rgba(79,124,255,0.07)", border: "1px solid rgba(79,124,255,0.2)",
            display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <CheckCircle size={14} color={C.accent} />
            <span style={{ fontSize: "13px", color: C.sub }}>
              Ground truth: <strong style={{ color: C.ink }}>“{results.reference.transcript}”</strong>
            </span>
            <SeverityBadge severity={results.reference.severity} />
          </div>
        )}

        {/* Model cards */}
        {(results || isProcessing) && (
          <div style={{ marginTop: "26px", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
            <ModelCard tag="Baseline Model" title="Off-the-shelf wav2vec2" subtitle="No fine-tuning"
              data={results?.baseline} isProcessing={isProcessing} accent={C.bad} highlight={false} />
            <ModelCard tag="Version 2 Trained" title="F0 + MFCC injection" subtitle="Trained on TORGO"
              data={results?.finetuned} isProcessing={isProcessing} accent={C.good} highlight={true} />
          </div>
        )}

        {/* Compare button */}
        {bothDone && !showCompare && (
          <button onClick={() => setShowCompare(true)} style={{
            ...BTN_SECONDARY, width: "100%", justifyContent: "center", marginTop: "18px",
          }}>
            <BarChart3 size={17} /> Show PER &amp; WER comparison
          </button>
        )}

        {/* Comparison panel */}
        {bothDone && showCompare && (
          <div style={{ marginTop: "22px", display: "flex", flexDirection: "column", gap: "16px",
            animation: "fadeUp 0.45s ease both" }}>

            {/* Rings */}
            <div style={CARD}>
              <div style={CARD_TITLE}>Error rate comparison</div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", flexWrap: "wrap", gap: "20px" }}>
                <MetricRing value={blPer} label="Baseline" sublabel="PER" />
                <MetricRing value={v2Per} label="Version 2" sublabel="PER" />
                <div style={{ width: "1px", alignSelf: "stretch", background: C.navyLine }} />
                <MetricRing value={blWer} label="Baseline" sublabel="WER" />
                <MetricRing value={v2Wer} label="Version 2" sublabel="WER" />
              </div>
              {perImp && (
                <div style={{ textAlign: "center", marginTop: "20px", paddingTop: "18px", borderTop: `1px solid ${C.navyLine}` }}>
                  <span style={{ fontSize: "30px", fontWeight: 800, color: C.good }}>{perImp}%</span>
                  <span style={{ fontSize: "14px", color: C.sub, marginLeft: "8px" }}>relative PER reduction</span>
                </div>
              )}
            </div>

            {/* PER bar chart */}
            {perChart.length > 0 && (
              <div style={CARD}>
                <div style={CARD_TITLE}>Phoneme Error Rate (PER)</div>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={perChart} barSize={54}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.navyLine} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: C.sub, fontSize: 13 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.faint, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }}
                      contentStyle={{ background: C.navy, border: `1px solid ${C.navyLine}`, borderRadius: "8px", color: C.ink }}
                      formatter={(v) => [`${v}%`, "PER"]} />
                    <Bar dataKey="v" radius={[7, 7, 0, 0]}>
                      {perChart.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* WER bar chart */}
            {werChart.length > 0 ? (
              <div style={CARD}>
                <div style={CARD_TITLE}>Word Error Rate (WER)</div>
                <ResponsiveContainer width="100%" height={170}>
                  <BarChart data={werChart} barSize={54}>
                    <CartesianGrid strokeDasharray="3 3" stroke={C.navyLine} vertical={false} />
                    <XAxis dataKey="name" tick={{ fill: C.sub, fontSize: 13 }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fill: C.faint, fontSize: 12 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${v}%`} />
                    <Tooltip cursor={{ fill: "rgba(255,255,255,0.03)" }}
                      contentStyle={{ background: C.navy, border: `1px solid ${C.navyLine}`, borderRadius: "8px", color: C.ink }}
                      formatter={(v) => [`${v}%`, "WER"]} />
                    <Bar dataKey="v" radius={[7, 7, 0, 0]}>
                      {werChart.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div style={{ ...CARD, textAlign: "center", color: C.faint, fontSize: "13px" }}>
                WER is shown for TORGO samples with known ground-truth text.
              </div>
            )}

            {/* Phoneme diff */}
            <div style={CARD}>
              <div style={CARD_TITLE}>Phoneme output comparison</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div>
                  <div style={{ ...LBL, color: C.bad }}>Baseline</div>
                  <PhonemeDisplay phonemes={results.baseline.phonemes} />
                </div>
                <div>
                  <div style={{ ...LBL, color: C.good }}>Version 2 Trained</div>
                  <PhonemeDisplay phonemes={results.finetuned.phonemes} highlight />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <footer style={{ marginTop: "60px", paddingTop: "22px", borderTop: `1px solid ${C.navyLine}`, textAlign: "center" }}>
          <span style={{ fontSize: "12px", color: C.faint }}>
            Phoneme-Informed Dysarthric Speech Recognition · wav2vec2-lv-60-espeak-cv-ft · {new Date().getFullYear()}
          </span>
        </footer>
      </div>
      <GlobalStyle />
    </div>
  );
}

// ─── Shared styles ────────────────────────────────────────────────────────────
const SHELL = { minHeight: "100vh", background: C.bg, color: C.ink,
  fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif", position: "relative" };

const BTN_PRIMARY = {
  display: "inline-flex", alignItems: "center", gap: "9px", padding: "14px 24px",
  borderRadius: "12px", border: "none", fontWeight: 700, fontSize: "15px",
  color: "#fff", background: `linear-gradient(135deg, ${C.accent}, ${C.accentSoft})`,
  cursor: "pointer", transition: "all 0.2s ease",
};
const BTN_SECONDARY = {
  display: "inline-flex", alignItems: "center", gap: "9px", padding: "13px 22px",
  borderRadius: "12px", fontWeight: 700, fontSize: "14.5px", color: "#aec3ff",
  background: "rgba(79,124,255,0.1)", border: "1px solid rgba(79,124,255,0.3)",
  cursor: "pointer", transition: "all 0.2s ease",
};
const BTN_GHOST = {
  background: "none", border: `1px solid ${C.navyLine}`, borderRadius: "8px",
  padding: "6px 12px", color: C.faint, cursor: "pointer", fontSize: "12px", flexShrink: 0,
};
const ROW = { display: "flex", alignItems: "center", gap: "15px", flexWrap: "wrap" };
const ICON_CIRCLE = { width: "44px", height: "44px", borderRadius: "50%", flexShrink: 0,
  background: "rgba(79,124,255,0.12)", display: "flex", alignItems: "center", justifyContent: "center" };
const CARD = { borderRadius: "16px", padding: "22px", background: "rgba(255,255,255,0.02)", border: `1px solid ${C.navyLine}` };
const CARD_TITLE = { fontSize: "14px", fontWeight: 700, color: C.sub, marginBottom: "18px" };

// ─── Backdrop + global style ──────────────────────────────────────────────────
const Backdrop = () => (
  <>
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
      background: `radial-gradient(ellipse 80% 50% at 50% -10%, rgba(79,124,255,0.12), transparent 70%)` }} />
    <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", opacity: 0.035,
      backgroundImage: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")" }} />
  </>
);

const GlobalStyle = () => (
  <style>{`
    @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap');
    * { box-sizing: border-box; }
    body { margin: 0; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
    button:hover:not(:disabled) { filter: brightness(1.08); }
    ::-webkit-scrollbar { width: 10px; }
    ::-webkit-scrollbar-track { background: ${C.bgSoft}; }
    ::-webkit-scrollbar-thumb { background: ${C.navyLine}; border-radius: 5px; }
  `}</style>
);