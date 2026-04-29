// ANALYZE.JS - Essentia.js Audio Analysis Route

// Provides professional-grade audio analysis using Essentia.js
// Runs server-side because Essentia uses WebAssembly (WASM) which is easier to configure in Node.js than in Create React App's webpack setup.
// Frontend sends raw audio samples (Float32Array as JSON) and route returns detailed analysis including:
// - Key and scale
// - BPM
// - Danceability
// - Spectral centroid (brightness)
// - Dynamic complexity
// - Energy and loudness
// - Human-readable interpretations of each metric
// Each algorithm is wrapped in its own try/catch so a failure in one doesn't break the others
// Fallback algorithms are provided for key and BPM detection.

const express = require('express');
const router = express.Router();

let essentia = null;
let essentiaReady = false;

// Initialize Essentia asynchronously on server startup
// This loads WASM module
async function initEssentia() {
  try {
    const { Essentia, EssentiaWASM } = require('essentia.js');
    essentia = new Essentia(EssentiaWASM);
    essentiaReady = true;
    console.log('Essentia.js initialized, version:', essentia.version);
    // Log available algorithms to help debug
    console.log('Available algorithms:', essentia.algorithmNames.length);
  } catch (err) {
    console.error('Could not initialize Essentia.js:', err);
  }
}

initEssentia();

router.post('/api/analyze', async (req, res) => {
// If Essentia hasn't loaded yet, tell the client to retry
  if (!essentiaReady) {
    return res.status(503).json({ error: 'Audio analyzer is still loading.' });
  }

  try {
    const { audioData, sampleRate } = req.body;

    if (!audioData || !sampleRate) {
      return res.status(400).json({ error: 'Missing audio data or sample rate' });
    }

    // Convert the JSON array back to a Float32Array
    // then to an Essentia vector (Essentia's internal format)
    const signal = new Float32Array(audioData);
    const audioVector = essentia.arrayToVector(signal);

    const results = {};

    // ---- KEY DETECTION ----
    // KeyExtractor identifies the musical key and scale (major/minor)
    // Uses Harmonic Pitch Class Profile (HPCP) analysis
    try {
      const keyData = essentia.KeyExtractor(audioVector);
      results.key = keyData.key;
      results.scale = keyData.scale;
      results.keyStrength = Math.round(keyData.strength * 100) / 100;
      console.log('Key detected:', results.key, results.scale);
    } catch (e) {
      console.log('KeyExtractor failed:', e.message);

      // Fallback: manually compute HPCP then run Key algorithm
      try {
        const frameSize = 4096;
        const hopSize = 2048;
        const frames = essentia.FrameGenerator(audioVector, frameSize, hopSize);

        let hpcpSum = null;
        let frameCount = 0;

        for (let i = 0; i < Math.min(frames.size(), 50); i++) {
          const frame = frames.get(i);
          const windowed = essentia.Windowing(frame);
          const spectrum = essentia.Spectrum(windowed.frame);
          const peaks = essentia.SpectralPeaks(spectrum.spectrum);
          const hpcp = essentia.HPCP(peaks.frequencies, peaks.magnitudes);

          if (!hpcpSum) {
            hpcpSum = new Array(hpcp.hpcp.length).fill(0);
          }
          for (let j = 0; j < hpcp.hpcp.length; j++) {
            hpcpSum[j] += hpcp.hpcp[j];
          }
          frameCount++;
        }

        if (hpcpSum && frameCount > 0) {
          const avgHpcp = hpcpSum.map(v => v / frameCount);
          const hpcpVector = essentia.arrayToVector(new Float32Array(avgHpcp));
          const keyResult = essentia.Key(hpcpVector);
          results.key = keyResult.key;
          results.scale = keyResult.scale;
          results.keyStrength = Math.round(keyResult.strength * 100) / 100;
          console.log('Key (fallback):', results.key, results.scale);
        }
      } catch (e2) {
        console.log('Key fallback also failed:', e2.message);
      }
    }

    // ---- BPM DETECTION ----
    // PercivalBpmEstimator uses autocorrelation-based tempo estimation
    try {
      const rhythm = essentia.PercivalBpmEstimator(audioVector);
      results.bpm = Math.round(rhythm.bpm);
      console.log('BPM detected:', results.bpm);
    } catch (e) {
      console.log('PercivalBpmEstimator failed:', e.message);
    
      // Fallback: RhythmExtractor2013 uses a different algorithm
      try {
        const rhythm = essentia.RhythmExtractor2013(audioVector);
        results.bpm = Math.round(rhythm.bpm);
        console.log('BPM (fallback):', results.bpm);
      } catch (e2) {
        console.log('RhythmExtractor2013 also failed:', e2.message);
      }
    }

    // ---- ENERGY ----
    // Overall signal energy - higher = louder/more active
    try {
      const energy = essentia.Energy(audioVector);
      results.energy = Math.round(energy.energy * 1000) / 1000;
      console.log('Energy:', results.energy);
    } catch (e) {
      console.log('Energy failed:', e.message);
    }

    // ---- RMS (Root Mean Square) ----
    // Average loudness level of the signal
    try {
      const rms = essentia.RMS(audioVector);
      results.rms = Math.round(rms.rms * 1000) / 1000;
      console.log('RMS:', results.rms);
    } catch (e) {
      console.log('RMS failed:', e.message);
    }

    // ---- SPECTRAL CENTROID ----
    // The "center of mass" of the frequency spectrum
    // Low values = dark/bassy, high values = bright/trebly
    // Computed per-frame and averaged for a stable reading
    try {
      const frameSize = 2048;
      const signal32 = new Float32Array(audioData);
      
      let centroidSum = 0;
      let frameCount = 0;
      const maxFrames = 50;
      const hopSize = Math.floor(signal32.length / maxFrames);

      for (let i = 0; i < maxFrames; i++) {
        const start = i * hopSize;
        if (start + frameSize > signal32.length) break;

        // Extract a frame of audio and compute its spectrum
        const frameSlice = signal32.slice(start, start + frameSize);
        const frameVector = essentia.arrayToVector(frameSlice);
        const spectrum = essentia.Spectrum(frameVector);

        try {
        // Centroid gives a 0-1 value, multiply by Nyquist frequency to get the actual frequency in Hz
          const centroid = essentia.Centroid(spectrum.spectrum);
          centroidSum += centroid.centroid * (sampleRate / 2);
          frameCount++;
        } catch (e) {}
      }

      if (frameCount > 0) {
        results.spectralCentroid = Math.round(centroidSum / frameCount);
        console.log('Spectral centroid:', results.spectralCentroid);
      }
    } catch (e) {
      console.log('Spectral analysis failed:', e.message);
    }

    // ---- DANCEABILITY ----
    // How suitable the audio is for dancing (rhythmic regularity)
    // Based on the Detrended Fluctuation Analysis algorithm
    try {
      const dance = essentia.Danceability(audioVector);
      results.danceability = Math.round(dance.danceability * 100) / 100;
      console.log('Danceability:', results.danceability);
    } catch (e) {
      console.log('Danceability failed:', e.message);
    }

    // ---- DYNAMIC COMPLEXITY ----
    // How much the volume varies over time
    // Low = compressed/flat, high = very dynamic
    // Also returns perceptual loudness in dB
    try {
      const dynamic = essentia.DynamicComplexity(audioVector);
      results.dynamicComplexity = Math.round(dynamic.dynamicComplexity * 100) / 100;
      results.loudness = Math.round(dynamic.loudness * 100) / 100;
      console.log('Dynamic complexity:', results.dynamicComplexity);
      console.log('Loudness:', results.loudness);
    } catch (e) {
      console.log('DynamicComplexity failed:', e.message);
    }

    // ---- INTERPRETATION LAYER ----
    // Convert raw numbers into human-readable descriptions
    // These are sent to the AI and displayed in the UI
    results.interpretation = {};

    if (results.spectralCentroid) {
      if (results.spectralCentroid < 1500) results.interpretation.brightness = 'dark';
      else if (results.spectralCentroid < 3000) results.interpretation.brightness = 'warm';
      else if (results.spectralCentroid < 5000) results.interpretation.brightness = 'bright';
      else results.interpretation.brightness = 'very bright';
    }

    if (results.danceability !== undefined) {
      if (results.danceability < 0.5) results.interpretation.groove = 'low groove';
      else if (results.danceability < 1.0) results.interpretation.groove = 'moderate groove';
      else if (results.danceability < 1.5) results.interpretation.groove = 'groovy';
      else results.interpretation.groove = 'very danceable';
    }

    if (results.dynamicComplexity !== undefined) {
      if (results.dynamicComplexity < 2) results.interpretation.dynamics = 'compressed/flat';
      else if (results.dynamicComplexity < 5) results.interpretation.dynamics = 'moderate dynamics';
      else results.interpretation.dynamics = 'very dynamic';
    }

    if (results.spectralFlatness !== undefined) {
      if (results.spectralFlatness < 0.1) results.interpretation.tonality = 'very tonal';
      else if (results.spectralFlatness < 0.3) results.interpretation.tonality = 'mostly tonal';
      else if (results.spectralFlatness < 0.6) results.interpretation.tonality = 'mixed tonal/noisy';
      else results.interpretation.tonality = 'noisy/textural';
    }

    console.log('Analysis complete:', JSON.stringify(results, null, 2));
    res.json(results);

  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Audio analysis failed' });
  }
});

module.exports = router;