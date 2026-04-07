# 🎵 Lyric Sync Tool

A lightweight browser-based tool for syncing lyrics or subtitles with audio.

Built with Vite, React, and WaveSurfer.js, designed for fast manual timing with keyboard shortcuts and precise nudging.

---

## ✨ Features

- 🎧 Load MP3/WAVE audio with waveform visualization
- 📝 Import lyrics from JSON or plain text
- ⚡ Real-time lyric syncing (press Enter to stamp)
- 🎯 Fine timing control (±0.01 / ±0.05 / ±0.10 seconds)
- 🔁 Auto-follow playback (optional manual lock)
- ➕ Add and edit lyric lines
- ➕ Import lines, skip empty lines
- 📄 Import from & Export to JSON (custom format)
- 🎬 Export to SRT (subtitle format)
  - delay/offset control
  - max subtitle duration (7s)
  - trimmed text
- ⌨️ Keyboard-driven workflow

---

## ⌨️ Shortcuts

- `Space` → Play / Pause  
- `Enter` → Set current line to playback time  
- `↑ / ↓` → Select previous / next line  
- `[` `]` → ±0.01s  
- `{` `}` → ±0.05s  

---

## 📥 Import Options

### JSON

Supports structured lyric format:

```json
{
  "lyrics": [
    { "t": 0.48, "ts": "T+00:00.48", "text": "Line text" }
  ]
}