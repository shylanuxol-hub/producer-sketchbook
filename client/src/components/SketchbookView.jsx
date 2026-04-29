// SKETCHBOOKVIEW.JSX — Save/Load Modal

// A modal overlay that displays all saved sessions from localStorage.
// Users can:
// - View a list of their saved sessions with metadata
// - Open a saved session to restore the conversation
// - Delete saved sessions
// Each saved session includes:
// - Auto-generated title (from first user message)
// - Date and time of save
// - Number of messages
// - Audio file name (if any)
// - Image count (if any)
// The modal appears over the entire app when "my sketchbook" is clicked, and can be closed with the close button or by selecting a session to open

import { useState, useEffect } from 'react';

function SketchbookView({ onClose, onLoad }) {
  const [sessions, setSessions] = useState([]);

  // Load saved sessions from localStorage on mount
  useEffect(() => {
    loadSessions();
  }, []);

  function loadSessions() {
    const saved = localStorage.getItem('sketchbook-sessions');
    if (saved) {
      setSessions(JSON.parse(saved));
    }
  }

  // Delete a session by ID and update localStorage
  function deleteSession(id) {
    const updated = sessions.filter(s => s.id !== id);
    setSessions(updated);
    localStorage.setItem('sketchbook-sessions', JSON.stringify(updated));
  }

  // Format a timestamp into a readable date string
  function formatDate(timestamp) {
    const d = new Date(timestamp);
    return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  return (
    // Full-screen overlay with semi-transparent background
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 100,
      fontFamily: "'Atkinson Hyperlegible', sans-serif",
    }}>
      {/* Modal card */}
      <div style={{
        background: '#faf8f4', // Warm off-white to match notebook feel
        borderRadius: '8px',
        padding: '24px',
        width: '500px',
        maxHeight: '70vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
      }}>
        {/* Header with title and close button */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}>
          <h2 style={{ fontSize: '18px', margin: 0, fontWeight: 500 }}>my sketchbook</h2>
          <button onClick={onClose} style={{
            fontSize: '14px',
            padding: '4px 14px',
            borderRadius: '20px',
            border: 'none',
            background: '#ffc9f6',
            color: '#000',
            cursor: 'pointer',
            fontFamily: "'Atkinson Hyperlegible', sans-serif",
          }}>
            close
          </button>
        </div>

        {/* Scrollable sessions list */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}>
          {/* Empty state */}
          {sessions.length === 0 && (
            <p style={{ fontSize: '13px', color: '#888', textAlign: 'center', padding: '20px' }}>
              no saved sessions yet. start creating and hit "save to sketchbook" to save your work.
            </p>
          )}

          {/* Session cards */}
          {sessions.map((session) => (
            <div key={session.id} style={{
              padding: '12px',
              background: 'rgba(175, 204, 229, 0.15)',
              borderRadius: '6px',
              border: '1px solid rgba(0,0,0,0.06)',
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'flex-start',
                marginBottom: '6px',
              }}>
                {/* Session title and date */}
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 500, margin: '0 0 2px 0' }}>
                    {session.title || 'untitled session'}
                  </p>
                  <p style={{ fontSize: '11px', color: '#888', margin: 0 }}>
                    {formatDate(session.id)}
                  </p>
                </div>
                {/* Open and delete buttons */}
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button onClick={() => onLoad(session)} style={{
                    fontSize: '11px',
                    padding: '3px 12px',
                    borderRadius: '20px',
                    border: 'none',
                    background: '#afcce5',
                    color: '#071f37',
                    cursor: 'pointer',
                    fontFamily: "'Atkinson Hyperlegible', sans-serif",
                  }}>
                    open
                  </button>
                  <button onClick={() => deleteSession(session.id)} style={{
                    fontSize: '11px',
                    padding: '3px 12px',
                    borderRadius: '20px',
                    border: 'none',
                    background: '#ffc9f6',
                    color: '#000',
                    cursor: 'pointer',
                    fontFamily: "'Atkinson Hyperlegible', sans-serif",
                  }}>
                    delete
                  </button>
                </div>
              </div>

              {/* Session metadata preview */}
              <p style={{ fontSize: '12px', color: '#666', margin: 0 }}>
                {session.messageCount} messages
                {session.audioFile ? ` · ${session.audioFile}` : ''}
                {session.imageCount > 0 ? ` · ${session.imageCount} images` : ''}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SketchbookView;