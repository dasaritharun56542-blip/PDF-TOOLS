import React, { useState, useEffect, useRef } from 'react';

export default function InteractivePdfRedactor({ pdfFile, onProcess, processing, statusText, progressBarWidth }) {
  // PDF state
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(1.0);
  const [fitMode, setFitMode] = useState('custom'); // 'custom', 'width', 'page'
  const [pageThumbnails, setPageThumbnails] = useState([]);
  const [loadingPdf, setLoadingPdf] = useState(true);

  // Redaction boxes state: Array of { id, pageIndex, x, y, width, height, fillColor, overlayText }
  // (x, y, width, height are normalized [0..1] relative to page dimensions)
  const [redactionBoxes, setRedactionBoxes] = useState([]);
  const [selectedBoxId, setSelectedBoxId] = useState(null);

  // Undo / Redo history stack
  const [history, setHistory] = useState([[]]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Redaction styling options
  const [fillColor, setFillColor] = useState('#000000');
  const [overlayText, setOverlayText] = useState('REDACTED');
  const [textColor, setTextColor] = useState('#FFFFFF');

  // Tools & UI Mode
  const [activeTab, setActiveTab] = useState('style'); // 'thumbnails', 'search', 'style'
  const [isDrawing, setIsDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState(null);
  const [currentDrawBox, setCurrentDrawBox] = useState(null);
  const [dragState, setDragState] = useState(null); // { type: 'move'|'nw'|'ne'|'se'|'sw'|'n'|'s'|'e'|'w', startX, startY, initialBox }

  // Search Engine state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchPreset, setSearchPreset] = useState('custom');
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);

  // Refs
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const containerRef = useRef(null);
  const renderTaskRef = useRef(null);

  // Load PDF File using PDF.js
  useEffect(() => {
    if (!pdfFile) return;
    setLoadingPdf(true);

    const fileReader = new FileReader();
    fileReader.onload = async function () {
      const typedarray = new Uint8Array(this.result);
      try {
        const pdf = await window.pdfjsLib.getDocument({ data: typedarray }).promise;
        setPdfDoc(pdf);
        setNumPages(pdf.numPages);
        setCurrentPage(1);
        setLoadingPdf(false);

        // Generate Thumbnails
        generateThumbnails(pdf);
      } catch (err) {
        console.error('Error loading PDF:', err);
        setLoadingPdf(false);
      }
    };
    fileReader.readAsArrayBuffer(pdfFile);
  }, [pdfFile]);

  // Generate Page Thumbnails
  const generateThumbnails = async (pdf) => {
    const thumbs = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.2 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: context, viewport }).promise;
        thumbs.push({ pageNum: i, dataUrl: canvas.toDataURL() });
      } catch (e) {
        thumbs.push({ pageNum: i, dataUrl: '' });
      }
    }
    setPageThumbnails(thumbs);
  };

  // Push state to Undo/Redo history
  const updateBoxesWithHistory = (newBoxes) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newBoxes);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setRedactionBoxes(newBoxes);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setRedactionBoxes(history[newIndex]);
      setSelectedBoxId(null);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setRedactionBoxes(history[newIndex]);
      setSelectedBoxId(null);
    }
  };

  // Render Current PDF Page
  useEffect(() => {
    if (!pdfDoc || !canvasRef.current) return;

    let isMounted = true;

    const renderPage = async () => {
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }

      try {
        const page = await pdfDoc.getPage(currentPage);
        let currentScale = zoom;

        if (fitMode === 'width' && containerRef.current) {
          const containerWidth = containerRef.current.clientWidth - 40;
          const unscaledViewport = page.getViewport({ scale: 1.0 });
          currentScale = containerWidth / unscaledViewport.width;
        } else if (fitMode === 'page' && containerRef.current) {
          const containerHeight = containerRef.current.clientHeight - 60;
          const unscaledViewport = page.getViewport({ scale: 1.0 });
          currentScale = containerHeight / unscaledViewport.height;
        }

        const viewport = page.getViewport({ scale: currentScale });
        const canvas = canvasRef.current;
        const context = canvas.getContext('2d');

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (overlayCanvasRef.current) {
          overlayCanvasRef.current.width = viewport.width;
          overlayCanvasRef.current.height = viewport.height;
        }

        const renderContext = {
          canvasContext: context,
          viewport: viewport,
        };

        const task = page.render(renderContext);
        renderTaskRef.current = task;
        await task.promise;
      } catch (err) {
        if (err?.name !== 'RenderingCancelledException') {
          console.error('Error rendering page:', err);
        }
      }
    };

    renderPage();

    return () => {
      isMounted = false;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
      }
    };
  }, [pdfDoc, currentPage, zoom, fitMode]);

  // Redraw Overlay Canvas (Redaction Boxes)
  useEffect(() => {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;
    const ctx = overlayCanvas.getContext('2d');
    const width = overlayCanvas.width;
    const height = overlayCanvas.height;

    ctx.clearRect(0, 0, width, height);

    // Filter boxes for current page
    const pageBoxes = redactionBoxes.filter((b) => b.pageIndex === currentPage - 1);

    pageBoxes.forEach((box) => {
      const bx = box.x * width;
      const by = box.y * height;
      const bw = box.width * width;
      const bh = box.height * height;

      const isSelected = box.id === selectedBoxId;

      // Draw Fill Box
      ctx.fillStyle = box.fillColor || fillColor;
      ctx.fillRect(bx, by, bw, bh);

      // Draw Overlay Text
      const textToDraw = box.overlayText !== undefined ? box.overlayText : overlayText;
      if (textToDraw) {
        ctx.fillStyle = textColor;
        ctx.font = `bold ${Math.max(10, Math.min(bh * 0.5, 18))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(textToDraw, bx + bw / 2, by + bh / 2);
      }

      // Selection Highlight Border & Handles
      if (isSelected) {
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(bx, by, bw, bh);
        ctx.setLineDash([]);

        // Draw Resize Handles (8 direction handles)
        const handles = [
          { x: bx, y: by },
          { x: bx + bw / 2, y: by },
          { x: bx + bw, y: by },
          { x: bx + bw, y: by + bh / 2 },
          { x: bx + bw, y: by + bh },
          { x: bx + bw / 2, y: by + bh },
          { x: bx, y: by + bh },
          { x: bx, y: by + bh / 2 },
        ];

        handles.forEach((h) => {
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#2563eb';
          ctx.lineWidth = 2;
          ctx.fillRect(h.x - 4, h.y - 4, 8, 8);
          ctx.strokeRect(h.x - 4, h.y - 4, 8, 8);
        });
      }
    });

    // Draw active rectangle being drawn
    if (currentDrawBox) {
      const dbx = currentDrawBox.x * width;
      const dby = currentDrawBox.y * height;
      const dbw = currentDrawBox.width * width;
      const dbh = currentDrawBox.height * height;

      ctx.fillStyle = fillColor;
      ctx.globalAlpha = 0.7;
      ctx.fillRect(dbx, dby, dbw, dbh);
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.strokeRect(dbx, dby, dbw, dbh);
    }
  }, [redactionBoxes, currentPage, selectedBoxId, currentDrawBox, fillColor, overlayText, textColor]);

  // Mouse Handlers for Overlay Canvas (Draw / Select / Move / Resize)
  const handleOverlayMouseDown = (e) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const width = overlay.width;
    const height = overlay.height;

    // Check if clicked on a handle or existing box
    const pageBoxes = redactionBoxes.filter((b) => b.pageIndex === currentPage - 1);
    const selectedBox = pageBoxes.find((b) => b.id === selectedBoxId);

    if (selectedBox) {
      const bx = selectedBox.x * width;
      const by = selectedBox.y * height;
      const bw = selectedBox.width * width;
      const bh = selectedBox.height * height;

      // Handle hit test radius
      const r = 8;
      const handleHits = [
        { type: 'nw', x: bx, y: by },
        { type: 'ne', x: bx + bw, y: by },
        { type: 'se', x: bx + bw, y: by + bh },
        { type: 'sw', x: bx, y: by + bh },
        { type: 'n', x: bx + bw / 2, y: by },
        { type: 'e', x: bx + bw, y: by + bh / 2 },
        { type: 's', x: bx + bw / 2, y: by + bh },
        { type: 'w', x: bx, y: by + bh / 2 },
      ];

      const hit = handleHits.find((h) => Math.hypot(mouseX - h.x, mouseY - h.y) <= r);
      if (hit) {
        setDragState({
          type: hit.type,
          startX: mouseX,
          startY: mouseY,
          initialBox: { ...selectedBox },
        });
        return;
      }
    }

    // Check if clicked inside any box to select/move
    const clickedBox = [...pageBoxes].reverse().find((b) => {
      const bx = b.x * width;
      const by = b.y * height;
      const bw = b.width * width;
      const bh = b.height * height;
      return mouseX >= bx && mouseX <= bx + bw && mouseY >= by && mouseY <= by + bh;
    });

    if (clickedBox) {
      setSelectedBoxId(clickedBox.id);
      setDragState({
        type: 'move',
        startX: mouseX,
        startY: mouseY,
        initialBox: { ...clickedBox },
      });
      return;
    }

    // Clicked empty space -> Deselect & start Drawing new Box
    setSelectedBoxId(null);
    setIsDrawing(true);
    const normX = mouseX / width;
    const normY = mouseY / height;
    setDrawStart({ x: normX, y: normY });
    setCurrentDrawBox({ x: normX, y: normY, width: 0, height: 0 });
  };

  const handleOverlayMouseMove = (e) => {
    const overlay = overlayCanvasRef.current;
    if (!overlay) return;
    const rect = overlay.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const width = overlay.width;
    const height = overlay.height;

    // Handle Active Drawing
    if (isDrawing && drawStart) {
      const currentX = mouseX / width;
      const currentY = mouseY / height;

      const normX = Math.min(drawStart.x, currentX);
      const normY = Math.min(drawStart.y, currentY);
      const normW = Math.abs(currentX - drawStart.x);
      const normH = Math.abs(currentY - drawStart.y);

      setCurrentDrawBox({
        x: Math.max(0, normX),
        y: Math.max(0, normY),
        width: Math.min(1 - normX, normW),
        height: Math.min(1 - normY, normH),
      });
      return;
    }

    // Handle Active Moving / Resizing
    if (dragState && selectedBoxId) {
      const dx = (mouseX - dragState.startX) / width;
      const dy = (mouseY - dragState.startY) / height;

      const updatedBoxes = redactionBoxes.map((b) => {
        if (b.id !== selectedBoxId) return b;

        let { x, y, width: w, height: h } = dragState.initialBox;

        switch (dragState.type) {
          case 'move':
            x = Math.max(0, Math.min(1 - w, x + dx));
            y = Math.max(0, Math.min(1 - h, y + dy));
            break;
          case 'se':
            w = Math.max(0.02, w + dx);
            h = Math.max(0.02, h + dy);
            break;
          case 'sw':
            const oldW_sw = w;
            w = Math.max(0.02, w - dx);
            x = x + (oldW_sw - w);
            h = Math.max(0.02, h + dy);
            break;
          case 'ne':
            w = Math.max(0.02, w + dx);
            const oldH_ne = h;
            h = Math.max(0.02, h - dy);
            y = y + (oldH_ne - h);
            break;
          case 'nw':
            const oldW_nw = w;
            w = Math.max(0.02, w - dx);
            x = x + (oldW_nw - w);
            const oldH_nw = h;
            h = Math.max(0.02, h - dy);
            y = y + (oldH_nw - h);
            break;
          case 'e':
            w = Math.max(0.02, w + dx);
            break;
          case 's':
            h = Math.max(0.02, h + dy);
            break;
          case 'w':
            const oldW_w = w;
            w = Math.max(0.02, w - dx);
            x = x + (oldW_w - w);
            break;
          case 'n':
            const oldH_n = h;
            h = Math.max(0.02, h - dy);
            y = y + (oldH_n - h);
            break;
          default:
            break;
        }

        return { ...b, x, y, width: w, height: h };
      });

      setRedactionBoxes(updatedBoxes);
    }
  };

  const handleOverlayMouseUp = () => {
    if (isDrawing && currentDrawBox) {
      if (currentDrawBox.width > 0.01 && currentDrawBox.height > 0.01) {
        const newBox = {
          id: 'box_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
          pageIndex: currentPage - 1,
          ...currentDrawBox,
          fillColor: fillColor,
          overlayText: overlayText,
        };
        const newBoxes = [...redactionBoxes, newBox];
        updateBoxesWithHistory(newBoxes);
        setSelectedBoxId(newBox.id);
      }
      setIsDrawing(false);
      setDrawStart(null);
      setCurrentDrawBox(null);
    }

    if (dragState) {
      updateBoxesWithHistory(redactionBoxes);
      setDragState(null);
    }
  };

  // Keyboard Shortcuts (Delete box, Undo, Redo)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedBoxId && document.activeElement.tagName !== 'INPUT') {
          const newBoxes = redactionBoxes.filter((b) => b.id !== selectedBoxId);
          updateBoxesWithHistory(newBoxes);
          setSelectedBoxId(null);
        }
      } else if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.ctrlKey && e.key === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBoxId, redactionBoxes, historyIndex, history]);

  // Execute Full Text Search across Document
  const handlePerformSearch = async () => {
    if (!pdfDoc || !searchQuery.trim()) return;
    setIsSearching(true);
    const results = [];

    const REGEX_PRESETS = {
      email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi,
      phone: /\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/gi,
      credit_card: /\b(?:\d[ -]*?){13,16}\b/gi,
      ssn: /\b\d{3}-\d{2}-\d{4}\b/gi,
    };

    const targetRegex = searchPreset !== 'custom' && REGEX_PRESETS[searchPreset]
      ? REGEX_PRESETS[searchPreset]
      : new RegExp(searchQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');

    for (let i = 1; i <= pdfDoc.numPages; i++) {
      try {
        const page = await pdfDoc.getPage(i);
        const textContent = await page.getTextContent();
        const viewport = page.getViewport({ scale: 1.0 });

        textContent.items.forEach((item) => {
          const text = item.str;
          let match;
          while ((match = targetRegex.exec(text)) !== null) {
            // Normalized Bounding Box calculation
            const tx = item.transform[4] / viewport.width;
            const ty = 1 - item.transform[5] / viewport.height - (item.height / viewport.height);
            const tw = (item.width || 50) / viewport.width;
            const th = (item.height || 12) / viewport.height;

            results.push({
              pageIndex: i - 1,
              pageNum: i,
              matchedText: match[0],
              x: Math.max(0, tx),
              y: Math.max(0, ty),
              width: Math.min(1, tw),
              height: Math.min(1, th),
            });
          }
        });
      } catch (e) {
        console.error('Search error on page', i, e);
      }
    }

    setSearchResults(results);
    setIsSearching(false);
  };

  // Convert Search Results to Redaction Boxes
  const handleRedactSearchResults = (itemsToRedact) => {
    const newBoxes = [...redactionBoxes];
    itemsToRedact.forEach((res) => {
      newBoxes.push({
        id: 'box_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        pageIndex: res.pageIndex,
        x: res.x,
        y: res.y,
        width: res.width,
        height: res.height,
        fillColor: fillColor,
        overlayText: overlayText,
      });
    });
    updateBoxesWithHistory(newBoxes);
    alert(`Added ${itemsToRedact.length} redaction box(es) to document.`);
  };

  // Build Payload & Call Backend Process
  const handleApplyRedactions = () => {
    if (!overlayCanvasRef.current) return;

    // Group boxes by page and format payload for PyMuPDF
    const payloadBoxes = redactionBoxes.map((b) => ({
      page_index: b.pageIndex,
      x: b.x * 800,
      y: b.y * 1100,
      width: b.width * 800,
      height: b.height * 1100,
      canvas_width: 800,
      canvas_height: 1100,
    }));

    onProcess({
      redaction_boxes: JSON.stringify(payloadBoxes),
      text: searchQuery,
      overlay_text: overlayText,
      fill_color: fillColor,
      text_color: textColor,
    });
  };

  return (
    <div className="card border-0 shadow-lg rounded-4 overflow-hidden mb-4">
      {/* Top Header Toolbar */}
      <div className="card-header bg-dark text-white p-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
        <div className="d-flex align-items-center gap-2">
          <span className="badge bg-danger fs-6 px-3 py-2 me-2">
            <i className="bi bi-eye-slash me-1"></i> Interactive Redactor
          </span>

          <button
            className={`btn btn-sm ${activeTab === 'thumbnails' ? 'btn-primary' : 'btn-outline-light'}`}
            onClick={() => setActiveTab(activeTab === 'thumbnails' ? 'style' : 'thumbnails')}
            title="Toggle Thumbnails"
          >
            <i className="bi bi-grid-3x3-gap-fill me-1"></i> Pages ({numPages})
          </button>

          <button
            className={`btn btn-sm ${activeTab === 'search' ? 'btn-primary' : 'btn-outline-light'}`}
            onClick={() => setActiveTab(activeTab === 'search' ? 'style' : 'search')}
            title="Search & Redact"
          >
            <i className="bi bi-search me-1"></i> Auto-Search
          </button>
        </div>

        {/* Page Navigation */}
        <div className="d-flex align-items-center gap-2 bg-secondary bg-opacity-25 px-3 py-1 rounded-pill">
          <button
            className="btn btn-link text-white p-0"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            <i className="bi bi-chevron-left"></i>
          </button>
          <span className="small fw-semibold">
            Page {currentPage} of {numPages}
          </span>
          <button
            className="btn btn-link text-white p-0"
            disabled={currentPage >= numPages}
            onClick={() => setCurrentPage((p) => Math.min(numPages, p + 1))}
          >
            <i className="bi bi-chevron-right"></i>
          </button>
        </div>

        {/* Zoom & Fit Controls */}
        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-sm btn-outline-light"
            onClick={() => { setFitMode('custom'); setZoom((z) => Math.max(0.5, z - 0.15)); }}
          >
            <i className="bi bi-zoom-out"></i>
          </button>
          <span className="small fw-bold opacity-75">{Math.round(zoom * 100)}%</span>
          <button
            className="btn btn-sm btn-outline-light"
            onClick={() => { setFitMode('custom'); setZoom((z) => Math.min(2.5, z + 0.15)); }}
          >
            <i className="bi bi-zoom-in"></i>
          </button>
          <button
            className={`btn btn-sm ${fitMode === 'width' ? 'btn-primary' : 'btn-outline-light'}`}
            onClick={() => setFitMode(fitMode === 'width' ? 'custom' : 'width')}
          >
            Fit Width
          </button>

          {/* Undo / Redo */}
          <button
            className="btn btn-sm btn-outline-light"
            disabled={historyIndex <= 0}
            onClick={handleUndo}
            title="Undo (Ctrl+Z)"
          >
            <i className="bi bi-arrow-counterclockwise"></i>
          </button>
          <button
            className="btn btn-sm btn-outline-light"
            disabled={historyIndex >= history.length - 1}
            onClick={handleRedo}
            title="Redo (Ctrl+Y)"
          >
            <i className="bi bi-arrow-clockwise"></i>
          </button>
        </div>
      </div>

      {/* Main Content Stage */}
      <div className="row g-0">
        {/* Left Sidebar Panel */}
        <div className="col-md-3 bg-light border-end p-3 d-flex flex-column" style={{ maxHeight: '680px', overflowY: 'auto' }}>
          {activeTab === 'thumbnails' && (
            <div>
              <h6 className="fw-bold mb-3 text-uppercase text-muted small">Page Overview</h6>
              <div className="row g-2">
                {pageThumbnails.map((t) => (
                  <div className="col-6" key={t.pageNum}>
                    <div
                      className={`card p-1 cursor-pointer transition-all border-2 ${
                        currentPage === t.pageNum ? 'border-primary shadow-sm' : 'border-light'
                      }`}
                      onClick={() => setCurrentPage(t.pageNum)}
                    >
                      <img src={t.dataUrl} alt={`Page ${t.pageNum}`} className="img-fluid rounded" />
                      <div className="text-center small mt-1 fw-bold">Page {t.pageNum}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'search' && (
            <div>
              <h6 className="fw-bold mb-3 text-uppercase text-muted small"><i className="bi bi-search me-1"></i>Search & Redact</h6>
              <div className="mb-3">
                <label className="form-label small fw-semibold">Preset Patterns</label>
                <select
                  className="form-select form-select-sm"
                  value={searchPreset}
                  onChange={(e) => setSearchPreset(e.target.value)}
                >
                  <option value="custom">Custom Keyword / Phrase</option>
                  <option value="email">Email Addresses</option>
                  <option value="phone">Phone Numbers</option>
                  <option value="credit_card">Credit Card Numbers</option>
                  <option value="ssn">Social Security Numbers (SSN)</option>
                </select>
              </div>

              {searchPreset === 'custom' && (
                <div className="mb-3">
                  <label className="form-label small fw-semibold">Search Text</label>
                  <input
                    type="text"
                    className="form-control form-control-sm"
                    placeholder="Enter word or phrase..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
              )}

              <button
                className="btn btn-primary btn-sm w-100 mb-3"
                onClick={handlePerformSearch}
                disabled={isSearching}
              >
                {isSearching ? 'Searching Document...' : 'Find Matches'}
              </button>

              {searchResults.length > 0 && (
                <div>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="small fw-bold text-success">Found {searchResults.length} match(es)</span>
                    <button
                      className="btn btn-sm btn-danger py-0 px-2 fs-6"
                      onClick={() => handleRedactSearchResults(searchResults)}
                    >
                      Redact All
                    </button>
                  </div>
                  <ul className="list-group list-group-flush small rounded border">
                    {searchResults.map((r, idx) => (
                      <li key={idx} className="list-group-item d-flex justify-content-between align-items-center">
                        <div>
                          <span className="badge bg-secondary me-1">P.{r.pageNum}</span>
                          <code>{r.matchedText}</code>
                        </div>
                        <button
                          className="btn btn-link text-danger p-0 ms-2"
                          onClick={() => handleRedactSearchResults([r])}
                          title="Redact this match"
                        >
                          <i className="bi bi-slash-circle"></i>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {activeTab === 'style' && (
            <div>
              <h6 className="fw-bold mb-3 text-uppercase text-muted small"><i className="bi bi-palette me-1"></i>Redaction Style & Text</h6>
              
              <div className="mb-3">
                <label className="form-label small fw-semibold">Fill Color</label>
                <div className="d-flex gap-2">
                  {[
                    { id: '#000000', label: 'Black' },
                    { id: '#ffffff', label: 'White' },
                    { id: '#808080', label: 'Gray' },
                    { id: '#d9534f', label: 'Red' },
                  ].map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={`btn btn-sm flex-fill border ${fillColor === c.id ? 'btn-primary' : 'btn-light'}`}
                      style={{ backgroundColor: c.id, color: c.id === '#ffffff' ? '#000' : '#fff' }}
                      onClick={() => setFillColor(c.id)}
                    >
                      {c.label}
                    </button>
                  ))}
                  <input
                    type="color"
                    className="form-control form-control-color"
                    value={fillColor}
                    onChange={(e) => setFillColor(e.target.value)}
                  />
                </div>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-semibold">Overlay Text Label</label>
                <input
                  type="text"
                  className="form-control form-control-sm mb-2"
                  placeholder="e.g. REDACTED, CONFIDENTIAL"
                  value={overlayText}
                  onChange={(e) => setOverlayText(e.target.value)}
                />
                <div className="d-flex gap-1 flex-wrap">
                  {['REDACTED', 'CONFIDENTIAL', 'RESTRICTED', 'PRIVATE'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="btn btn-outline-secondary btn-sm py-0 px-2 text-uppercase"
                      style={{ fontSize: '0.65rem' }}
                      onClick={() => setOverlayText(preset)}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {selectedBoxId && (
                <div className="p-3 bg-white rounded border border-warning shadow-sm mt-4">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="small fw-bold text-dark">Selected Box</span>
                    <button
                      className="btn btn-sm btn-outline-danger py-0 px-2"
                      onClick={() => {
                        const newBoxes = redactionBoxes.filter((b) => b.id !== selectedBoxId);
                        updateBoxesWithHistory(newBoxes);
                        setSelectedBoxId(null);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                  <div className="small text-muted mb-2">Drag handles to resize or drag box to move anywhere on page.</div>
                </div>
              )}

              <hr className="my-4" />

              <div className="d-flex justify-content-between align-items-center">
                <span className="small fw-bold">Total Redactions:</span>
                <span className="badge bg-danger fs-6">{redactionBoxes.length}</span>
              </div>
            </div>
          )}
        </div>

        {/* Center Canvas Workspace */}
        <div
          ref={containerRef}
          className="col-md-9 bg-secondary bg-opacity-10 p-4 d-flex justify-content-center align-items-center position-relative overflow-auto"
          style={{ minHeight: '680px', maxHeight: '720px' }}
        >
          {loadingPdf ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status"></div>
              <p className="mt-2 text-muted fw-semibold">Loading PDF Document...</p>
            </div>
          ) : (
            <div className="position-relative shadow-lg border rounded bg-white">
              {/* Render PDF Canvas */}
              <canvas ref={canvasRef} className="d-block" />

              {/* Interactive Redaction Canvas Overlay */}
              <canvas
                ref={overlayCanvasRef}
                className="position-absolute top-0 start-0 cursor-crosshair"
                onMouseDown={handleOverlayMouseDown}
                onMouseMove={handleOverlayMouseMove}
                onMouseUp={handleOverlayMouseUp}
              />
            </div>
          )}
        </div>
      </div>

      {/* Bottom Processing Footer */}
      <div className="card-footer bg-white p-3 border-top d-flex justify-content-between align-items-center">
        <div>
          <span className="small text-muted">
            <i className="bi bi-shield-check me-1 text-success"></i>
            Redactions permanently purge text & image streams from PDF output.
          </span>
        </div>

        <div>
          <button
            className="btn btn-danger btn-lg px-5 fw-bold rounded-pill shadow-sm"
            onClick={handleApplyRedactions}
            disabled={processing}
          >
            {processing ? (
              <>
                <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                Applying Redactions...
              </>
            ) : (
              <>
                <i className="bi bi-shield-lock-fill me-2"></i> Apply Redactions & Download
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
