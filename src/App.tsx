import React, { useEffect, useMemo, useRef, useState } from "react";
import WaveSurfer from "wavesurfer.js";
import "./App.css";

type LyricLine = {
  t: number;
  ts: string;
  text: string;
};

type LyricsPayload = {
  lyrics: LyricLine[];
};

function formatProjectTs(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = Math.floor(safe % 60);
  const centiseconds = Math.round((safe - Math.floor(safe)) * 100);

  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const cc = String(centiseconds).padStart(2, "0");

  return `T+${mm}:${ss}.${cc}`;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

const sampleJson = `{
  "lyrics": [
    {
      "t": 0.48,
      "ts": "T+00:00.48",
      "text": "Under desert skies,"
    },
    {
      "t": 4.48,
      "ts": "T+00:04.48",
      "text": "we stand exposed"
    }
  ]
}`;

const sampleTxt = `Under desert skies,
we stand exposed
Concrete walls,
and broken roads`;

export default function App() {
  const waveformRef = useRef<HTMLDivElement | null>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const lyricRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [jsonText, setJsonText] = useState(sampleJson);
  const [plainText, setPlainText] = useState(sampleTxt);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isReady, setIsReady] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [error, setError] = useState("");
  const [manualSelectionLock, setManualSelectionLock] = useState(false);

  const [txtStartTime, setTxtStartTime] = useState("0.00");
  const [txtStepTime, setTxtStepTime] = useState("4.00");
  const [srtDelay, setSrtDelay] = useState("0");

  useEffect(() => {
    if (!waveformRef.current) return;

    const ws = WaveSurfer.create({
      container: waveformRef.current,
      height: 120,
      waveColor: "#6b7280",
      progressColor: "#22c55e",
      cursorColor: "#ffffff",
      barWidth: 2,
      barGap: 1,
      dragToSeek: true,
      normalize: true,
    });

    waveSurferRef.current = ws;

    ws.on("ready", () => {
      setDuration(ws.getDuration());
      setIsReady(true);
    });

    ws.on("timeupdate", (time) => {
      setCurrentTime(time);
    });

    ws.on("play", () => setIsPlaying(true));
    ws.on("pause", () => setIsPlaying(false));
    ws.on("finish", () => setIsPlaying(false));

    return () => {
      ws.destroy();
      waveSurferRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!audioUrl || !waveSurferRef.current) return;
    setIsReady(false);
    waveSurferRef.current.load(audioUrl);
  }, [audioUrl]);

  useEffect(() => {
    if (!lyrics.length || !isPlaying || manualSelectionLock) return;

    const idx = lyrics.findIndex((line, i) => {
      const start = line.t;
      const end =
        i < lyrics.length - 1 ? lyrics[i + 1].t : Number.POSITIVE_INFINITY;
      return currentTime >= start && currentTime < end;
    });

    if (idx !== -1 && idx !== selectedIndex) {
      setSelectedIndex(idx);
    }
  }, [currentTime, lyrics, selectedIndex, isPlaying, manualSelectionLock]);

  useEffect(() => {
    const el = lyricRefs.current[selectedIndex];
    if (el) {
      el.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [selectedIndex]);

  useEffect(() => {
    const pressed = new Set<string>();
    let repeatInterval: number | null = null;
    let repeatTimeout: number | null = null;

    const isTypingTarget = (target: EventTarget | null) => {
      const tag = (target as HTMLElement | null)?.tagName?.toLowerCase();
      return tag === "textarea" || tag === "input";
    };

    const stopRepeat = () => {
      if (repeatTimeout !== null) {
        window.clearTimeout(repeatTimeout);
        repeatTimeout = null;
      }
      if (repeatInterval !== null) {
        window.clearInterval(repeatInterval);
        repeatInterval = null;
      }
    };

    const runHeldNudges = () => {
      if (pressed.has("[")) nudgeSelected(-0.01);
      if (pressed.has("]")) nudgeSelected(0.01);
      if (pressed.has("{")) nudgeSelected(-0.05);
      if (pressed.has("}")) nudgeSelected(0.05);
    };

    const startRepeat = () => {
      if (repeatTimeout !== null || repeatInterval !== null) return;

      repeatTimeout = window.setTimeout(() => {
        runHeldNudges();
        repeatInterval = window.setInterval(() => {
          runHeldNudges();
        }, 40);
      }, 200);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) return;

      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) {
          togglePlay();
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (!e.repeat) {
          setManualSelectionLock(true);
          setSelectedIndex((prev) => Math.min(prev + 1, lyrics.length - 1));
        }
        return;
      }

      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (!e.repeat) {
          setManualSelectionLock(true);
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
        }
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        if (!e.repeat) {
          syncSelectedToCurrentTime();
        }
        return;
      }

      if (["[", "]", "{", "}"].includes(e.key)) {
        e.preventDefault();

        if (!pressed.has(e.key)) {
          pressed.add(e.key);
          runHeldNudges();
        }

        startRepeat();
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (["[", "]", "{", "}"].includes(e.key)) {
        pressed.delete(e.key);
        if (pressed.size === 0) {
          stopRepeat();
        }
      }
    };

    const onWindowBlur = () => {
      pressed.clear();
      stopRepeat();
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onWindowBlur);

    return () => {
      stopRepeat();
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onWindowBlur);
    };
  }, [lyrics.length, selectedIndex, isReady, isPlaying, currentTime, duration]);

  const selectedLine = lyrics[selectedIndex];

  const parsedOutput = useMemo(() => {
    return JSON.stringify({ lyrics }, null, 2);
  }, [lyrics]);

  function togglePlay() {
    if (!waveSurferRef.current || !isReady) return;
    waveSurferRef.current.playPause();
  }

  function parseJson() {
    try {
      setError("");
      const parsed = JSON.parse(jsonText) as LyricsPayload;

      if (!parsed.lyrics || !Array.isArray(parsed.lyrics)) {
        throw new Error('JSON must contain a top-level "lyrics" array.');
      }

      const normalized = parsed.lyrics.map((line) => {
        const t = round3(Number(line.t ?? 0));
        return {
          t,
          ts:
            typeof line.ts === "string" && line.ts.trim()
              ? line.ts
              : formatProjectTs(t),
          text: String(line.text ?? ""),
        };
      });

      setLyrics(normalized);
      setSelectedIndex(0);
      setManualSelectionLock(false);
      lyricRefs.current = [];
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid JSON");
    }
  }

  function importPlainTextLines() {
    try {
      setError("");

      const start = round3(Number(txtStartTime));
      const step = round3(Number(txtStepTime));

      if (Number.isNaN(start) || Number.isNaN(step)) {
        throw new Error("Start time and step must be valid numbers.");
      }

      if (step < 0) {
        throw new Error("Step must be 0 or greater.");
      }

      const lines = plainText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      const generated: LyricLine[] = lines.map((text, i) => {
        const t = round3(start + i * step);
        return {
          t,
          ts: formatProjectTs(t),
          text,
        };
      });

      setLyrics(generated);
      setSelectedIndex(0);
      setManualSelectionLock(false);
      lyricRefs.current = [];
      setJsonText(JSON.stringify({ lyrics: generated }, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not import text lines");
    }
  }

  function syncSelectedToCurrentTime() {
    setLyrics((prev) => {
      if (!prev.length) return prev;

      return prev.map((line, i) => {
        if (i !== selectedIndex) return line;

        const newTime = round3(currentTime);

        return {
          ...line,
          t: newTime,
          ts: formatProjectTs(newTime),
        };
      });
    });

    setSelectedIndex((prev) => Math.min(prev + 1, lyrics.length - 1));
    setManualSelectionLock(true);
  }

  function seekAndPlay(seconds: number) {
    if (!waveSurferRef.current) return;

    const ws = waveSurferRef.current;
    const maxDuration = duration > 0 ? duration : seconds;
    const clamped = Math.max(0, Math.min(seconds, maxDuration));

    if (typeof (ws as any).setTime === "function") {
      (ws as any).setTime(clamped);
    } else if (duration > 0) {
      ws.seekTo(clamped / duration);
    }

    ws.play();
  }

  function nudgeSelected(delta: number) {
    if (!waveSurferRef.current || !lyrics[selectedIndex]) return;

    const currentLine = lyrics[selectedIndex];
    const newT = round3(Math.max(0, currentLine.t + delta));

    setLyrics((prev) =>
      prev.map((line, i) =>
        i === selectedIndex
          ? {
              ...line,
              t: newT,
              ts: formatProjectTs(newT),
            }
          : line
      )
    );

    setManualSelectionLock(true);
    seekAndPlay(newT);
  }

  function updateSelectedText(text: string) {
    setLyrics((prev) =>
      prev.map((line, i) => (i === selectedIndex ? { ...line, text } : line))
    );
  }

  function sortByTime() {
    setLyrics((prev) =>
      [...prev].sort((a, b) => a.t - b.t).map((line) => {
        const t = round3(line.t);
        return {
          ...line,
          t,
          ts: formatProjectTs(t),
        };
      })
    );
  }

  function addLineAfterSelected() {
    const baseTime =
      lyrics.length === 0
        ? round3(currentTime || 0)
        : selectedLine
        ? round3(selectedLine.t + 2)
        : round3(0);

    const newLine: LyricLine = {
      t: baseTime,
      ts: formatProjectTs(baseTime),
      text: "",
    };

    setLyrics((prev) => {
      if (prev.length === 0) return [newLine];

      const insertAt = Math.min(selectedIndex + 1, prev.length);
      const next = [...prev];
      next.splice(insertAt, 0, newLine);
      return next;
    });

    setSelectedIndex((prev) =>
      lyrics.length === 0 ? 0 : Math.min(prev + 1, lyrics.length)
    );
    setManualSelectionLock(true);
  }

  function downloadJson() {
    const blob = new Blob([parsedOutput], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "synced-lyrics.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleAudioFile(file: File) {
    const url = URL.createObjectURL(file);
    setAudioUrl(url);
  }

  function loadJsonFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setJsonText(String(reader.result || ""));
    };
    reader.readAsText(file);
  }

  function loadTxtFile(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      setPlainText(String(reader.result || ""));
    };
    reader.readAsText(file);
  }

  function formatSrtTime(seconds: number): string {
    const safe = Math.max(0, seconds);

    let totalMs = Math.round(safe * 1000);

    const hours = Math.floor(totalMs / 3600000);
    totalMs -= hours * 3600000;

    const minutes = Math.floor(totalMs / 60000);
    totalMs -= minutes * 60000;

    const secs = Math.floor(totalMs / 1000);
    totalMs -= secs * 1000;

    const hh = String(hours).padStart(2, "0");
    const mm = String(minutes).padStart(2, "0");
    const ss = String(secs).padStart(2, "0");
    const ms = String(totalMs).padStart(3, "0");

    return `${hh}:${mm}:${ss},${ms}`;
  }

  function exportToSrt() {
    if (!lyrics.length) return;

    const delay = Number(srtDelay);
    const safeDelay = Number.isFinite(delay) ? delay : 0;

    const MAX_DURATION = 7.0;
    const DEFAULT_LAST_DURATION = 3.0;
    const MIN_DURATION = 0.2;

    const cleaned = [...lyrics]
      .map((line) => ({
        ...line,
        text: line.text.trim(),
      }))
      .filter((line) => line.text.length > 0)
      .sort((a, b) => a.t - b.t);

    if (!cleaned.length) return;

    const srt = cleaned
      .map((line, i) => {
        const rawStart = line.t + safeDelay;

        let rawEnd: number;
        if (i < cleaned.length - 1) {
          rawEnd = cleaned[i + 1].t + safeDelay;
        } else {
          rawEnd = rawStart + DEFAULT_LAST_DURATION;
        }

        const start = Math.max(0, rawStart);

        let end = Math.max(start + MIN_DURATION, rawEnd);
        end = Math.min(end, start + MAX_DURATION);

        return [
          String(i + 1),
          `${formatSrtTime(start)} --> ${formatSrtTime(end)}`,
          line.text,
          "",
        ].join("\n");
      })
      .join("\n");

    const blob = new Blob([srt], { type: "application/x-subrip" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = "subtitles.srt";
    a.click();

    URL.revokeObjectURL(url);
  }

  function parseSrtTimeToSeconds(value: string): number {
    const match = value.trim().match(
      /^(?:(\d{2}):)?(\d{2}):(\d{2})[,.](\d{3})$/
    );

    if (!match) return 0;

    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2] ?? 0);
    const seconds = Number(match[3] ?? 0);
    const millis = Number(match[4] ?? 0);

    return round3(hours * 3600 + minutes * 60 + seconds + millis / 1000);
  }

  function parseSrtToLyrics(srtText: string): LyricLine[] {
    const normalized = srtText.replace(/\r\n/g, "\n").trim();
    if (!normalized) return [];

    const blocks = normalized.split(/\n{2,}/);
    const parsed: LyricLine[] = [];

    for (const block of blocks) {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);

      if (lines.length < 2) continue;

      let timeLineIndex = 0;

      if (!lines[0].includes("-->")) {
        timeLineIndex = 1;
      }

      const timeLine = lines[timeLineIndex];
      if (!timeLine || !timeLine.includes("-->")) continue;

      const [startRaw] = timeLine.split("-->").map((s) => s.trim());
      const start = parseSrtTimeToSeconds(startRaw);

      const textLines = lines.slice(timeLineIndex + 1);
      const text = textLines.join("\n").trim();

      if (!text) continue;

      parsed.push({
        t: start,
        ts: formatProjectTs(start),
        text,
      });
    }

    return parsed.sort((a, b) => a.t - b.t);
  }

  function loadSrtFile(file: File) {
    const reader = new FileReader();

    reader.onload = () => {
      try {
        setError("");

        const text = String(reader.result || "");
        const parsed = parseSrtToLyrics(text);

        if (!parsed.length) {
          throw new Error("No valid subtitle entries found in SRT file.");
        }

        setLyrics(parsed);
        setSelectedIndex(0);
        setManualSelectionLock(false);
        lyricRefs.current = [];

        const convertedJson = JSON.stringify({ lyrics: parsed }, null, 2);
        setJsonText(convertedJson);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not import SRT file");
      }
    };

    reader.readAsText(file);
  }

  return (
    <div className="app">
      <header className="topbar">
        <h1>Lyric Sync Tool</h1>
      </header>

      <section className="panel">
        <div className="row">
          <div>
            <label className="label">Load MP3/Audio</label>
            <input
              type="file"
              accept="audio/mpeg,audio/mp3,audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleAudioFile(file);
              }}
            />
          </div>

          <div>
            <label className="label">Load JSON</label>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadJsonFile(file);
              }}
            />
          </div>

          <div>
            <label className="label">Load SRT</label>
            <input
              type="file"
              accept=".srt,text/plain"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadSrtFile(file);
              }}
            />
          </div>

          <div>
            <label className="label">Load TXT</label>
            <input
              type="file"
              accept=".txt,text/plain"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) loadTxtFile(file);
              }}
            />
          </div>
        </div>

        <div className="wavePanel">
          <div ref={waveformRef} className="waveform" />
          <div className="transport">
            <button onClick={togglePlay} disabled={!isReady}>
              {isPlaying ? "Pause" : "Play"}
            </button>

            <button
              onClick={() => {
                if (waveSurferRef.current) {
                  waveSurferRef.current.stop();
                  setCurrentTime(0);
                  setManualSelectionLock(false);
                }
              }}
              disabled={!isReady}
            >
              Stop
            </button>

            <button
              onClick={() => {
                if (selectedLine) {
                  setManualSelectionLock(true);
                  seekAndPlay(selectedLine.t);
                }
              }}
              disabled={!selectedLine}
            >
              Jump to selected
            </button>

            <button
              onClick={() => setManualSelectionLock(false)}
              disabled={!lyrics.length}
            >
              Resume auto-follow
            </button>

            <span>
              {currentTime.toFixed(3)}s / {duration.toFixed(3)}s
            </span>

            <span>
              Mode: {manualSelectionLock ? "Manual selection locked" : "Auto-follow"}
            </span>
          </div>
        </div>
      </section>

      <main className="grid">
        <section className="panel">
          <div className="panelHeader">
            <h2>Lyrics JSON</h2>
            <div className="row">
              <button onClick={parseJson}>Parse JSON</button>
              <button onClick={sortByTime} disabled={!lyrics.length}>
                Sort by time
              </button>
            </div>
          </div>

          <textarea
            className="jsonBox"
            value={jsonText}
            onChange={(e) => setJsonText(e.target.value)}
            spellCheck={false}
          />

          {error ? <p className="error">{error}</p> : null}
        </section>

        <section className="panel">
          <div className="panelHeader">
            <h2>Plain text import</h2>
            <div className="row">
              <label>
                Start
                <input
                  type="number"
                  step="0.01"
                  value={txtStartTime}
                  onChange={(e) => setTxtStartTime(e.target.value)}
                  style={{ marginLeft: 8, width: 90 }}
                />
              </label>

              <label>
                Step
                <input
                  type="number"
                  step="0.01"
                  value={txtStepTime}
                  onChange={(e) => setTxtStepTime(e.target.value)}
                  style={{ marginLeft: 8, width: 90 }}
                />
              </label>

              <button onClick={importPlainTextLines}>Generate from text</button>
            </div>
          </div>

          <textarea
            className="jsonBox"
            value={plainText}
            onChange={(e) => setPlainText(e.target.value)}
            spellCheck={false}
          />
        </section>
      </main>

      <section className="panel">
        <div className="panelHeader">
          <h2>Editor</h2>
        </div>

        <div className="row" style={{ marginBottom: 12 }}>
          <button
            onClick={() => {
              setManualSelectionLock(true);
              setSelectedIndex((i) => Math.max(0, i - 1));
            }}
            disabled={!lyrics.length}
          >
            Prev
          </button>

          <button
            onClick={() => {
              setManualSelectionLock(true);
              setSelectedIndex((i) => Math.min(lyrics.length - 1, i + 1));
            }}
            disabled={!lyrics.length}
          >
            Next
          </button>

          <button onClick={syncSelectedToCurrentTime} disabled={!lyrics.length}>
            Set to current time
          </button>

          <button onClick={addLineAfterSelected}>Add line</button>
        </div>

        <div className="row" style={{ marginBottom: 12 }}>
          <button onClick={() => nudgeSelected(-0.1)} disabled={!lyrics.length}>
            -0.10s
          </button>
          <button onClick={() => nudgeSelected(-0.05)} disabled={!lyrics.length}>
            -0.05s
          </button>
          <button onClick={() => nudgeSelected(-0.01)} disabled={!lyrics.length}>
            -0.01s
          </button>

          <button onClick={() => nudgeSelected(0.01)} disabled={!lyrics.length}>
            +0.01s
          </button>
          <button onClick={() => nudgeSelected(0.05)} disabled={!lyrics.length}>
            +0.05s
          </button>
          <button onClick={() => nudgeSelected(0.1)} disabled={!lyrics.length}>
            +0.10s
          </button>
        </div>

        {selectedLine ? (
          <div className="selectedBox">
            <div className="meta">
              <strong>Selected:</strong> line {selectedIndex + 1} / {lyrics.length}
            </div>
            <div className="meta">
              <strong>t:</strong> {selectedLine.t.toFixed(3)}
            </div>
            <div className="meta">
              <strong>ts:</strong> {selectedLine.ts}
            </div>
            <textarea
              className="lineEditor"
              value={selectedLine.text}
              onChange={(e) => updateSelectedText(e.target.value)}
            />
          </div>
        ) : (
          <p>No lyrics loaded yet.</p>
        )}

        <div className="lyricsList">
          {lyrics.map((line, i) => (
            <button
              key={`${i}-${line.t}-${line.text}`}
              ref={(el) => {
                lyricRefs.current[i] = el;
              }}
              className={`lyricRow ${i === selectedIndex ? "active" : ""}`}
              onClick={() => {
                setManualSelectionLock(true);
                setSelectedIndex(i);
                seekAndPlay(line.t);
              }}
            >
              <span className="time">{line.t.toFixed(3)}s</span>
              <span className="text">{line.text || "(empty line)"}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="panelHeader">
          <h2>Export</h2>
          <div className="row">
            <label>
              SRT delay (s)
              <input
                type="number"
                step="0.01"
                value={srtDelay}
                onChange={(e) => setSrtDelay(e.target.value)}
                style={{ marginLeft: 8, width: 100 }}
              />
            </label>

            <button onClick={downloadJson} disabled={!lyrics.length}>
              Download JSON
            </button>

            <button onClick={exportToSrt} disabled={!lyrics.length}>
              Export SRT
            </button>
          </div>
        </div>

        <textarea
          className="jsonBox outputBox"
          value={parsedOutput}
          readOnly
          spellCheck={false}
        />
      </section>

      <footer className="footer">
        <p>
          Shortcuts: Space = play/pause, Enter = set selected line to current
          time, ↑/↓ = select line, hold [ or ] for ±0.01s, hold {"{"} or {"}"} for
          ±0.05s.
        </p>
      </footer>
    </div>
  );
}