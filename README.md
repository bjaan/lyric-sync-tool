# 🎵 Lyric Sync Tool

A lightweight browser-based tool for syncing lyrics or subtitles with audio.

Built with Vite, React, and WaveSurfer.js, designed for fast manual timing with keyboard shortcuts and precise nudging.

---

## ✨ Features

- 🎧 Load MP3/WAVE audio with waveform visualization
- 📝 Import lyrics from .SRT files, or plain text
- ⚡ Real-time lyric syncing (press Enter to stamp)
- 🎯 Fine timing control (±0.01 / ±0.05 / ±0.10 seconds)
- 🔁 Auto-follow playback (optional manual lock)
- ➕ Add and edit lyric lines
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

### SRT

A regular .SRT file like - Load using the ***Load SRT*** button, it immediately converts in the JSON format:
```
1
00:00:40,230 --> 00:00:44,929
Emergency lights,

2
00:00:44,929 --> 00:00:50,365
remain engaged

...
```

### JSON

Supports structured lyric format - used to exchange for loading and saving:

```json
{
  "lyrics": [
    { "t": 0.48, "ts": "T+00:00.48", "text": "Line text" }
  ]
}
```

### TXT/Text

Load from a .TXT file using the **Load TXT** button into or paste into the **Plain text import** panel, and use the Generate from text
```
line 1
line 2

line 3
```

## 🛠️ Installation

### 1. Clone the repository

```bash
git clone https://github.com/bjaan/lyric-sync-tool.git
cd lyric-sync-tool
```
### 2. Install dependencies
`npm install`
### 3. Start the development server
`npm run dev`
### 4. Open in browser

Vite will output a local URL, usually: http://localhost:5173/

Open it in your browser to use the app.

## 🏗️ Build for production
`npm run build`

Preview the production build:`
`npm run preview`

## 📦 Requirements
* Node.js (v18+ recommended)
* npm (comes with Node.js)