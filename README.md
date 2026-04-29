# Producer Sketchbook

A browser-based creative companion for electronic music producers, focusing on the ideation phase of music production. Built with a human-in-the-loop philosophy where AI supports creative exploration without replacing the producer's agency.

## Live Demo

https://producer-sketchbook.onrender.com

## Running Locally

**Prerequisites:** Node.js installed

**1. Start the server:**

    cd server
    npm install
    node server.js

**2. Build and serve the frontend:**

    cd client
    npm install
    npm run build

Then visit http://localhost:3001

**Note:** You will need an Anthropic API key in `server/.env`:

    ANTHROPIC_API_KEY=your_key_here

## Tech Stack

- **Frontend:** React, Canvas API, Web Audio API
- **Backend:** Node.js, Express
- **AI:** Anthropic API (text, vision, extended thinking)
- **Audio Analysis:** Essentia.js (server-side), web-audio-beat-detector, pitchfinder
- **MIDI Parsing:** @tonejs/midi
- **Fonts:** Atkinson Hyperlegible, Dekko, Finger Paint (Google Fonts)

## Features

### Core
- **Guided Journal** — AI chat companion ("Scribbles") for music ideation with typing animation, conversation history, and auto-scroll
- **Audio Workspace** — drag-and-drop audio loading, waveform visualization with zoom in/out, playback with playhead, click-to-seek
- **Audio Analysis** — BPM, key + scale, sample rate, channels, bit depth, 8-band frequency spectrum
- **Visual Canvas** — image collage system with drag-to-reposition, scale, rotate, delete, and tape strip effect
- **AI Vision** — dropped images analyzed by Anthropic vision API, AI responds with sonic inspiration

### Advanced
- **Essentia.js Integration** — professional-grade audio analysis powered by the same library used by Freesound and AcousticBrainz (Music Technology Group, UPF Barcelona). Provides key detection, danceability, spectral centroid (brightness), dynamic complexity, and loudness
- **MIDI Parsing** — piano roll visualization with colored note blocks per track, velocity-based opacity, BPM from MIDI header, note and track counts
- **Extended Thinking** — AI reasoning process visible in real-time in the Interworkings transparency panel
- **Sketchbook Save/Load** — save sessions to localStorage, restore from a modal with open/delete buttons

### UI/UX
- **Sticky Note Prompts** — 18 curated creative prompts with ASCII art/Kaomoji, random on each refresh, draggable on the notebook surface
- **Collapse/Expand Workspaces** — minimize panels to title bar, close with restore button
- **Zoom In/Out Waveform** — +/- buttons, scroll left/right when zoomed, fit button to reset
- **Paper/Notebook Aesthetic** — sky background, notebook paper spread, crumpled paper textures, retro window chrome, tape strip effects

## Architecture

    producer-sketchbook/
      server/
        server.js              — Express app, serves API and React build
        routes/
          chat.js              — Anthropic API with extended thinking + vision
          analyze.js           — Essentia.js WASM audio analysis
      client/
        src/
          App.js               — Main layout, state management, component wiring
          components/
            Journal.jsx        — AI chat interface
            AudioWorkspace.jsx — Audio/MIDI loading, waveform, piano roll
            VisualCanvas.jsx   — Image collage system
            WindowPanel.jsx    — Reusable panel with minimize/close
            Interworkings.jsx  — Real-time AI transparency log
            SketchbookView.jsx — Save/load session modal
            StickyNote.jsx     — Creative prompt system with drag

## Design Philosophy

Producer Sketchbook sits upstream of the DAW. It's for the moment before you open Ableton or FL Studio, when you're figuring out what you want to make. The AI companion helps producers explore moods, analyze reference tracks, gather visual inspiration, and develop creative direction — without generating music or making creative decisions for them.

## Created by

Shyla Nuxol — University of Central Florida, 2026
