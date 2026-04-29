// WINDOWPANEL.JSX — Reusable Window Panel Component

// Container component that wraps each workspace area with a retro-style window style
// Gradient title bar with minimize and close buttons, crumpled paper texture overlay, and collapse/expand functionality
// Three states:
// 1. Normal — fully visible with title bar and content
// 2. Minimized — only the title bar is visible, content hidden
// 3. Closed — replaced by a small "show [title]" restore button
// Used by: Guided Journal, Interworkings, Audio Workspace, and Visual Canvas

import { useState } from 'react';
import crumpled from '../assets/crumpled-paper.jpg';

function WindowPanel({ title, children, style }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isClosed, setIsClosed] = useState(false);

  // ---- CLOSED STATE ----
  // When closed, the entire panel is replaced by a small clickable button that says "show [title]". Clicking it restores the panel
  if (isClosed) {
    return (
      <div
        onClick={() => setIsClosed(false)}
        style={{
          padding: '4px 8px',
          background: 'rgba(175, 204, 229, 0.3)',
          borderRadius: '3px',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          flexShrink: 0, // Don't let other panels push this out
        }}
      >
        <span style={{
          fontSize: '11px',
          color: '#666',
          fontFamily: "'Atkinson Hyperlegible', sans-serif",
        }}>
          show {title}
        </span>
      </div>
    );
  }

  // ---- NORMAL / MINIMIZED STATE ----
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      borderRadius: '3px',
      overflow: 'hidden',
      border: '1px solid rgba(0,0,0,0.08)',
      position: 'relative',
      transition: 'none', // Snap instead of animate to prevent text sliding
      ...style,
      // Snap instead of animate to prevent text sliding
      ...(isMinimized ? { flex: 'none', height: 'auto' } : {}),
    }}>
      {/* ---- TITLE BAR ---- */}
      {/* Blue gradient bar with window control buttons */}
      {/* When minimized, clicking the title bar restores the panel */}
      <div style={{
        background: 'linear-gradient(to right, #4c7fc6, #b7deff)',
        padding: '8px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        cursor: isMinimized ? 'pointer' : 'default',
      }}
        onClick={isMinimized ? () => setIsMinimized(false) : undefined}
      >
        {/* Panel title */}
        <span style={{
          color: 'white',
          fontSize: '18px',
          fontFamily: "'Atkinson Hyperlegible', sans-serif",
          letterSpacing: '2px',
        }}>
          {title}
        </span>

        {/* Window control buttons */}
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {/* Minimize/Restore toggle */}
          {/* Shows — when normal (click to minimize) */}
          {/* Shows ⧠ when minimized (click to restore) */}
          <span
            onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }}
            style={{ color: 'white', fontSize: '20px', cursor: 'pointer', userSelect: 'none' }}
          >
            {isMinimized ? '⧠' : '—'}
          </span>
          {/* Close button */}
          <span
            onClick={(e) => { e.stopPropagation(); setIsClosed(true); }}
            style={{ color: 'white', fontSize: '20px', cursor: 'pointer', userSelect: 'none' }}
          >
            ×
          </span>
        </div>
      </div>

      {/* ---- CONTENT AREA ---- */}
      {/* Hidden when minimized. Contains the crumpled paper texture overlay and the actual component content */}
      {!isMinimized && (
        <div style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          background: '#eceaf0', // Light purple-grey base color
        }}>
          {/* Crumpled paper texture overlay */}
          {/* Positioned absolutely to cover the entire content area */}
          {/* 20% opacity so it's subtle but adds tactile quality */}
          {/* pointerEvents: none so it doesn't block interactions */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage: `url(${crumpled})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.20,
            pointerEvents: 'none',
            zIndex: 1,
          }} />
          {/* Actual content (children) */}
          {/* zIndex: 2 so it sits above the texture overlay */}
          <div style={{
            flex: 1,
            position: 'relative',
            zIndex: 2,
            padding: '10px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
}

export default WindowPanel;