// STICKYNOTE.JSX — Creative Prompt System

// A sticky note that sits on the notebook page with a random creative prompt for the producer
// Each page refresh picks a new prompt from a curated list of 18 prompts, each paired with ASCII art / Kaomoji
// Two modes:
// 1. Collapsed — small sticky note on the notebook showing the ASCII art and "click for prompt". Can be dragged anywhere on the notebook surface
// 2. Expanded — centered modal overlay showing the full creative prompt text. Click anywhere outside to close
// The sticky note is draggable on the notebook page. It uses the data-notebook attribute on the notebook div to calculate its position relative to the notebook container
// A click vs drag detection system (5px threshold) ensures that clicking opens the prompt and dragging repositions the note
// When dragged, the note "lifts" — it straightens (rotation goes to 0), scales up slightly, and gains a drop shadow

import { useState, useEffect, useRef } from 'react';

// PROMPTS ARRAY

// Prompts designed to:
// - Encourage hands-on experimentation in the DAW
// - Be action-oriented (not just inspirational quotes)
// - Feel low-pressure and playful
// - Connect different senses and domains
// - Match the app's tone: warm, creative, slightly existential

const prompts = [
  {
    text: "record the first sound you hear outside your window. chop it, reverse it, pitch it down. build a beat around it.",
    ascii: "♪ ~( ᐛ )~"
  },
  {
    text: "pick a color or texture. make a song that sounds exactly like that color feels.",
    ascii: "(◕‿◕✿)"
  },
  {
    text: "open your DAW. set a timer for 10 minutes. make something bad on purpose. then find a beautiful piece hiding inside it.",
    ascii: "┏(・o・)┛"
  },
  {
    text: "take your favorite song right now. what would it sound like if it was made underwater? try it.",
    ascii: "~~ ><(((º>"
  },
  {
    text: "hum the melody stuck in your head. record it on your phone. sample yourself.",
    ascii: "( ˘ ³˘)♪"
  },
  {
    text: "make a track using only sounds from your kitchen. silverware, water, cabinets. see what happens.",
    ascii: "ヽ(°〇°)ﾉ"
  },
  {
    text: "what emotion are you sitting with right now? don't name it. just make a 30 second loop that feels like it.",
    ascii: "(；⌣̀_⌣́)"
  },
  {
    text: "find a texture you love. fabric, wood, concrete. record yourself touching it. that's your hi-hat now.",
    ascii: "( ˙▿˙ )σ"
  },
  {
    text: "steal the rhythm of your heartbeat. tap it out. build from there.",
    ascii: "♡( ◡‿◡ )"
  },
  {
    text: "take a song you made that you hate. remove everything except one element. that element is the seed of something new.",
    ascii: "(ﾉ◕ヮ◕)ﾉ*:・ﾟ✧"
  },
  {
    text: "go for a walk. count the rhythm of your footsteps. come back and set your tempo to that bpm.",
    ascii: "ᕕ( ᐛ )ᕗ"
  },
  {
    text: "layer three sounds that have no business being together. let them argue. find the peace.",
    ascii: "(ᵔᴥᵔ)"
  },
  {
    text: "what would your music sound like if you weren't afraid of what anyone thought? make that.",
    ascii: "( •̀ᄇ• ́)ﻭ✧"
  },
  {
    text: "record silence for 60 seconds. listen back. it's not silent. use what you find.",
    ascii: "(   ˘ω˘   )"
  },
  {
    text: "think of a place that makes you feel safe. what does that place sound like? start there.",
    ascii: "☁ (◡‿◡) ☁"
  },
  {
    text: "make a beat that sounds like falling asleep on a train.",
    ascii: "( ᵕ ᵕ̩̩ )━☆"
  },
  {
    text: "put your phone in your pocket. record yourself dancing. sample the movement.",
    ascii: "┗(•ˇ_ˇ•)―→"
  },
  {
    text: "write a letter to someone you miss. read it out loud. that's your vocal sample.",
    ascii: "( ˊᵕˋ )♡.°⑅"
  },
];

function StickyNote({ stickyNoteBg, crumpledBg }) {
  // ---- STATE ----  
  const [prompt, setPrompt] = useState(null); // Randomly selected prompt
  const [isExpanded, setIsExpanded] = useState(false); // Whether the modal is open
  const [position, setPosition] = useState({ left: '22%', top: '-105px' }); // Position on notebook
  const [isDragging, setIsDragging] = useState(false); // Whether the note is being dragged
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // Cursor offset from note corner

  const noteRef = useRef(null); // Ref for click-outside detection on expanded modal
  const dragStartPos = useRef({ x: 0, y: 0 }); // Mouse position at drag start (for click detection)

  // ---- PICK RANDOM PROMPT ON MOUNT ----
  // A new prompt is selected each time the page loads/refreshes
  useEffect(() => {
    const randomIndex = Math.floor(Math.random() * prompts.length);
    setPrompt(prompts[randomIndex]);
  }, []);

  // ---- CLICK OUTSIDE TO CLOSE MODAL ----
  // When expanded, clicking anywhere outside the note closes it
  useEffect(() => {
    if (!isExpanded) return;

    function handleClickOutside(e) {
      if (noteRef.current && !noteRef.current.contains(e.target)) {
        setIsExpanded(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isExpanded]);

  // DRAG HANDLERS

  // The sticky note can be dragged around the notebook surface
  // Track mouse position at mouseDown and compare it at mouseUp
  // If the mouse moved less than 5px, it's treated as a click (opens the prompt). Otherwise it's a drag
  // During drag, the note position is calculated relative to the notebook container (found via data-notebook attribute)
  function handleMouseDown(e) {
    if (isExpanded) return;
    e.preventDefault(); // Prevent text selection while dragging

    // Record where the cursor is relative to the note's top-left corner
    const rect = e.currentTarget.getBoundingClientRect();
    setDragOffset({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
    // Record starting position for click vs drag detection
    dragStartPos.current = { x: e.clientX, y: e.clientY };
    setIsDragging(true);
  }

  // Mouse move and mouse up are attached to the document (not the note) so dragging works even when the cursor moves outside the note
  useEffect(() => {
    if (!isDragging) return;

    function handleMouseMove(e) {
      // Find the notebook container for relative positioning
      const notebook = document.querySelector('[data-notebook]');
      if (!notebook) return;
      const notebookRect = notebook.getBoundingClientRect();

      // Update position relative to the notebook
      setPosition({
        left: `${e.clientX - notebookRect.left - dragOffset.x}px`,
        top: `${e.clientY - notebookRect.top - dragOffset.y}px`,
      });
    }

    function handleMouseUp(e) {
      setIsDragging(false);

      // Click vs drag detection:
      // If the mouse moved less than 5px in either direction, treat it as a click and open the prompt
      const dx = Math.abs(e.clientX - dragStartPos.current.x);
      const dy = Math.abs(e.clientY - dragStartPos.current.y);
      if (dx < 5 && dy < 5) {
        setIsExpanded(true);
      }
    }

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  // Don't render until a prompt is selected
  if (!prompt) return null;

  // RENDER
  return (
    <>
      {/* ---- COLLAPSED STICKY NOTE (draggable) ---- */}
      {/* Shows on the notebook page with ASCII art and "click for prompt" */}
      {/* Can be dragged to any position on the notebook */}
      {!isExpanded && (
        <div
          onMouseDown={handleMouseDown}
          style={{
            position: 'absolute',
            left: position.left, // Dynamic — starts at 22%, switches to px after drag
            top: position.top, // Dynamic — starts at -105px, switches to px after drag
            width: '200px',
            height: '180px',
            backgroundImage: `url(${stickyNoteBg})`, // Sticky note texture image
            backgroundSize: 'contain',
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'center',
            zIndex: 20, // Above the notebook content but below modals
            // When dragging: straighten, scale up, add shadow
            // When not dragging: slight tilt for natural look
            transform: isDragging ? 'rotate(0deg) scale(1.05)' : 'rotate(-1deg)',
            overflow: 'hidden',
            cursor: isDragging ? 'grabbing' : 'grab',
            // Disable transitions during drag for smooth movement
            transition: isDragging ? 'none' : 'transform 0.2s ease',
            // Drop shadow appears when "lifted" during drag
            filter: isDragging ? 'drop-shadow(0 6px 12px rgba(0,0,0,0.25))' : 'none',
            userSelect: 'none', // Prevent text selection
          }}
        >
          {/* Crumpled paper texture overlay on the note */}  
          <div style={{
            position: 'absolute',
            top: 30,
            left: 20,
            right: 15,
            bottom: 20,
            backgroundImage: `url(${crumpledBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.20,
            pointerEvents: 'none', // Don't block mouse events
            borderRadius: '2px',
          }} />

          {/* Note content — ASCII art and "click for prompt" text */}
          <div style={{
            position: 'absolute',
            top: 30,
            left: 20,
            right: 15,
            bottom: 20,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px',
            pointerEvents: 'none', // Let mouse events pass through to parent
          }}>
            <span style={{ fontSize: '22px', lineHeight: 1, color: '#515151' }}>
              {prompt.ascii}
            </span>
            <p style={{
              fontSize: '10px',
              color: '#888',
              textAlign: 'center',
              margin: 0,
              fontFamily: "'Atkinson Hyperlegible', sans-serif",
            }}>
              click for prompt
            </p>
          </div>
        </div>
      )}

      {/* ---- EXPANDED MODAL ---- */}
      {/* Full-screen overlay with the sticky note enlarged and centered */}
      {/* Shows the complete creative prompt text */}
      {isExpanded && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.3)', // Semi-transparent backdrop
            zIndex: 50, // Above everything else
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setIsExpanded(false)} // Click backdrop to close
        >
          <div
            ref={noteRef}
            onClick={(e) => e.stopPropagation()} // Click backdrop to close
            style={{
              width: '340px',
              height: '320px',
              backgroundImage: `url(${stickyNoteBg})`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              position: 'relative',
              animation: 'noteIn 0.25s ease-out', // Smooth scale-in animation
            }}
          >
            {/* Crumpled paper texture on expanded note */}
            <div style={{
              position: 'absolute',
              top: 55,
              left: 30,
              right: 25,
              bottom: 37,
              backgroundImage: `url(${crumpledBg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              opacity: 0.15,
              pointerEvents: 'none',
              borderRadius: '2px',
            }} />

            {/* Expanded note content — ASCII art, label, prompt, close hint */}
            <div style={{
              position: 'absolute',
              top: 40,
              left: 35,
              right: 30,
              bottom: 30,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '14px',
            }}>
              {/* Larger ASCII art */}
              <span style={{ fontSize: '32px', lineHeight: 1, color: '#515151' }}>
                {prompt.ascii}
              </span>

              {/* "today's prompt" label */}  
              <p style={{
                fontSize: '11px',
                fontWeight: 500,
                color: '#999',
                textAlign: 'center',
                margin: 0,
                fontFamily: "'Atkinson Hyperlegible', sans-serif",
                letterSpacing: '2px',
                textTransform: 'uppercase',
              }}>
                today's prompt
              </p>

                {/* Full prompt text */}
              <p style={{
                fontSize: '14px',
                color: '#333',
                textAlign: 'center',
                lineHeight: '1.7',
                margin: 0,
                fontFamily: "'Atkinson Hyperlegible', sans-serif",
              }}>
                {prompt.text}
              </p>

              {/* Close hint */}
              <p style={{
                fontSize: '10px',
                color: '#aaa',
                margin: 0,
                fontFamily: "'Atkinson Hyperlegible', sans-serif",
              }}>
                click anywhere to close
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ---- CSS ANIMATION ---- */}
      {/* Scale-in animation for the expanded modal */}
      <style>{`
        @keyframes noteIn {
          0% { opacity: 0; transform: scale(0.85); }
          100% { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </>
  );
}

export default StickyNote;