// AUDIOWORKSPACE.JSX — Audio & MIDI File Analysis

// Handles everything related to audio and MIDI file input, analysis, visualization, and playback
// For AUDIO files (.mp3, .wav, .ogg, .aiff):
// - Decodes audio using Web Audio API
// - Draws a zoomable waveform on Canvas API
// - Detects BPM (web-audio-beat-detector, overridden by Essentia)
// - Detects key (pitchfinder YIN algorithm, overridden by Essentia)
// - Computes frequency spectrum (8-band logarithmic FFT)
// - Sends audio to Essentia.js server for professional analysis
// - Playback with animated playhead and click-to-seek
// For MIDI files (.mid, .midi):
// - Parses MIDI with @tonejs/midi library
// - Draws a piano roll visualization with colored note blocks
// - Extracts BPM from MIDI header, note count, track count
// All metadata is sent up to App.js via onAudioAnalyzed, which then passes it to the Journal for AI feedback

import { useState, useRef, useEffect, useCallback } from 'react';

function AudioWorkspace({ onAudioAnalyzed }) {
// ---- STATE ----
  const [file, setFile] = useState(null); // The uploaded file object
  const [isDragging, setIsDragging] = useState(false); // True when a file is being dragged over
  const [audioBuffer, setAudioBuffer] = useState(null); // Decoded audio data (Web Audio API AudioBuffer)
  const [isPlaying, setIsPlaying] = useState(false); // Playback state
  const [playProgress, setPlayProgress] = useState(0); // 0-1 progress through the audio
  const [metadata, setMetadata] = useState(null); // Analysis results displayed in the UI
  const [error, setError] = useState(''); // Error message for invalid files
  const [isMidi, setIsMidi] = useState(false); // True if the loaded file is MIDI
  const [justDropped, setJustDropped] = useState(false); // Triggers the drop-in animation
  const [zoom, setZoom] = useState(1); // Waveform zoom level (1 = full view)
  const [scrollOffset, setScrollOffset] = useState(0); // 0-1 scroll position when zoomed
  const [midiData, setMidiData] = useState(null); // Parsed MIDI note data for piano roll

  // ---- REFS ----
  const fileInputRef = useRef(null); // Hidden file input for click-to-browse
  const canvasRef = useRef(null); // Canvas element for waveform
  const containerRef = useRef(null); // Container div for waveform (used for sizing)
  const audioContextRef = useRef(null); // Web Audio API context (persists across renders)
  const sourceRef = useRef(null); // Current audio source node (for stop/play)
  const startTimeRef = useRef(0); // When playback started (for progress calculation)
  const animationRef = useRef(null); // requestAnimationFrame ID (for cleanup)
  const midiCanvasRef = useRef(null); // Canvas element for MIDI piano roll
  const midiContainerRef = useRef(null); // Container div for MIDI piano roll

  // WAVEFORM DRAWING

  // Draws the audio waveform on a canvas element.
  // Supports zoom and scroll: when zoomed in, only a portion of the audio is visible and the user can scroll left/right
  // The waveform has two colors:
  // - Darker blue for the played portion (left of playhead)
  // - Lighter blue for the unplayed portion (right of playhead)
  // - Pink playhead line with a dot at the top
  // Uses devicePixelRatio for retina-sharp rendering
  // useCallback prevents unnecessary re-creation on each render
  const drawWaveform = useCallback((buffer, progress = 0, zoomLevel = 1, offset = 0) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = containerRef.current;
    if (!container) return;

    // ---- RETINA SETUP ----
    // Canvas dimensions are set to 2x (or 3x) the CSS dimensions then scaled down, resulting in sharp rendering on high-DPI screens
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = height * 0.15; // Top/bottom padding for the waveform
    const drawHeight = height - padding * 2;

    // Get raw audio samples from the first channel
    const data = buffer.getChannelData(0);
    const totalSamples = data.length;

    // ---- ZOOM CALCULATIONS ----
    // Calculate which portion of the audio is visible based on zoom level
    // At zoom=1, all samples are visible. At zoom=2, half are visible, etc.
    const visibleSamples = Math.floor(totalSamples / zoomLevel);
    // scrollOffset (0-1) determines where in the audio we're looking
    const startSample = Math.floor(offset * (totalSamples - visibleSamples));
    const endSample = Math.min(startSample + visibleSamples, totalSamples);
    // How many samples per pixel (for downsampling)
    const step = Math.max(1, Math.ceil((endSample - startSample) / width));

    ctx.clearRect(0, 0, width, height);

    // ---- NORMALIZE ----
    // Find the peak amplitude in the visible range so the waveform fills the available height
    let peak = 0;
    for (let i = startSample; i < endSample; i++) {
      const abs = Math.abs(data[i]);
      if (abs > peak) peak = abs;
    }
    if (peak === 0) peak = 1; // Avoid division by zero for silent audio

    // ---- CENTER LINE ----
    // Faint horizontal line at the center (zero crossing)
    ctx.strokeStyle = 'rgba(100, 140, 180, 0.15)';
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.stroke();

    // ---- PLAYHEAD POSITION ----
    // Convert the overall progress (0-1) to a pixel position within the currently visible range
    const playbackSample = progress * totalSamples;
    const playX = ((playbackSample - startSample) / (endSample - startSample)) * width;

    // ---- PLAYED PORTION (darker blue) ----
    // Draw vertical lines from min to max amplitude for each pixel
    // Only for pixels to the left of the playhead
    ctx.beginPath();
    ctx.strokeStyle = '#4a7fb5';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < width; i++) {
      const sampleIndex = startSample + Math.floor(i * (endSample - startSample) / width);
      if (sampleIndex >= totalSamples) break;

      // Find min/max values in this pixel's sample range
      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const idx = sampleIndex + j;
        if (idx >= totalSamples) break;
        const value = data[idx];
        if (value < min) min = value;
        if (value > max) max = value;
      }

      // Convert amplitude values to Y coordinates
      const yMin = padding + ((1 + min / peak) / 2) * drawHeight;
      const yMax = padding + ((1 + max / peak) / 2) * drawHeight;

      if (i <= playX) {
        ctx.moveTo(i, yMin);
        ctx.lineTo(i, yMax);
      }
    }
    ctx.stroke();

    // ---- UNPLAYED PORTION (lighter blue) ----
    // Same drawing logic but with a lighter, more transparent color
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(144, 189, 228, 0.6)';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < width; i++) {
      const sampleIndex = startSample + Math.floor(i * (endSample - startSample) / width);
      if (sampleIndex >= totalSamples) break;

      let min = 1.0;
      let max = -1.0;
      for (let j = 0; j < step; j++) {
        const idx = sampleIndex + j;
        if (idx >= totalSamples) break;
        const value = data[idx];
        if (value < min) min = value;
        if (value > max) max = value;
      }

      const yMin = padding + ((1 + min / peak) / 2) * drawHeight;
      const yMax = padding + ((1 + max / peak) / 2) * drawHeight;

      if (i > playX) {
        ctx.moveTo(i, yMin);
        ctx.lineTo(i, yMax);
      }
    }
    ctx.stroke();

    // ---- PLAYHEAD ----
    // Vertical pink line with a dot at the top
    // Only drawn when visible within the current zoom range
    if (playX >= 0 && playX <= width) {
      ctx.strokeStyle = '#d4a0c8';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playX, padding - 4);
      ctx.lineTo(playX, height - padding + 4);
      ctx.stroke();

      // Dot at the top of the playhead
      ctx.fillStyle = '#d4a0c8';
      ctx.beginPath();
      ctx.arc(playX, padding - 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // ---- ZOOM INDICATOR ----
    // Small text in the bottom left showing the current zoom level
    // Only shown when zoomed in (zoom > 1)
    if (zoomLevel > 1) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = '#4a7fb5';
      ctx.font = "10px 'Atkinson Hyperlegible', sans-serif";
      ctx.fillText(`${zoomLevel.toFixed(1)}x`, 6, height - 6);
      ctx.restore();
    }
  }, []);

  // MIDI PIANO ROLL DRAWING

  // Draws a piano roll visualization for MIDI files.
  // Each note is a colored rectangle positioned by:
  // - X axis: time (left to right)
  // - Y axis: pitch (low notes at bottom, high notes at top)
  // - Width: note duration
  // - Color: different color per track
  // - Opacity: velocity (louder notes are more opaque)
  // Black key rows get a subtle grey background.
  // Octave labels (C2, C3, C4, etc.) appear on the left.
  function drawPianoRoll(container, canvas, notes, duration) {
    if (!canvas || !container || !notes || notes.length === 0) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;
    const padding = 10;

    ctx.clearRect(0, 0, width, height);

    // ---- FIND NOTE RANGE ----
    // Determine the lowest and highest notes to set the Y axis range
    // Add 2-note padding on each side so notes aren't right at the edges
    let minNote = 127;
    let maxNote = 0;
    notes.forEach(n => {
      if (n.midi < minNote) minNote = n.midi;
      if (n.midi > maxNote) maxNote = n.midi;
    });

    minNote = Math.max(0, minNote - 2);
    maxNote = Math.min(127, maxNote + 2);
    const noteRange = maxNote - minNote || 1;

    // ---- BLACK KEY BACKGROUNDS ----
    // Subtle shading for rows corresponding to black keys
    // Makes it easier to read the piano roll
    for (let n = minNote; n <= maxNote; n++) {
      const isBlackKey = [1, 3, 6, 8, 10].includes(n % 12);
      if (isBlackKey) {
        const y = padding + ((maxNote - n) / noteRange) * (height - padding * 2);
        const noteH = (height - padding * 2) / noteRange;
        ctx.fillStyle = 'rgba(0, 0, 0, 0.03)';
        ctx.fillRect(0, y - noteH / 2, width, noteH);
      }
    }

    // ---- TRACK COLORS ----
    // Each MIDI track gets a unique color from this palette
    // Supports up to 8 tracks before colors repeat
    const trackColors = [
      '#4a7fb5', '#d4a0c8', '#5DCAA5', '#EF9F27',
      '#AFA9EC', '#e57373', '#81c784', '#ffb74d',
    ];

    // ---- DRAW NOTES ----
    // Each note is a filled rectangle with a subtle border
    notes.forEach(note => {
      // X position: proportional to time within the MIDI duration  
      const x = padding + (note.time / duration) * (width - padding * 2);
      // Width: proportional to note duration (minimum 2px so short notes are visible)
      const noteWidth = Math.max(2, (note.duration / duration) * (width - padding * 2));
      // Y position: higher pitch = higher on the canvas
      const y = padding + ((maxNote - note.midi) / noteRange) * (height - padding * 2);
      // Height: divided evenly among the note range (minimum 2px)
      const noteHeight = Math.max(2, (height - padding * 2) / noteRange * 0.8);

      // Color based on track, opacity based on velocity
      const color = trackColors[note.track % trackColors.length];
      const alpha = 0.3 + note.velocity * 0.7; // Velocity 0 = 30% opacity, velocity 1 = 100%

      // Fill the note rectangle
      ctx.fillStyle = color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(x, y - noteHeight / 2, noteWidth, noteHeight);

      // Draw a subtle border for definition
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha + 0.1;
      ctx.lineWidth = 0.5;
      ctx.strokeRect(x, y - noteHeight / 2, noteWidth, noteHeight);
    });

    ctx.globalAlpha = 1;

    // ---- OCTAVE LABELS ----
    // Show C note labels on the left side (C2, C3, C4, etc.)
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    ctx.fillStyle = '#999';
    ctx.font = "9px 'Atkinson Hyperlegible', sans-serif";
    for (let n = minNote; n <= maxNote; n += 12) {
      const y = padding + ((maxNote - n) / noteRange) * (height - padding * 2);
      const octave = Math.floor(n / 12) - 1;
      ctx.globalAlpha = 0.4;
      ctx.fillText(`C${octave}`, 2, y + 3);
    }
    ctx.globalAlpha = 1;
  }

  // REDRAW EFFECTS

  // These useEffects trigger redraws when relevant state changes
  // The waveform redraws on: buffer change, playback progress, zoom level change, scroll offset change, and window resize
  // The piano roll redraws on: MIDI data change and window resize

  // Redraw waveform when any relevant state changes
  useEffect(() => {
    if (audioBuffer && canvasRef.current) {
      drawWaveform(audioBuffer, playProgress, zoom, scrollOffset);
    }
  }, [audioBuffer, playProgress, drawWaveform, zoom, scrollOffset]);

  // Redraw waveform on window resize
  useEffect(() => {
    function handleResize() {
      if (audioBuffer && canvasRef.current) {
        drawWaveform(audioBuffer, playProgress, zoom, scrollOffset);
      }
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [audioBuffer, playProgress, drawWaveform, zoom, scrollOffset]);

  // Redraw piano roll when MIDI data changes
  useEffect(() => {
    if (midiData && midiContainerRef.current && midiCanvasRef.current) {
      drawPianoRoll(midiContainerRef.current, midiCanvasRef.current, midiData.notes, midiData.duration);
    }
  }, [midiData]);

  // Redraw piano roll on window resize
  useEffect(() => {
    function handleResize() {
      if (midiData && midiContainerRef.current && midiCanvasRef.current) {
        drawPianoRoll(midiContainerRef.current, midiCanvasRef.current, midiData.notes, midiData.duration);
      }
    }

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [midiData]);

  // DRAG AND DROP HANDLERS

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && isValidFile(droppedFile)) {
      setJustDropped(true);
      setTimeout(() => setJustDropped(false), 600);
      loadAudioFile(droppedFile);
    }
  }

  function handleDragOver(e) {
    e.preventDefault(); // Required to allow drop
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  // Click-to-browse: triggered by clicking the drop zone
  function handleFileSelect(e) {
    const selectedFile = e.target.files[0];
    if (selectedFile && isValidFile(selectedFile)) {
      setJustDropped(true);
      setTimeout(() => setJustDropped(false), 600);
      loadAudioFile(selectedFile);
    }
  }

  // FILE VALIDATION

  // Checks file extension and size before loading
  // Sets an error message if validation fails
  function isValidFile(f) {
    const validExtensions = ['.mp3', '.wav', '.ogg', '.mid', '.midi', '.aiff', '.aif'];
    const extension = '.' + f.name.split('.').pop().toLowerCase();

    if (!validExtensions.includes(extension)) {
      setError('unsupported file type. try .mp3, .wav, .ogg, .aiff, or .mid');
      return false;
    }

    // 20MB limit to prevent browser memory issues
    if (f.size > 20 * 1024 * 1024) {
      setError('file is too large. please use files under 20MB');
      return false;
    }

    setError('');
    return true;
  }

  // LOAD AND ANALYZE AUDIO/MIDI FILE

  // Main function that handles file loading.
  // It branches based on file type:
  // MIDI path: Parse with @tonejs/midi → extract notes → draw piano roll
  // Audio path: Decode with Web Audio API → analyze → draw waveform
  // Then send to Essentia.js server for advanced analysis
  // Analysis pipeline:
  // 1. Browser-side BPM detection (web-audio-beat-detector)
  // 2. Browser-side key detection (pitchfinder YIN)
  // 3. Browser-side frequency spectrum (Web Audio FFT)
  // 4. Server-side Essentia.js analysis (key, BPM, danceability, etc.)
  // Essentia results override browser-side results when available

  async function loadAudioFile(f) {
    setFile(f);
    setError('');
    setJustDropped(true);
    setTimeout(() => setJustDropped(false), 800);

    const ext = f.name.split('.').pop().toLowerCase();

    // ---- MIDI PATH ----
    if (ext === 'mid' || ext === 'midi') {
      setIsMidi(true);

      try {
        // Dynamic import for code splitting — @tonejs/midi is only loaded when a MIDI file is actually dropped
        const { Midi } = await import('@tonejs/midi');
        const midiArrayBuffer = await f.arrayBuffer();
        const midi = new Midi(midiArrayBuffer);

        // Flatten all notes from all tracks into a single array
        // Each note includes its track index for color coding
        const allNotes = [];
        midi.tracks.forEach((track, trackIndex) => {
          track.notes.forEach(note => {
            allNotes.push({
              name: note.name,
              midi: note.midi, // MIDI note number (0-127)
              time: note.time,
              duration: note.duration,
              velocity: note.velocity, // 0-1 (how hard the key was pressed)
              track: trackIndex, // Which track this note belongs to
            });
          });
        });

        // Build metadata object for display and AI
        const meta = {
          duration: midi.duration,
          sampleRate: null, // Not applicable for MIDI
          channels: midi.tracks.length,
          bpm: midi.header.tempos.length > 0 ? Math.round(midi.header.tempos[0].bpm) : null,
          key: null,
          bitDepth: null,
          spectrum: null,
          isMidi: true,
          noteCount: allNotes.length,
          trackCount: midi.tracks.length,
        };

        // Store parsed data for piano roll rendering
        setMidiData({
          notes: allNotes,
          duration: midi.duration,
          trackCount: midi.tracks.length,
          trackNames: midi.tracks.map(t => t.name).filter(n => n),
        });
        setMetadata(meta);

        // Send to App.js → Journal for AI feedback
        if (onAudioAnalyzed) {
          onAudioAnalyzed(meta, f.name);
        }
      } catch (err) {
        console.error('Could not parse MIDI:', err);
        setError('could not read this MIDI file.');
      }
      return;
    }

    // ---- AUDIO PATH ----
    setIsMidi(false);
    setMidiData(null);

    // Create Web Audio context if it doesn't exist
    // Reused across file loads to avoid creating too many contexts
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    }

    const arrayBuffer = await f.arrayBuffer();
    try {
      // Decode the audio file into an AudioBuffer
      // Converts compressed formats (MP3, OGG) into raw PCM samples  
      const decoded = await audioContextRef.current.decodeAudioData(arrayBuffer);
      setAudioBuffer(decoded);
      setPlayProgress(0);
      setZoom(1); // Reset zoom for new files
      setScrollOffset(0); // Reset scroll for new files

      // Build initial metadata object
      const meta = {
        duration: decoded.duration,
        sampleRate: decoded.sampleRate,
        channels: decoded.numberOfChannels,
        bpm: null,
        key: null,
        bitDepth: null,
        spectrum: null,
      };

      // ---- BIT DEPTH ESTIMATION ----
      // WAV and AIFF store uncompressed audio, so can estimate bit depth from the file size vs sample count
      if (ext === 'wav' || ext === 'aiff' || ext === 'aif') {
        meta.bitDepth = f.size / (decoded.length * decoded.numberOfChannels) > 3 ? 24 : 16;
      } else if (ext === 'mp3' || ext === 'ogg') {
        meta.bitDepth = 'compressed';
      }

      // ---- BROWSER-SIDE BPM DETECTION (FALLBACK) ----
      // Uses autocorrelation to estimate tempo
      // May be overridden by Essentia's more accurate detection
      try {
        const { guess } = await import('web-audio-beat-detector');
        const tempo = await guess(decoded);
        meta.bpm = Math.round(tempo.bpm);
      } catch (bpmErr) {
        console.log('Could not detect BPM:', bpmErr);
      }

      // ---- BROWSER-SIDE KEY DETECTION (FALLBACK) ----
      // Uses the YIN pitch detection algorithm on multiple sections of the audio and averages the results
      try {
        const Pitchfinder = await import('pitchfinder');
        const detectPitch = Pitchfinder.YIN({ sampleRate: decoded.sampleRate });
        const pitchData = decoded.getChannelData(0);

        const sectionSize = 4096;
        const pitches = [];
        const numSections = Math.min(20, Math.floor(pitchData.length / sectionSize));

        // Sample 20 evenly-spaced sections of the audio
        for (let s = 0; s < numSections; s++) {
          const start = Math.floor((s / numSections) * (pitchData.length - sectionSize));
          const section = pitchData.slice(start, start + sectionSize);
          const pitch = detectPitch(section);
          // Filter out unreasonable frequencies
          if (pitch && pitch > 20 && pitch < 4000) {
            pitches.push(pitch);
          }
        }

        if (pitches.length > 0) {
          const avg = pitches.reduce((a, b) => a + b, 0) / pitches.length;
          meta.key = frequencyToNote(avg);
        }
      } catch (keyErr) {
        console.log('Could not detect key:', keyErr);
      }

      // ---- BROWSER-SIDE FREQUENCY SPECTRUM ----
      // Uses an OfflineAudioContext to render audio through an AnalyserNode and extract frequency data without playing the audio aloud
      // The spectrum is divided into 8 logarithmic bands matching how humans perceive frequency (sub, bass, low-mid, etc.)
      const renderLength = Math.min(decoded.length, decoded.sampleRate * 5);
      const fftSize = 4096;

      // Create an offline context to process audio silently
      const shortCtx = new OfflineAudioContext(1, renderLength, decoded.sampleRate);
      const shortSource = shortCtx.createBufferSource();
      const shortAnalyser = shortCtx.createAnalyser();
      shortAnalyser.fftSize = fftSize;

      // Copy first 5 seconds of audio into the offline buffer
      const shortBuffer = shortCtx.createBuffer(1, renderLength, decoded.sampleRate);
      const shortData = shortBuffer.getChannelData(0);
      const sourceData = decoded.getChannelData(0);
      for (let i = 0; i < renderLength; i++) {
        shortData[i] = sourceData[i];
      }

      // Connect: source → analyser → destination
      shortSource.buffer = shortBuffer;
      shortSource.connect(shortAnalyser);
      shortAnalyser.connect(shortCtx.destination);
      shortSource.start();

      // Render the audio and extract frequency data
      await shortCtx.startRendering();

      const freqData = new Uint8Array(shortAnalyser.frequencyBinCount);
      shortAnalyser.getByteFrequencyData(freqData);

      // Define frequency bands matching human perception
      const bandRanges = [
        { label: 'sub', min: 20, max: 60 }, // Sub bass
        { label: 'bass', min: 60, max: 250 }, // Bass
        { label: 'low-mid', min: 250, max: 500 }, // Low midrange
        { label: 'mid', min: 500, max: 2000 }, // Midrange
        { label: 'hi-mid', min: 2000, max: 4000 }, // Upper midrange
        { label: 'presence', min: 4000, max: 6000 }, // Presence
        { label: 'brilliance', min: 6000, max: 12000 }, // Brilliance
        { label: 'air', min: 12000, max: 20000 }, // Air
      ];

      // Calculate average energy in each band
      const hzPerBin = decoded.sampleRate / fftSize;
      const simplifiedSpectrum = bandRanges.map(band => {
        const startBin = Math.floor(band.min / hzPerBin);
        const endBin = Math.min(Math.floor(band.max / hzPerBin), freqData.length - 1);

        let sum = 0;
        let count = 0;
        for (let i = startBin; i <= endBin; i++) {
          sum += freqData[i];
          count++;
        }

        return {
          label: band.label,
          value: count > 0 ? sum / count / 255 : 0, // Normalize to 0-1
        };
      });

      meta.spectrum = simplifiedSpectrum;

      // ---- ESSENTIA.JS ADVANCED ANALYSIS ----
      // Send the audio to the server for professional-grade analysis
      // Provides: accurate key+scale, BPM, danceability, spectral centroid (brightness), dynamic complexity, loudness
      // Only sends the first 10 seconds to keep the request size manageable
      // Results override browser-side analysis when available
      try {
        const maxSamples = Math.min(decoded.length, decoded.sampleRate * 10);
        // Convert Float32Array to regular array for JSON serialization
        const audioData = Array.from(decoded.getChannelData(0).slice(0, maxSamples));

        const analyzeResponse = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            audioData: audioData,
            sampleRate: decoded.sampleRate,
          })
        });

        if (analyzeResponse.ok) {
          const essentiaData = await analyzeResponse.json();

          // Override browser-side results with Essentia's more accurate results
          if (essentiaData.bpm && essentiaData.bpm > 0) meta.bpm = essentiaData.bpm;
          if (essentiaData.key) meta.key = `${essentiaData.key} ${essentiaData.scale || ''}`.trim();
          if (essentiaData.keyStrength) meta.keyStrength = essentiaData.keyStrength;

          // Add new Essentia features
          meta.danceability = essentiaData.danceability;
          meta.energy = essentiaData.energy;
          meta.loudness = essentiaData.loudness;
          meta.dynamicComplexity = essentiaData.dynamicComplexity;
          meta.spectralCentroid = essentiaData.spectralCentroid;
          meta.spectralRolloff = essentiaData.spectralRolloff;
          meta.spectralFlatness = essentiaData.spectralFlatness;
          meta.interpretation = essentiaData.interpretation; // Human-readable labels
        }
      } catch (essentiaErr) {
        // If Essentia is unavailable, browser-side analysis still works
        console.log('Essentia analysis unavailable:', essentiaErr);
      }

      // Send all metadata to App.js → Journal
      if (onAudioAnalyzed) {
        onAudioAnalyzed(meta, f.name);
      }

      setMetadata(meta);

    } catch (err) {
      console.error('Could not decode audio:', err);
      setError('could not read this file. it may be corrupted or unsupported.');
    }
  }

  // HELPER: Convert frequency (Hz) to musical note name

  // Uses formula: noteNum = 12 * log2(freq/440) + 69 where 69 = A4 (440 Hz) in MIDI note numbers
  function frequencyToNote(freq) {
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const noteNum = 12 * (Math.log2(freq / 440)) + 69;
    const note = Math.round(noteNum) % 12;
    const octave = Math.floor(Math.round(noteNum) / 12) - 1;
    return noteNames[note] + octave;
  }

  // PLAYBACK

  // Animate the playhead during playback
  // Uses requestAnimationFrame for smooth 60fps updates
  function startPlayheadAnimation(duration, offset = 0) {
    const startTime = audioContextRef.current.currentTime - offset;
    startTimeRef.current = startTime;

    function animate() {
      const elapsed = audioContextRef.current.currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      setPlayProgress(progress);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
      }
    }

    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    animationRef.current = requestAnimationFrame(animate);
  }

  // Toggle play/pause
  function togglePlayback() {
    if (!audioBuffer || !audioContextRef.current) return;

    if (isPlaying) {
      // ---- PAUSE ----  
      if (sourceRef.current) {
        sourceRef.current.stop();
        sourceRef.current = null;
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      setIsPlaying(false);
    } else {
      // ---- PLAY ----
      // Create a new source node each time (Web Audio API requirement — source nodes can only be started once)  
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => {
        setIsPlaying(false);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };

      // Resume from current position
      const offset = playProgress * audioBuffer.duration;
      source.start(0, offset);
      sourceRef.current = source;
      setIsPlaying(true);
      startPlayheadAnimation(audioBuffer.duration, offset);
    }
  }

  // CLICK TO SEEK (ZOOM-AWARE)

  // When the user clicks on the waveform, seek to that position
  // Must account for the current zoom level and scroll offset to convert the click pixel position to the correct audio time

  function handleCanvasClick(e) {
    if (!audioBuffer || !audioContextRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickRatio = clickX / rect.width; // 0-1 within visible area

    // Convert click position to actual sample position
    // accounting for zoom and scroll
    const totalSamples = audioBuffer.getChannelData(0).length;
    const visibleSamples = Math.floor(totalSamples / zoom);
    const startSample = Math.floor(scrollOffset * (totalSamples - visibleSamples));
    const clickedSample = startSample + clickRatio * visibleSamples;
    const progress = clickedSample / totalSamples;

    // Stop current playback
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    setPlayProgress(progress);

    // If playing, restart from the new position
    if (isPlaying) {
      const source = audioContextRef.current.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => {
        setIsPlaying(false);
        if (animationRef.current) {
          cancelAnimationFrame(animationRef.current);
        }
      };

      source.start(0, progress * audioBuffer.duration);
      sourceRef.current = source;
      startPlayheadAnimation(audioBuffer.duration, progress * audioBuffer.duration);
    }
  }

  // REMOVE FILE

  // Resets all state back to the initial empty state
  function handleRemove() {
    if (sourceRef.current) {
      sourceRef.current.stop();
      sourceRef.current = null;
    }
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }
    setFile(null);
    setAudioBuffer(null);
    setIsPlaying(false);
    setPlayProgress(0);
    setMetadata(null);
    setError('');
    setIsMidi(false);
    setJustDropped(false);
    setZoom(1);
    setScrollOffset(0);
    setMidiData(null);
  }

  // ---- FORMAT HELPERS ----

  function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function currentTime() {
    if (!audioBuffer) return '0:00';
    return formatDuration(playProgress * audioBuffer.duration);
  }

  // RENDER

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      fontFamily: "'Atkinson Hyperlegible', sans-serif",
    }}>
      {!file ? (
        // ---- DROP ZONE (empty state) ----
        // Shown when no file is loaded. Supports drag-and-drop and click-to-browse
        // Visual feedback: border turns blue when dragging, red when error
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => { setError(''); fileInputRef.current.click(); }}
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            border: isDragging ? '2px dashed #5B9BD5' : error ? '2px dashed #e57373' : '2px dashed rgba(0,0,0,0.15)',
            borderRadius: '4px',
            cursor: 'pointer',
            background: isDragging ? 'rgba(91,155,213,0.08)' : error ? 'rgba(229,115,115,0.05)' : 'transparent',
            transition: 'all 0.2s ease',
          }}
        >
          {error ? (
            <p style={{ fontSize: '12px', color: '#c62828', textAlign: 'center', padding: '0 10px' }}>
              {error}
            </p>
          ) : (
            <>
              <p style={{ fontSize: '14px', color: isDragging ? '#5B9BD5' : '#888', marginBottom: '4px', transition: 'color 0.2s ease' }}>
                {isDragging ? 'drop it here' : 'drop audio or MIDI here'}
              </p>
              <p style={{ fontSize: '11px', color: '#aaa' }}>
                or click to browse
              </p>
            </>
          )}
          {/* Hidden file input — triggered programmatically by clicking the drop zone */}
          <input
            ref={fileInputRef}
            type="file"
            accept=".mp3,.wav,.ogg,.mid,.midi,.aiff,.aif"
            onChange={handleFileSelect}
            style={{ display: 'none' }}
          />
        </div>
      ) : (
        // ---- FILE LOADED VIEW ----
        // Shows the waveform/piano roll, metadata, and playback controls
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: justDropped ? 'dropIn 0.5s ease-out' : 'none',
        }}>
          {/* File name display */}  
          <p style={{
            fontSize: '12px',
            color: '#555',
            marginBottom: '6px',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {file.name}
          </p>

          {/* ---- VISUALIZATION AREA ---- */}
          {/* Shows either the waveform canvas or MIDI piano roll */}
          <div
            ref={isMidi ? midiContainerRef : containerRef}
            onClick={!isMidi ? handleCanvasClick : undefined}
            style={{
              flex: 1,
              minHeight: '60px',
              maxHeight: '200px',
              position: 'relative',
              cursor: !isMidi && audioBuffer ? 'pointer' : 'default',
              overflow: 'hidden',
            }}
          >
            {isMidi ? (
               // MIDI piano roll  
              <div style={{
                width: '100%',
                height: '100%',
                position: 'relative',
              }}>
                {midiData && midiData.notes.length > 0 ? (
                  <canvas
                    ref={midiCanvasRef}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: '100%',
                      borderRadius: '4px',
                    }}
                  />
                ) : (
                  <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    gap: '4px',
                  }}>
                    <p style={{ fontSize: '13px', color: '#555' }}>MIDI file loaded</p>
                    <p style={{ fontSize: '11px', color: '#aaa' }}>no notes found in this file</p>
                  </div>
                )}
              </div>
            ) : audioBuffer ? (
              // Audio waveform
              <canvas
                ref={canvasRef}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  borderRadius: '4px',
                }}
              />
            ) : (
              <p style={{ fontSize: '12px', color: '#aaa' }}>loading waveform...</p>
            )}
          </div>

          {/* ---- METADATA DISPLAY ---- */}
          {/* Shows analysis results: BPM, key, spectrum, Essentia data */}
          {/* Works for both audio and MIDI files */}
          {metadata && (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              marginTop: '6px',
              padding: '6px 8px',
              background: 'rgba(175, 204, 229, 0.2)',
              borderRadius: '4px',
            }}>
              {/* Text metadata — wraps to multiple lines if needed */}
              <div style={{
                display: 'flex',
                gap: '12px',
                flexWrap: 'wrap',
              }}>
                {metadata.bpm && (
                  <span style={{ fontSize: '11px', color: '#555' }}>
                    <strong>{metadata.bpm}</strong> BPM
                  </span>
                )}
                {metadata.key && (
                  <span style={{ fontSize: '11px', color: '#555' }}>
                    key: <strong>{metadata.key}</strong>
                  </span>
                )}
                {/* MIDI-specific metadata */}
                {metadata.isMidi && metadata.noteCount && (
                  <span style={{ fontSize: '11px', color: '#555' }}>
                    <strong>{metadata.noteCount}</strong> notes
                  </span>
                )}
                {metadata.isMidi && metadata.trackCount && (
                  <span style={{ fontSize: '11px', color: '#555' }}>
                    <strong>{metadata.trackCount}</strong> tracks
                  </span>
                )}
                {metadata.duration && (
                  <span style={{ fontSize: '11px', color: '#555' }}>
                    <strong>{formatDuration(metadata.duration)}</strong> duration
                  </span>
                )}
                {/* Audio-specific metadata */}
                {!metadata.isMidi && (
                  <>
                    <span style={{ fontSize: '11px', color: '#555' }}>
                      <strong>{metadata.sampleRate}</strong> Hz
                    </span>
                    <span style={{ fontSize: '11px', color: '#555' }}>
                      {metadata.channels === 1 ? 'mono' : 'stereo'}
                    </span>
                    {metadata.bitDepth && (
                      <span style={{ fontSize: '11px', color: '#555' }}>
                        {metadata.bitDepth === 'compressed' ? 'compressed' : <><strong>{metadata.bitDepth}</strong>-bit</>}
                      </span>
                    )}
                    {/* Essentia.js interpretation labels */}
                    {metadata.danceability !== undefined && (
                      <span style={{ fontSize: '11px', color: '#555' }}>
                        groove: <strong>{metadata.danceability}</strong>
                      </span>
                    )}
                    {metadata.interpretation?.brightness && (
                      <span style={{ fontSize: '11px', color: '#555' }}>
                        <strong>{metadata.interpretation.brightness}</strong>
                      </span>
                    )}
                    {metadata.interpretation?.tonality && (
                      <span style={{ fontSize: '11px', color: '#555' }}>
                        <strong>{metadata.interpretation.tonality}</strong>
                      </span>
                    )}
                    {metadata.interpretation?.dynamics && (
                      <span style={{ fontSize: '11px', color: '#555' }}>
                        <strong>{metadata.interpretation.dynamics}</strong>
                      </span>
                    )}
                  </>
                )}
              </div>

              {/* ---- FREQUENCY SPECTRUM BARS ---- */}
              {/* Visual bars showing energy in each frequency band */}
              {/* Only shown for audio files (not MIDI) */}
              {!metadata.isMidi && metadata.spectrum && (
                <div style={{
                  display: 'flex',
                  alignItems: 'flex-end',
                  gap: '3px',
                  height: '30px',
                }}>
                  {metadata.spectrum.map((band, i) => (
                    <div key={i} style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      flex: 1,
                    }}>
                      {/* Bar height proportional to energy, minimum 2px */}
                      <div style={{
                        width: '100%',
                        height: `${Math.max(band.value * 28, 2)}px`,
                        background: `rgba(91, 155, 213, ${0.3 + band.value * 0.7})`,
                        borderRadius: '2px 2px 0 0',
                      }} />
                      {/* Band label below the bar */}
                      <span style={{
                        fontSize: '7px',
                        color: '#999',
                        marginTop: '2px',
                      }}>
                        {band.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ---- CONTROLS BAR ---- */}
          {/* Play/pause, time display, zoom controls, and remove button */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '8px',
          }}>
            {/* Left side: play/pause and time */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {!isMidi && (
                <button
                  onClick={togglePlayback}
                  style={{
                    fontSize: '12px',
                    padding: '4px 14px',
                    borderRadius: '20px',
                    border: 'none',
                    background: isPlaying ? '#ffc9f6' : '#afcce5',
                    color: '#071f37',
                    cursor: 'pointer',
                    fontFamily: "'Atkinson Hyperlegible', sans-serif",
                    fontWeight: 500,
                  }}
                >
                  {isPlaying ? 'pause' : 'play'}
                </button>
              )}

              {!isMidi && audioBuffer && (
                <span style={{ fontSize: '11px', color: '#888' }}>
                  {currentTime()} / {formatDuration(audioBuffer.duration)}
                </span>
              )}
            </div>

            {/* Center: zoom controls (only for audio, not MIDI) */}
            {!isMidi && audioBuffer && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {/* Zoom out */}
                <button
                  onClick={() => {
                    setZoom(z => {
                      const newZoom = Math.max(1, z / 1.5);
                      if (newZoom <= 1) setScrollOffset(0);
                      return newZoom;
                    });
                  }}
                  style={zoomBtnStyle}
                >
                  -
                </button>
                 {/* Zoom in */}
                <button
                  onClick={() => setZoom(z => Math.min(20, z * 1.5))}
                  style={zoomBtnStyle}
                >
                  +
                </button>
                {/* Scroll and fit buttons — only visible when zoomed in */}
                {zoom > 1 && (
                  <>
                    <button
                      onClick={() => setScrollOffset(o => Math.max(0, o - 0.1))}
                      style={zoomBtnStyle}
                    >
                      ←
                    </button>
                    <button
                      onClick={() => setScrollOffset(o => Math.min(1, o + 0.1))}
                      style={zoomBtnStyle}
                    >
                      →
                    </button>
                    {/* Reset zoom to full view */}
                    <button
                      onClick={() => { setZoom(1); setScrollOffset(0); }}
                      style={{
                        ...zoomBtnStyle,
                        width: 'auto',
                        padding: '0 8px',
                        fontSize: '10px',
                      }}
                    >
                      fit
                    </button>
                  </>
                )}
              </div>
            )}

            {/* Right side: remove button */}
            <button
              onClick={handleRemove}
              style={{
                fontSize: '11px',
                padding: '4px 14px',
                borderRadius: '20px',
                border: 'none',
                background: '#ffc9f6',
                color: '#000',
                cursor: 'pointer',
                fontFamily: "'Atkinson Hyperlegible', sans-serif",
              }}
            >
              remove
            </button>
          </div>
        </div>
      )}

      {/* ---- CSS ANIMATIONS ---- */}
      <style>{`
        @keyframes dropIn {
          0% { opacity: 0; transform: scale(0.9) translateY(10px); }
          60% { opacity: 1; transform: scale(1.02) translateY(-2px); }
          100% { opacity: 1; transform: scale(1) translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ---- SHARED STYLE ----
// Style object for the circular zoom control buttons
const zoomBtnStyle = {
  fontSize: '13px',
  width: '24px',
  height: '24px',
  borderRadius: '50%',
  border: 'none',
  background: '#afcce5',
  color: '#071f37',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: "'Atkinson Hyperlegible', sans-serif",
  fontWeight: 500,
  padding: 0,
};

export default AudioWorkspace;