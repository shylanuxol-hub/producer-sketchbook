// INTERWORKINGS.JSX — AI Transparency Log

// Displays real-time log of what the AI is doing behind the scenes - the "interworkings" panel
// Makes the AI process more visible and transparent
// Log entries include:
// - Audio analysis events (file received, BPM detected, etc.)
// - Image processing events (vision analysis)
// - AI thinking process (extended thinking, shown in purple)
// - Success/error notifications
// - Save/load events
// Each entry has a timestamp, message, and color code:
// - Blue (#4a7fb5): audio-related events
// - Purple (#7b5ea7): thinking/vision events
// - Green (#5DCAA5): success events
// - Red (#c62828): errors
// - Gray (#888): status/informational
// The log auto-scrolls to the latest entry so the user always sees the most recent activity

import { useEffect, useRef } from 'react';

function Interworkings({ logs }) {
  const bottomRef = useRef(null);

  // Auto-scroll to the bottom whenever new logs are added
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  // Format timestamp as HH:MM:SS
  function formatTime(timestamp) {
    const d = new Date(timestamp);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      fontFamily: 'monospace',
      overflow: 'hidden',
    }}>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '3px',
      }}>
        {/* Empty state */}
        {logs.length === 0 && (
          <p style={{ fontSize: '11px', color: '#888' }}>waiting for input...</p>
        )}
        {/* Log entries */}
        {logs.map((log, i) => (
          <div key={i} style={{
            fontSize: '10px',
            lineHeight: '1.4',
            color: '#666',
            borderBottom: '0.5px solid rgba(0,0,0,0.05)',
            paddingBottom: '2px',
          }}>
            {/* Timestamp in gray */}
            <span style={{ color: '#999', marginRight: '6px' }}>
              {formatTime(log.timestamp)}
            </span>
            {/* Message in the log entry's specific color */}
            <span style={{ color: log.color || '#666' }}>
              {log.message}
            </span>
          </div>
        ))}
        {/* Invisible scroll target */}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

export default Interworkings;