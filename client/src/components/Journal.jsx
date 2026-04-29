// JOURNAL.JSX — Guided Journal (AI Chat Interface)

// Core interaction surface of Producer Sketchbook
// Journal handles three types of input:
// 1. User-typed messages — sent to /api/chat as text
// 2. Audio metadata — auto-sent when a file is analyzed in AudioWorkspace
// 3. Image data — auto-sent with vision when an image is dropped on canvas
// Features:
// - Typing animation with blinking cursor on AI responses
// - Loading dots while waiting for API
// - Auto-scroll to newest message
// - Extended thinking sent to Interworkings log
// - Messages reported up to App.js for save/load functionality
// - Conversation history sent with each API call for context

import { useState, useEffect, useRef } from 'react';

function Journal({ audioMetadata, onMetadataConsumed, droppedImage, onImageConsumed, onMessagesUpdate, onLog, loadedMessages }) {
  // ---- STATE ----

  const [input, setInput] = useState(''); // Current text in the input field
  const [messages, setMessages] = useState([]); // Full conversation history
  const [isLoading, setIsLoading] = useState(false); // True while waiting for API response
  const [displayedText, setDisplayedText] = useState(''); // Text being typed out character by character
  const [isTyping, setIsTyping] = useState(false); // True during typing animation
  const chatEndRef = useRef(null); // Ref to invisible div at bottom of chat for auto-scrolling

  // ---- AUTO-SCROLL ----
  // Scroll to bottom whenever messages change or text is being typed
  // behavior: 'smooth' gives nice scroll animation
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, displayedText]);

  // ---- LOAD SAVED MESSAGES ----
  // When a saved session is loaded from the sketchbook, replace the current messages with the saved ones
  useEffect(() => {
    if (loadedMessages && loadedMessages.length > 0) {
      setMessages(loadedMessages);
    }
  }, [loadedMessages]);

  // ---- REPORT MESSAGES TO APP.JS ----
  // Every time messages change, tell App.js so it can save them
  // Enables the "save to sketchbook" feature
  useEffect(() => {
    if (onMessagesUpdate) {
      onMessagesUpdate(messages);
    }
  }, [messages]);

  // ---- AUTO-SEND AUDIO METADATA ----
  // When AudioWorkspace finishes analyzing a file, the metadata arrives here as a prop
  // Automatically construct a message describing the analysis results and send it to the AI
  // The message is framed as such because the AI can't actually hear audio, it can only work with the metadata we provide
  useEffect(() => {
    if (!audioMetadata) return;

    let autoMessage;

    if (audioMetadata.isMidi) {
      // MIDI files get their own message format with note/track data
      const parts = [`Here's what my MIDI analyzer detected from a file called "${audioMetadata.fileName}":`];
      if (audioMetadata.bpm) parts.push(`Tempo: ${audioMetadata.bpm} BPM.`);
      if (audioMetadata.noteCount) parts.push(`Total notes: ${audioMetadata.noteCount}.`);
      if (audioMetadata.trackCount) parts.push(`Tracks: ${audioMetadata.trackCount}.`);
      if (audioMetadata.duration) parts.push(`Duration: ${Math.floor(audioMetadata.duration / 60)}:${Math.floor(audioMetadata.duration % 60).toString().padStart(2, '0')}.`);
      parts.push('Based on this MIDI data, what kind of piece does this seem like? What creative directions would you suggest?');
      autoMessage = parts.join(' ');
    } else {
      // Audio files include metadata from both browser-side analysis
      // and Essentia.js (if available): BPM, key, spectrum, brightness, etc.
      const parts = [`Here's what my audio analyzer detected from a file called "${audioMetadata.fileName}":`];
      if (audioMetadata.bpm) parts.push(`BPM: ${audioMetadata.bpm}.`);
      if (audioMetadata.key) parts.push(`Key: ${audioMetadata.key}.`);
      parts.push(`Duration: ${Math.floor(audioMetadata.duration / 60)}:${Math.floor(audioMetadata.duration % 60).toString().padStart(2, '0')}.`);
      parts.push(`Sample rate: ${audioMetadata.sampleRate} Hz.`);
      parts.push(`${audioMetadata.channels === 1 ? 'Mono' : 'Stereo'}.`);
      if (audioMetadata.bitDepth) {
        parts.push(`Bit depth: ${audioMetadata.bitDepth === 'compressed' ? 'compressed format' : audioMetadata.bitDepth + '-bit'}.`);
      }
      // Essentia.js interpretation data (brightness, tonality, groove, dynamics)
      // Human-readable labels derived from spectral analysis
      if (audioMetadata.interpretation) {
        const interp = audioMetadata.interpretation;
        if (interp.brightness) parts.push(`Brightness: ${interp.brightness}.`);
        if (interp.tonality) parts.push(`Character: ${interp.tonality}.`);
        if (interp.groove) parts.push(`Groove: ${interp.groove}.`);
        if (interp.dynamics) parts.push(`Dynamics: ${interp.dynamics}.`);
      }
      if (audioMetadata.danceability !== undefined) parts.push(`Danceability: ${audioMetadata.danceability}.`);
      // Browser-side frequency spectrum data
      if (audioMetadata.spectrum) {
        const specDesc = audioMetadata.spectrum.filter(b => b.value > 0.5).map(b => b.label);
        if (specDesc.length > 0) parts.push(`Strong frequency energy in: ${specDesc.join(', ')}.`);
        const weakDesc = audioMetadata.spectrum.filter(b => b.value < 0.2).map(b => b.label);
        if (weakDesc.length > 0) parts.push(`Low frequency energy in: ${weakDesc.join(', ')}.`);
      }
      parts.push('Based on this data, what does this sound like it could be? One or two thoughts max.');
      autoMessage = parts.join(' ');
    }

    sendMessage(autoMessage);
    // Clear the metadata so it doesn't get sent again
    if (onMetadataConsumed) onMetadataConsumed();
  }, [audioMetadata]);

  // ---- AUTO-SEND DROPPED IMAGE ----
  // When an image is dropped on the Visual Canvas, the base64 data arrives here as a prop
  // Then sent to Anthropic vision API so the AI can see the image and respond
  useEffect(() => {
    if (!droppedImage) return;
    sendImageMessage(droppedImage);
    if (onImageConsumed) onImageConsumed();
  }, [droppedImage]);

  // ---- SEND TEXT MESSAGE ----
  // Sends a text-only message to the chat API
  // The full conversation history is sent each time for context
  async function sendMessage(text) {
    // Add the user message to the conversation
    const userMessage = { role: 'user', content: text };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    // Log activity to Interworkings panel
    if (onLog) onLog('user message received', '#4a7fb5');
    if (onLog) onLog('sending to ai for response...', '#888');

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // Send the full conversation history so AI has context
        body: JSON.stringify({ messages: updatedMessages })
      });
      const data = await response.json();
      setIsLoading(false);

      if (onLog) onLog('ai response received', '#5DCAA5');

      // ---- EXTENDED THINKING ----
      // If the AI included thinking in its response, display in the "Interworkings" panel line by line with a stagger
      // Creates a real-time effect of watching the AI think
      if (data.thinking && onLog) {
        // Split thinking into sentences
        const thinkingLines = data.thinking.split(/[.!?]\s+/).filter(line => line.trim());
        thinkingLines.forEach((line, i) => {
          // Stagger each line by 200ms for a cascading effect
          setTimeout(() => {
            onLog(line.trim().toLowerCase(), '#7b5ea7'); // Purple for thinking
          }, i * 200);
        });
      }

      // Start the typing animation for the response
      typeMessage(data.reply, () => {
        // Once typing finishes, add the AI message to the conversation
        const aiMessage = { role: 'assistant', content: data.reply };
        setMessages([...updatedMessages, aiMessage]);
        setDisplayedText('');
        if (onLog) onLog('response displayed', '#888');
      });
    } catch (error) {
      setIsLoading(false);
      if (onLog) onLog('error: api call failed', '#c62828'); // Red for errors
      console.error(error);
    }
  }

  // ---- SEND IMAGE MESSAGE (VISION) ----
  // Sends an image to the Anthropic API using the vision capability
  // The API message format uses a content array with both an image block and a text block
  async function sendImageMessage(imageData) {
    const displayText = `I just dropped an image called "${imageData.fileName}" onto my sketchbook page as visual inspiration.
    What does this image sound like? Keep it to 2 sentences max.`;
    const userMessage = { role: 'user', content: displayText };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setIsLoading(true);

    if (onLog) onLog('processing image with vision...', '#7b5ea7');

    // Extract the raw base64 data (remove the "data:image/jpeg;base64," prefix)
    const base64 = imageData.base64Data.split(',')[1];

    // Build the API message with the image embedded
    // Previous messages are sent as plain text for context, but the current message includes both the image and text
    const apiMessages = [
      ...messages.map(m => ({ role: m.role, content: m.content })),
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageData.mimeType, // "image/jpeg"
              data: base64,
            }
          },
          {
            type: 'text',
            text: `I just dropped this image onto my sketchbook page as visual inspiration. What does this image sound like? Be brief, 2-3 sentences max.`
          }
        ]
      }
    ];

    try {
      const response = await fetch('http://localhost:3001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages })
      });
      const data = await response.json();
      setIsLoading(false);

      if (onLog) onLog('vision analysis complete', '#5DCAA5');

      // Display thinking in "Interworkings" (same as text messages)
      if (data.thinking && onLog) {
        const thinkingLines = data.thinking.split(/[.!?]\s+/).filter(line => line.trim());
        thinkingLines.forEach((line, i) => {
          setTimeout(() => {
            onLog(line.trim().toLowerCase(), '#7b5ea7');
          }, i * 200);
        });
      }

      typeMessage(data.reply, () => {
        const aiMessage = { role: 'assistant', content: data.reply };
        setMessages([...updatedMessages, aiMessage]);
        setDisplayedText('');
      });
    } catch (error) {
      setIsLoading(false);
      if (onLog) onLog('error: vision analysis failed', '#c62828');
      console.error(error);
    }
  }

  // ---- TYPING ANIMATION ----
  // Creates a typewriter effect for AI responses
  // Characters appear one at a time at 15ms intervals
  // A blinking cursor is shown at the end of the text
  function typeMessage(text, onComplete) {
    setIsTyping(true);
    setDisplayedText('');
    let i = 0;
    const speed = 15; // Milliseconds per character
    const interval = setInterval(() => {
      // Use slice instead of concatenation for cleaner rendering
      setDisplayedText(text.slice(0, i + 1));
      i++;
      if (i >= text.length) {
        clearInterval(interval);
        setIsTyping(false);
        onComplete(); // Add the full message to the conversation
      }
    }, speed);
  }

  // ---- HANDLE USER INPUT ----
  // Called when user clicks send or presses Enter
  async function handleSend() {
    // Prevent empty messages and double-sends while loading/typing
    if (!input.trim() || isLoading || isTyping) return;
    const text = input;
    setInput(''); // Clear input immediately for snappy feel
    sendMessage(text);
  }

  // ---- RENDER ----
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      fontFamily: "'Atkinson Hyperlegible', sans-serif",
    }}>
      {/* ---- MESSAGE LIST ---- */}
      {/* Scrollable container for all chat messages */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        paddingRight: '4px', // Small padding so scrollbar doesn't overlap text
      }}>
        {/* Render each message as a bubble */}
        {/* User messages: pink, right-aligned */}
        {/* AI messages: blue, left-aligned */}
        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
            maxWidth: '90%',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '14px',
            lineHeight: '1.6',
            background: msg.role === 'user' ? '#ffc9f6' : '#90bde4',
            color: msg.role === 'user' ? '#3b0e1e' : '#071f37',
            border: msg.role === 'user' ? '0.5px solid #f0a0e0' : '0.5px solid #8fb8d4',
            // Tail effect: one corner is sharper to indicate direction
            borderBottomRightRadius: msg.role === 'user' ? '2px' : '8px',
            borderBottomLeftRadius: msg.role === 'user' ? '8px' : '2px',
          }}>
            {msg.content}
          </div>
        ))}

        {/* ---- LOADING DOTS ---- */}
        {/* Three bouncing dots shown while waiting for API response */}
        {isLoading && (
          <div style={{
            alignSelf: 'flex-start',
            padding: '8px 16px',
            borderRadius: '8px',
            background: '#90bde4',
            borderBottomLeftRadius: '2px',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}>
            {[0, 1, 2].map((dot) => (
              <div key={dot} style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#071f37',
                opacity: 0.5,
                // Each dot bounces with a slight delay for a wave effect
                animation: `bounce 1.2s ease-in-out ${dot * 0.2}s infinite`,
              }} />
            ))}
          </div>
        )}

        {/* ---- TYPING ANIMATION ---- */}
        {/* Shows the AI response being typed out character by character */}
        {/* Includes a blinking cursor at the end */}
        {isTyping && (
          <div style={{
            alignSelf: 'flex-start',
            maxWidth: '90%',
            padding: '8px 12px',
            borderRadius: '8px',
            fontSize: '14px',
            lineHeight: '1.6',
            background: '#90bde4',
            color: '#071f37',
            border: '0.5px solid #8fb8d4',
            borderBottomLeftRadius: '2px',
          }}>
            {displayedText}
            {/* Blinking cursor — thin vertical bar that fades in and out */}
            <span style={{
              display: 'inline-block',
              width: '2px',
              height: '14px',
              background: '#071f37',
              marginLeft: '2px',
              verticalAlign: 'text-bottom',
              animation: 'blink 0.8s step-end infinite',
            }} />
          </div>
        )}

        {/* Invisible div at the bottom — scrollIntoView target */}
        <div ref={chatEndRef} />
      </div>

      {/* ---- INPUT AREA ---- */}
      {/* Text input and send button at the bottom of the Journal */}
      <div style={{ marginTop: 'auto', paddingTop: '4px' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          // Enter sends the message, Shift+Enter adds a new line
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="what is inspiring you right now?"
          rows={3}
          autoComplete="off"
          data-form-type="other" // Prevents browser autofill
          style={{
            width: '100%',
            fontSize: '14px',
            padding: '8px 10px',
            borderRadius: '2px',
            border: '1px solid #999',
            background: 'transparent', // Notebook paper shows through
            outline: 'none',
            resize: 'none', // Prevent manual resizing
            fontFamily: "'Atkinson Hyperlegible', sans-serif",
            lineHeight: '1.5',
            boxSizing: 'border-box',
          }}
        />

        {/* Send button — right-aligned below the text input */}
        <div style={{
          display: 'flex',
          justifyContent: 'flex-end',
          marginTop: '4px',
        }}>
          <button onClick={handleSend} disabled={isLoading || isTyping} style={{
            fontSize: '14px',
            padding: '5px 20px',
            borderRadius: '20px',
            background: isLoading || isTyping ? '#ddd' : '#ffc9f6',
            border: 'none',
            color: '#000000',
            cursor: isLoading || isTyping ? 'not-allowed' : 'pointer',
            fontWeight: 500,
            fontFamily: "'Atkinson Hyperlegible', sans-serif",
          }}>
            {isLoading ? 'thinking...' : 'send'}
          </button>
        </div>
      </div>

      {/* ---- CSS ANIMATIONS ---- */}
      {/* Defined here because React inline styles don't support @keyframes */}
      <style>{`
        @keyframes bounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-4px); }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export default Journal;