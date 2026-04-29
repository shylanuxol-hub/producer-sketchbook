// APP.JS — Main Application Component

// Root component of Producer Sketchbook
// Manages the global state and wires all child components together

import { useState, useCallback } from 'react';
import Journal from './components/Journal';
import WindowPanel from './components/WindowPanel';
import Interworkings from './components/Interworkings';
import SketchbookView from './components/SketchbookView';
import skyBg from './assets/blue-sky_background.png';
import workspaceBg from './assets/workspace_notebook-paper-bg.jpg';
import stickyNote from './assets/sticky-note.png';
import titleImg from './assets/title.png';
import crumpled from './assets/crumpled-paper.jpg';
import AudioWorkspace from './components/AudioWorkspace';
import VisualCanvas from './components/VisualCanvas';
import StickyNote from './components/StickyNote';

function App() {
  // ---- GLOBAL STATE ----

  // Audio metadata from AudioWorkspace (BPM, key, spectrum, etc.)
  // Set when a file is analyzed, cleared after Journal consumes it
  const [audioMetadata, setAudioMetadata] = useState(null);

  // BPM persists separately because audioMetadata gets cleared after the Journal uses it, but may need BPM for other features
  const [currentBpm, setCurrentBpm] = useState(null);

  // Image data from VisualCanvas (filename, base64, MIME type)
  // Set when an image is dropped, cleared after Journal sends it to vision API
  const [droppedImage, setDroppedImage] = useState(null);

  // Transparency log entries shown in the "Interworkings" panel
  // Each entry has: { message, color, timestamp }
  const [logs, setLogs] = useState([]);

  // Controls whether the sketchbook save/load modal is visible
  const [showSketchbook, setShowSketchbook] = useState(false);

  // ---- SESSION DATA FOR SAVING ----
  // These track the current session so we can save it to localStorage

  // All messages in the current conversation
  const [sessionMessages, setSessionMessages] = useState([]);

  // Name of the audio file uploaded in this session (if any)
  const [sessionAudioFile, setSessionAudioFile] = useState(null);

  // How many images have been dropped on the canvas this session
  const [sessionImageCount, setSessionImageCount] = useState(0);

  // ---- LOG FUNCTION ----
  // useCallback prevents unnecessary re-renders since this is
  // passed as a prop to multiple child components
  const addLog = useCallback((message, color) => {
    setLogs(prev => [...prev, {
      message,
      color: color || '#666',
      timestamp: Date.now(),
    }]);
  }, []);

  // ---- EVENT HANDLERS ----

  // Called by AudioWorkspace when audio analysis is complete
  // Receives the full metadata object and the filename
  function handleAudioAnalyzed(meta, fileName) {
    // Store metadata with filename so Journal knows what file it's about
    setAudioMetadata({ ...meta, fileName });
    setSessionAudioFile(fileName);

    // Persist BPM separately for features that need it later
    if (meta.bpm) {
      setCurrentBpm(meta.bpm);
    }

    // Log each piece of analysis data to the Interworkings panel
    // Colors: blue (#4a7fb5) for audio data, gray (#888) for status
    addLog(`audio file received: ${fileName}`, '#4a7fb5');
    if (meta.bpm) addLog(`bpm detected: ${meta.bpm}`, '#4a7fb5');
    if (meta.key) addLog(`key detected: ${meta.key}`, '#4a7fb5');
    addLog(`sample rate: ${meta.sampleRate} Hz, ${meta.channels === 1 ? 'mono' : 'stereo'}`, '#888');
    if (meta.spectrum) {
      const strong = meta.spectrum.filter(b => b.value > 0.5).map(b => b.label);
      if (strong.length > 0) addLog(`strong energy: ${strong.join(', ')}`, '#4a7fb5');
    }
    addLog('sending audio metadata to journal for feedback...', '#888');
  }

  // Called by Journal after it consumes the audio metadata
  // Prevents the same metadata from being sent to the AI twice
  function clearAudioMetadata() {
    setAudioMetadata(null);
  }

  // Called by VisualCanvas when an image is dropped
  // Receives filename, base64 data URL, and MIME type (e.g. "image/jpeg")
  function handleImageDropped(fileName, base64Data, mimeType) {
    setDroppedImage({ fileName, base64Data, mimeType });
    setSessionImageCount(prev => prev + 1);

    // Log to Interworkings — purple (#7b5ea7) for vision-related events
    addLog(`image dropped: ${fileName}`, '#7b5ea7');
    addLog('analyzing image with vision...', '#888');
  }

  // Called by Journal after it consumes the image data
  function clearDroppedImage() {
    setDroppedImage(null);
  }

  // Called by Journal whenever its messages array changes
  // Keeps App.js in sync so conversation is saved
  function handleMessagesUpdate(messages) {
    setSessionMessages(messages);
  }

  // Called by Journal to send log entries to Interworkings
  // How AI activity (thinking, responses, errors) gets logged
  function handleJournalLog(message, color) {
    addLog(message, color);
  }

  // ---- SAVE/LOAD SKETCHBOOK ----

  // Save current session to localStorage
  function saveToSketchbook() {
    // Don't save empty sessions
    if (sessionMessages.length === 0) {
      addLog('nothing to save yet. start a conversation first.', '#c62828');
      return;
    }

    // Auto-generate a title from the first user message
    // Truncate to 50 characters for display in the sketchbook list
    const firstUserMsg = sessionMessages.find(m => m.role === 'user');
    const title = firstUserMsg
      ? firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '')
      : 'untitled session';

    // Build the session object with all relevant data
    const session = {
      id: Date.now(), // Unique ID and creation timestamp
      title: title,
      messages: sessionMessages,
      messageCount: sessionMessages.length,
      audioFile: sessionAudioFile,
      imageCount: sessionImageCount,
      bpm: currentBpm,
    };

    // Load existing sessions, add new one to the front, save back to localStorage
    const existing = localStorage.getItem('sketchbook-sessions');
    const sessions = existing ? JSON.parse(existing) : [];
    sessions.unshift(session); // Newest first
    localStorage.setItem('sketchbook-sessions', JSON.stringify(sessions));

    addLog('session saved to sketchbook', '#5DCAA5'); // Green for success
  }

  // Load a previously saved session
  // Called by SketchbookView when user clicks "open"
  function loadSession(session) {
    setSessionMessages(session.messages);
    if (session.bpm) setCurrentBpm(session.bpm);
    setSessionAudioFile(session.audioFile);
    setSessionImageCount(session.imageCount || 0);
    setShowSketchbook(false); // Close the modal
    addLog(`loaded session: ${session.title}`, '#5DCAA5');
  }

  // ---- RENDER ----
  return (
    <div style={{
      height: '100dvh', // Full viewport height (dvh accounts for mobile browser chrome)
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      backgroundImage: `url(${skyBg})`, // Sky background behind the notebook
      backgroundSize: '100% 100%',
      backgroundPosition: 'center',
      padding: '10px 20px 20px',
      fontFamily: "'Atkinson Hyperlegible', sans-serif",
      overflow: 'hidden', // Prevent scrolling — everything fits in viewport
    }}>

      {/* ---- HEADER BAR ---- */}
      {/* Contains title image and save/load buttons */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '8px 14px',
        marginBottom: '6px',
        position: 'relative', // For absolute positioning of title and buttons
        minHeight: '70px',
        overflow: 'visible', // Allow sticky note to overflow above
      }}>
        {/* Title image — centered with slight right offset for visual balance */}
        <img
          src={titleImg}
          alt="Producer Sketchbook"
          style={{
            position: 'absolute',
            height: '90px',
            objectFit: 'contain',
            left: '50%',
            top: '50%',
            transform: 'translate(-50%, -50%)',
            marginLeft: '34px', // Slight offset to account for button width on right
          }}
        />

        {/* Save/Load buttons — positioned on the right side of the header */}
        <div style={{
          position: 'absolute',
          right: '14px',
          display: 'flex',
          gap: '8px',
        }}>
          {/* Opens the sketchbook modal to view/load saved sessions */}
          <button onClick={() => setShowSketchbook(true)} style={{
            fontSize: '18px',
            padding: '6px 16px',
            borderRadius: '20px',
            border: '1px solid rgba(0, 0, 0, 0.5)',
            background: 'rgba(255,255,255,0.85)',
            color: '#333',
            cursor: 'pointer',
            fontFamily: "'Atkinson Hyperlegible', sans-serif",
            fontWeight: 500,
            letterSpacing: '1px',
          }}>
            my sketchbook
          </button>

          {/* Saves the current session to localStorage */}
          <button onClick={saveToSketchbook} style={{
            fontSize: '18px',
            padding: '6px 16px',
            borderRadius: '20px',
            border: '1px solid rgba(0, 0, 0, 0.5)',
            background: '#ffc9f6', // Pink to match app's accent color
            color: '#333',
            cursor: 'pointer',
            fontFamily: "'Atkinson Hyperlegible', sans-serif",
            fontWeight: 500,
            letterSpacing: '1px',
          }}>
            save to sketchbook
          </button>
        </div>
      </div>

      {/* ---- NOTEBOOK SPREAD ---- */}
      {/* Main workspace — two-page notebook spread */}
      {/* data-notebook attribute is used by StickyNote for drag positioning */}
      <div data-notebook style={{
        flex: 1,
        minHeight: 0, // Allows flex children to shrink below content size
        backgroundImage: `url(${workspaceBg})`, // Notebook paper texture
        backgroundSize: '100% 100%',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        borderRadius: '2px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.15)', // Subtle depth shadow
        display: 'grid',
        gridTemplateColumns: '1fr 1fr', // Two equal columns (left page, right page)
        padding: '30px 40px',
        gap: '50px', // Space between left and right pages (the "spine")
        position: 'relative', // For sticky note absolute positioning
      }}>

        {/* ---- STICKY NOTE ---- */}
        {/* Floats above the notebook with a random creative prompt */}
        {/* Draggable on the notebook surface, click to expand */}
        <StickyNote stickyNoteBg={stickyNote} crumpledBg={crumpled} />

        {/* ---- LEFT PAGE ---- */}
        {/* Guided Journal (main AI chat) and "Interworkings" (transparency log) */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          overflow: 'hidden',
        }}>
          {/* Journal takes up most of the left page (flex: 1) */}
          <WindowPanel title="guided journal" style={{ flex: 1 }}>
            <Journal
              audioMetadata={audioMetadata} // Audio analysis data to auto-send
              onMetadataConsumed={clearAudioMetadata} // Callback to clear after sending
              droppedImage={droppedImage} // Image data to send to vision API
              onImageConsumed={clearDroppedImage} // Callback to clear after sending
              onMessagesUpdate={handleMessagesUpdate} // Reports messages for save feature
              onLog={handleJournalLog} // Sends log entries to Interworkings
              loadedMessages={sessionMessages.length > 0 ? sessionMessages : null} // Restored session
            />
          </WindowPanel>

          {/* Interworkings is a fixed-height panel at the bottom of the left page */}
          <WindowPanel title="interworkings" style={{ height: '140px', flexShrink: 0 }}>
            <Interworkings logs={logs} />
          </WindowPanel>
        </div>

        {/* ---- RIGHT PAGE ---- */}
        {/* Contains the Audio Workspace and Visual Canvas, split evenly */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          overflow: 'hidden',
        }}>
          {/* Audio Workspace — drag-and-drop audio/MIDI files */}
          <WindowPanel title="audio workspace" style={{ flex: 1 }}>
            <AudioWorkspace onAudioAnalyzed={handleAudioAnalyzed} />
          </WindowPanel>

          {/* Visual Canvas — drag-and-drop image collage */}
          <WindowPanel title="visual canvas" style={{ flex: 1 }}>
            <VisualCanvas onImageDropped={handleImageDropped} />
          </WindowPanel>
        </div>

      </div>

      {/* ---- SKETCHBOOK MODAL ---- */}
      {/* Only renders when showSketchbook is true */}
      {/* Displays a list of saved sessions with open/delete buttons */}
      {showSketchbook && (
        <SketchbookView
          onClose={() => setShowSketchbook(false)}
          onLoad={loadSession}
        />
      )}
    </div>
  );
}

export default App;