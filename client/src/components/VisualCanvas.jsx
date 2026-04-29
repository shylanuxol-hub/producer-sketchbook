// VISUALCANVAS.JSX — Image Collage System

// Provides a collage workspace where producers can drop in images as visual inspiration
// The AI sees these images through the Anthropic vision API and responds with direction based on what it sees
// Features:
// - Drag-and-drop images onto the canvas
// - Click to browse for images
// - Images render with shadow and tape strip effect
// - Click to select an image (shows dashed blue border)
// - Scale selected images up/down
// - Rotate selected images
// - Delete individual images or clear all
// - Drag images to reposition them
// Design philosophy: The user controls the visual space
// The AI can see what's there but doesn't add to it
// This maintains the human-in-the-loop principle

import { useRef, useState, useEffect } from 'react';

function VisualCanvas({ onImageDropped }) {
  const containerRef = useRef(null); // Container div for sizing
  const canvasRef = useRef(null); // Canvas element for rendering
  const [elements, setElements] = useState([]); // Array of image objects on the canvas

  const [isDraggingOver, setIsDraggingOver] = useState(false); // True when a file is dragged over
  const [dragTarget, setDragTarget] = useState(null); // Index of the image being dragged
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 }); // Offset from cursor to image center
  const [selectedIndex, setSelectedIndex] = useState(null); // Index of the selected image
  const fileInputRef = useRef(null); // Hidden file input for click-to-browse

  // RENDER ALL IMAGES

  // Draws every image on the canvas with shadows, tape strips, and selection borders
  // Called whenever elements or selection changes
  function renderAll(els, selected) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const container = containerRef.current;
    if (!container) return;

    // Retina setup
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';

    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    els.forEach((el, i) => {
      const img = el.imgElement;
      if (!img || !img.complete) return;

      ctx.save();
      // Position and rotate around the image's center point
      ctx.translate(el.x, el.y);
      ctx.rotate(el.rotation || 0);

      // Drop shadow for depth — makes images look like they're sitting on the notebook page
      ctx.shadowColor = 'rgba(0,0,0,0.15)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetX = 2;
      ctx.shadowOffsetY = 2;

      // Draw the image centered on its position
      ctx.drawImage(img, -el.width / 2, -el.height / 2, el.width, el.height);

      // Tape strip effect on top — a semi-transparent beige rectangle that looks like scotch tape holding the image to the page
      ctx.shadowColor = 'transparent';
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#d4c5a9';
      const tapeW = Math.min(el.width * 0.5, 50);
      ctx.fillRect(-tapeW / 2, -el.height / 2 - 6, tapeW, 14);

      // Selection border — dashed blue rectangle when image is selected
      if (i === selected) {
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#5B9BD5';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(-el.width / 2 - 4, -el.height / 2 - 10, el.width + 8, el.height + 14);
        ctx.setLineDash([]);
      }

      ctx.restore();
    });
  }

  // Re-render whenever elements or selection changes
  useEffect(() => {
    renderAll(elements, selectedIndex);
  }, [elements, selectedIndex]);

  // IMAGE LOADING

  // Reads the file as a base64 data URL, creates an Image element, scales it to fit nicely on the canvas, and adds it to the elements array
  // Also sends the base64 data to the parent for AI vision analysis
  function loadImage(file, x, y) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      const base64 = ev.target.result;
      const img = new Image();
      img.onload = () => {
        // Scale image to max 120px on its longest side
        const maxSize = 120;
        let w = img.width;
        let h = img.height;
        if (w > h) {
          if (w > maxSize) { h = h * (maxSize / w); w = maxSize; }
        } else {
          if (h > maxSize) { w = w * (maxSize / h); h = maxSize; }
        }

        const newEl = {
          type: 'image',
          imgElement: img, // The loaded Image object for canvas drawing
          x: x, // Center X position on canvas
          y: y, // Center Y position on canvas
          width: w, // Display width
          height: h, // Display height
          rotation: (Math.random() - 0.5) * 0.15, // Slight random tilt for natural look
          id: Date.now(),
        };

        setElements(prev => [...prev, newEl]);
        setSelectedIndex(null); // Deselect any previously selected image

        // Send image data to parent → Journal → AI vision
        if (onImageDropped) {
          onImageDropped(file.name, base64, file.type);
        }
      };
      img.src = base64;
    };
    reader.readAsDataURL(file);
  }

  // DRAG AND DROP HANDLERS

  function handleDrop(e) {
    e.preventDefault();
    setIsDraggingOver(false);

    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    // Place image where it was dropped
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    loadImage(file, e.clientX - rect.left, e.clientY - rect.top);
  }

  function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;

    // Place image near center with slight random offset
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    loadImage(
      file,
      rect.width / 2 + (Math.random() - 0.5) * 100,
      rect.height / 2 + (Math.random() - 0.5) * 100
    );
    e.target.value = ''; // Reset so same file can be selected again
  }

  // IMAGE INTERACTION (select, drag, reposition)

  // Check if a point (mx, my) is inside any image
  // Returns the index of the topmost image hit, or null
  // Iterates in reverse so top-most images are checked first
  function hitTest(mx, my) {
    for (let i = elements.length - 1; i >= 0; i--) {
      const el = elements[i];
      if (Math.abs(mx - el.x) < el.width / 2 && Math.abs(my - el.y) < el.height / 2) {
        return i;
      }
    }
    return null;
  }

  function handleMouseDown(e) {
    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    const hit = hitTest(mx, my);
    if (hit !== null) {
      // Select and start dragging the clicked image  
      setSelectedIndex(hit);
      setDragTarget(hit);
      setDragOffset({ x: mx - elements[hit].x, y: my - elements[hit].y });
    } else {
      // Clicked empty space — deselect
      setSelectedIndex(null);
    }
  }

  function handleMouseMove(e) {
    if (dragTarget === null) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // Update the dragged image's position
    setElements(prev => {
      const updated = [...prev];
      updated[dragTarget] = {
        ...updated[dragTarget],
        x: mx - dragOffset.x,
        y: my - dragOffset.y,
      };
      return updated;
    });
  }

  function handleMouseUp() {
    setDragTarget(null);
  }

  // IMAGE EDITING CONTROLS

  // Scale the selected image by a factor (1.15 = bigger, 0.85 = smaller)
  function scaleSelected(factor) {
    if (selectedIndex === null) return;
    setElements(prev => {
      const updated = [...prev];
      const el = updated[selectedIndex];
      updated[selectedIndex] = {
        ...el,
        width: Math.max(30, Math.min(500, el.width * factor)),
        height: Math.max(30, Math.min(500, el.height * factor)),
      };
      return updated;
    });
  }

  // Rotate the selected image by degrees
  function rotateSelected(degrees) {
    if (selectedIndex === null) return;
    setElements(prev => {
      const updated = [...prev];
      updated[selectedIndex] = {
        ...updated[selectedIndex],
        rotation: (updated[selectedIndex].rotation || 0) + (degrees * Math.PI / 180),
      };
      return updated;
    });
  }

  // Remove the selected image from the canvas
  function deleteSelected() {
    if (selectedIndex === null) return;
    setElements(prev => prev.filter((_, i) => i !== selectedIndex));
    setSelectedIndex(null);
  }

  // Remove all images from the canvas
  function handleClear() {
    setElements([]);
    setSelectedIndex(null);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  // RENDER

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      fontFamily: "'Atkinson Hyperlegible', sans-serif",
    }}>
      {/* ---- CANVAS AREA ---- */}  
      <div
        ref={containerRef}
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDraggingOver(true); }}
        onDragLeave={() => setIsDraggingOver(false)}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: '4px',
          cursor: dragTarget !== null ? 'grabbing' : 'default',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
          }}
        />

        {/* ---- EMPTY STATE ---- */}
        {/* Shown when no images are on the canvas */}
        {/* Matches the AudioWorkspace drop zone style */}  
        {elements.length === 0 && (
          <div
            onClick={() => fileInputRef.current.click()}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              border: isDraggingOver ? '2px dashed #5B9BD5' : '2px dashed rgba(0,0,0,0.15)',
              borderRadius: '4px',
              cursor: 'pointer',
              background: isDraggingOver ? 'rgba(91,155,213,0.08)' : 'transparent',
              transition: 'all 0.2s ease',
              gap: '4px',
            }}
          >
            <p style={{
              fontSize: '14px',
              color: isDraggingOver ? '#5B9BD5' : '#888',
              marginBottom: '4px',
              transition: 'color 0.2s ease',
            }}>
              {isDraggingOver ? 'drop it here' : 'drop images here to collage'}
            </p>
            <p style={{ fontSize: '11px', color: '#aaa' }}>
              or click to browse
            </p>
          </div>
        )}
      </div>

      {/* ---- CONTROLS BAR ---- */}
      {/* Only visible when images are on the canvas */}
      {/* Shows: add image, scale/rotate/delete (when selected), clear all */}
      {elements.length > 0 && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: '6px',
          minHeight: '28px',
        }}>
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            {/* Add another image */}
            <button
              onClick={() => fileInputRef.current.click()}
              style={{
                fontSize: '11px',
                padding: '4px 14px',
                borderRadius: '20px',
                border: 'none',
                background: '#afcce5',
                color: '#071f37',
                cursor: 'pointer',
                fontFamily: "'Atkinson Hyperlegible', sans-serif",
              }}
            >
              add image
            </button>

            {/* Image editing controls — only shown when an image is selected */}  
            {selectedIndex !== null && (
              <>
                <button onClick={() => scaleSelected(1.15)} style={controlBtnStyle}>+</button>
                <button onClick={() => scaleSelected(0.85)} style={controlBtnStyle}>-</button>
                <button onClick={() => rotateSelected(-15)} style={controlBtnStyle}>↺</button>
                <button onClick={() => rotateSelected(15)} style={controlBtnStyle}>↻</button>
                <button onClick={deleteSelected} style={{
                  ...controlBtnStyle,
                  background: '#ffc9f6',
                }}>✕</button>
              </>
            )}
          </div>

          {/* Clear all images */}  
          <button
            onClick={handleClear}
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
            clear page
          </button>
        </div>
      )}

      {/* Hidden file input — always available */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
    </div>
  );
}

{/* Hidden file input — always available */}
const controlBtnStyle = {
  fontSize: '13px',
  width: '26px',
  height: '26px',
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

export default VisualCanvas;