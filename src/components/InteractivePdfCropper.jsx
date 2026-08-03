import React, { useState, useEffect, useRef, useCallback } from 'react';

export default function InteractivePdfCropper({ pdfFile, onProcess, processing, statusText, progressBarWidth }) {
  // PDF state
  const [pdfDoc, setPdfDoc] = useState(null);
  const [numPages, setNumPages] = useState(0);
  const [activePageNum, setActivePageNum] = useState(1);
  const [pageDetails, setPageDetails] = useState([]); // [{ pageNum, unscaledW, unscaledH }]
  const [pageThumbnails, setPageThumbnails] = useState([]);
  const [loadingPdf, setLoadingPdf] = useState(true);

  // Zoom & View state
  const [zoom, setZoom] = useState(1.0);
  const [fitMode, setFitMode] = useState('width'); // 'custom', 'width', 'height'
  const [showThumbnails, setShowThumbnails] = useState(true);

  // Crop Box State (Normalized 0.0 to 1.0)
  const [cropBox, setCropBox] = useState({ left: 0.05, top: 0.05, right: 0.95, bottom: 0.95 });

  // Aspect Ratio Presets
  const [aspectRatioPreset, setAspectRatioPreset] = useState('free'); // 'free', 'original', '1:1', '4:3', '16:9', '3:2', 'a4'

  // Multi-Page Scope Selection
  const [pageScope, setPageScope] = useState('all'); // 'all', 'current', 'odd', 'even', 'custom'
  const [customRange, setCustomRange] = useState('');

  // Undo / Redo history stack
  const [history, setHistory] = useState([{ left: 0.05, top: 0.05, right: 0.95, bottom: 0.95 }]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // Drag State
  const [dragState, setDragState] = useState(null);
  const [dragPageNum, setDragPageNum] = useState(null);

  // DOM Refs
  const scrollContainerRef = useRef(null);
  const pageRefs = useRef({});
  const thumbnailRefs = useRef({});

  // 1. Load PDF File using PDF.js
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

        // Extract page dimensions for all pages
        const details = [];
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 1.0 });
          details.push({ pageNum: i, unscaledW: viewport.width, unscaledH: viewport.height });
        }
        setPageDetails(details);
        setActivePageNum(1);
        setLoadingPdf(false);
        generateThumbnails(pdf);
      } catch (err) {
        console.error('Error loading PDF for cropper workspace:', err);
        setLoadingPdf(false);
      }
    };
    fileReader.readAsArrayBuffer(pdfFile);
  }, [pdfFile]);

  // 2. Generate Page Thumbnails
  const generateThumbnails = async (pdf) => {
    const thumbs = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      try {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.18 });
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

  // 3. Calculate Fit Mode Scale
  const getPageScale = useCallback((unscaledW, unscaledH) => {
    if (fitMode === 'width' && scrollContainerRef.current) {
      const containerW = scrollContainerRef.current.clientWidth - 120; // 120px safety margin
      return Math.max(0.3, Math.min(2.5, containerW / unscaledW));
    } else if (fitMode === 'height') {
      return 0.8;
    }
    return zoom;
  }, [fitMode, zoom]);

  // 4. Undo / Redo Management
  const updateCropBoxWithHistory = (newBox) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(newBox);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setCropBox(newBox);
  };

  const handleUndo = () => {
    if (historyIndex > 0) {
      const prev = history[historyIndex - 1];
      setHistoryIndex(historyIndex - 1);
      setCropBox(prev);
    }
  };

  const handleRedo = () => {
    if (historyIndex < history.length - 1) {
      const next = history[historyIndex + 1];
      setHistoryIndex(historyIndex + 1);
      setCropBox(next);
    }
  };

  const resetFullPage = () => {
    setAspectRatioPreset('free');
    updateCropBoxWithHistory({ left: 0, top: 0, right: 1.0, bottom: 1.0 });
  };

  // 5. Apply Aspect Ratio Presets
  const applyAspectRatioPreset = (preset) => {
    setAspectRatioPreset(preset);
    if (preset === 'free') return;

    let ratio = 1.0;
    const firstPage = pageDetails[0] || { unscaledW: 612, unscaledH: 792 };
    const pageRatio = firstPage.unscaledW / firstPage.unscaledH;

    if (preset === 'original') ratio = pageRatio;
    else if (preset === '1:1') ratio = 1.0;
    else if (preset === '4:3') ratio = 4 / 3;
    else if (preset === '16:9') ratio = 16 / 9;
    else if (preset === '3:2') ratio = 3 / 2;
    else if (preset === 'a4') ratio = 210 / 297;

    let newW = 0.8;
    let newH = 0.8;

    if (ratio > pageRatio) {
      newW = 0.8;
      newH = (0.8 * pageRatio) / ratio;
    } else {
      newH = 0.8;
      newW = (0.8 * ratio) / pageRatio;
    }

    const newLeft = (1.0 - newW) / 2;
    const newTop = (1.0 - newH) / 2;

    updateCropBoxWithHistory({
      left: Math.max(0, Math.min(1.0 - newW, newLeft)),
      top: Math.max(0, Math.min(1.0 - newH, newTop)),
      right: Math.min(1.0, newLeft + newW),
      bottom: Math.min(1.0, newTop + newH)
    });
  };

  // 6. Hit Test & Drag Handling
  const getHitTestType = (mouseX, mouseY, renderW, renderH) => {
    const cropX = cropBox.left * renderW;
    const cropY = cropBox.top * renderH;
    const cropW = (cropBox.right - cropBox.left) * renderW;
    const cropH = (cropBox.bottom - cropBox.top) * renderH;

    const threshold = 16;
    const isNear = (x1, y1) => Math.hypot(mouseX - x1, mouseY - y1) <= threshold;

    // Corners
    if (isNear(cropX, cropY)) return 'nw';
    if (isNear(cropX + cropW, cropY)) return 'ne';
    if (isNear(cropX + cropW, cropY + cropH)) return 'se';
    if (isNear(cropX, cropY + cropH)) return 'sw';

    // Edges
    if (Math.abs(mouseY - cropY) <= threshold && mouseX >= cropX && mouseX <= cropX + cropW) return 'n';
    if (Math.abs(mouseX - (cropX + cropW)) <= threshold && mouseY >= cropY && mouseY <= cropY + cropH) return 'e';
    if (Math.abs(mouseY - (cropY + cropH)) <= threshold && mouseX >= cropX && mouseX <= cropX + cropW) return 's';
    if (Math.abs(mouseX - cropX) <= threshold && mouseY >= cropY && mouseY <= cropY + cropH) return 'w';

    // Inside move area
    if (mouseX >= cropX && mouseX <= cropX + cropW && mouseY >= cropY && mouseY <= cropY + cropH) {
      return 'move';
    }
    return null;
  };

  const getCursorForHit = (hitType) => {
    switch (hitType) {
      case 'nw': return 'nwse-resize';
      case 'ne': return 'nesw-resize';
      case 'se': return 'nwse-resize';
      case 'sw': return 'nesw-resize';
      case 'n': return 'ns-resize';
      case 's': return 'ns-resize';
      case 'e': return 'ew-resize';
      case 'w': return 'ew-resize';
      case 'move': return 'move';
      default: return 'default';
    }
  };

  const handlePointerDown = (e, pageNum, renderW, renderH, overlayCanvas) => {
    if (!overlayCanvas) return;
    const rect = overlayCanvas.getBoundingClientRect();
    const mouseX = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const mouseY = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

    const hitType = getHitTestType(mouseX, mouseY, renderW, renderH);
    if (hitType) {
      setActivePageNum(pageNum);
      setDragPageNum(pageNum);
      setDragState({
        type: hitType,
        startX: mouseX,
        startY: mouseY,
        initialBox: { ...cropBox },
        renderW,
        renderH
      });
    }
  };

  const handlePointerMove = (e, overlayCanvas, renderW, renderH) => {
    if (!overlayCanvas) return;
    const rect = overlayCanvas.getBoundingClientRect();
    const mouseX = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const mouseY = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

    if (!dragState) {
      const hitType = getHitTestType(mouseX, mouseY, renderW, renderH);
      overlayCanvas.style.cursor = getCursorForHit(hitType);
      return;
    }

    const dxNorm = (mouseX - dragState.startX) / dragState.renderW;
    const dyNorm = (mouseY - dragState.startY) / dragState.renderH;

    const init = dragState.initialBox;
    let next = { ...init };

    const minW = 0.03;
    const minH = 0.03;

    switch (dragState.type) {
      case 'move': {
        const boxW = init.right - init.left;
        const boxH = init.bottom - init.top;
        let newL = init.left + dxNorm;
        let newT = init.top + dyNorm;

        // Boundary snapping within 1%
        if (newL < 0.01) newL = 0;
        if (newT < 0.01) newT = 0;
        if (newL + boxW > 0.99) newL = 1.0 - boxW;
        if (newT + boxH > 0.99) newT = 1.0 - boxH;

        newL = Math.max(0, Math.min(1.0 - boxW, newL));
        newT = Math.max(0, Math.min(1.0 - boxH, newT));

        next = { left: newL, top: newT, right: newL + boxW, bottom: newT + boxH };
        break;
      }
      case 'nw': {
        let newL = Math.min(init.right - minW, Math.max(0, init.left + dxNorm));
        let newT = Math.min(init.bottom - minH, Math.max(0, init.top + dyNorm));
        if (newL < 0.01) newL = 0;
        if (newT < 0.01) newT = 0;
        next = { ...next, left: newL, top: newT };
        break;
      }
      case 'ne': {
        let newR = Math.max(init.left + minW, Math.min(1.0, init.right + dxNorm));
        let newT = Math.min(init.bottom - minH, Math.max(0, init.top + dyNorm));
        if (newR > 0.99) newR = 1.0;
        if (newT < 0.01) newT = 0;
        next = { ...next, right: newR, top: newT };
        break;
      }
      case 'se': {
        let newR = Math.max(init.left + minW, Math.min(1.0, init.right + dxNorm));
        let newB = Math.max(init.top + minH, Math.min(1.0, init.bottom + dyNorm));
        if (newR > 0.99) newR = 1.0;
        if (newB > 0.99) newB = 1.0;
        next = { ...next, right: newR, bottom: newB };
        break;
      }
      case 'sw': {
        let newL = Math.min(init.right - minW, Math.max(0, init.left + dxNorm));
        let newB = Math.max(init.top + minH, Math.min(1.0, init.bottom + dyNorm));
        if (newL < 0.01) newL = 0;
        if (newB > 0.99) newB = 1.0;
        next = { ...next, left: newL, bottom: newB };
        break;
      }
      case 'n': {
        let newT = Math.min(init.bottom - minH, Math.max(0, init.top + dyNorm));
        if (newT < 0.01) newT = 0;
        next = { ...next, top: newT };
        break;
      }
      case 's': {
        let newB = Math.max(init.top + minH, Math.min(1.0, init.bottom + dyNorm));
        if (newB > 0.99) newB = 1.0;
        next = { ...next, bottom: newB };
        break;
      }
      case 'e': {
        let newR = Math.max(init.left + minW, Math.min(1.0, init.right + dxNorm));
        if (newR > 0.99) newR = 1.0;
        next = { ...next, right: newR };
        break;
      }
      case 'w': {
        let newL = Math.min(init.right - minW, Math.max(0, init.left + dxNorm));
        if (newL < 0.01) newL = 0;
        next = { ...next, left: newL };
        break;
      }
      default:
        break;
    }

    setCropBox(next);
  };

  const handlePointerUp = () => {
    if (dragState) {
      updateCropBoxWithHistory(cropBox);
      setDragState(null);
      setDragPageNum(null);
    }
  };

  // 7. Keyboard Navigation & Shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') {
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'PageDown' || e.key === 'ArrowDown') {
        if (activePageNum < numPages) scrollToPage(activePageNum + 1);
      } else if (e.key === 'PageUp' || e.key === 'ArrowUp') {
        if (activePageNum > 1) scrollToPage(activePageNum - 1);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [historyIndex, history, cropBox, activePageNum, numPages]);

  // 8. Thumbnail Click & Smooth Page Scroll
  const scrollToPage = (pageNum) => {
    setActivePageNum(pageNum);
    const element = pageRefs.current[pageNum];
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // 9. Execute Crop Action
  const handleExecuteCrop = () => {
    onProcess({
      left: cropBox.left,
      top: cropBox.top,
      right: cropBox.right,
      bottom: cropBox.bottom,
      scope: pageScope,
      custom_range: customRange,
      current_page: activePageNum
    });
  };

  if (loadingPdf) {
    return (
      <div className="text-center py-5 bg-white rounded-4 shadow-sm border">
        <div className="spinner-border text-primary mb-3" style={{ width: '3rem', height: '3rem' }} role="status"></div>
        <h5 className="fw-bold text-dark">Initializing Dedicated Multi-Page Crop Workspace...</h5>
        <p className="text-muted small mb-0">Preparing high-resolution vector page cards & thumbnails</p>
      </div>
    );
  }

  // Active page information for live dimensions badge
  const activeDetail = pageDetails[activePageNum - 1] || { unscaledW: 612, unscaledH: 792 };
  const cropWPt = Math.round((cropBox.right - cropBox.left) * activeDetail.unscaledW);
  const cropHPt = Math.round((cropBox.bottom - cropBox.top) * activeDetail.unscaledH);
  const cropWPct = Math.round((cropBox.right - cropBox.left) * 100);
  const cropHPct = Math.round((cropBox.bottom - cropBox.top) * 100);

  return (
    <div className="pdf-crop-workspace-root border rounded-4 shadow-sm bg-white overflow-hidden d-flex flex-column" style={{ minHeight: '850px' }}>
      
      {/* ========================================================================= */}
      {/* 1. TOP DEDICATED WORKSPACE TOOLBAR */}
      {/* ========================================================================= */}
      <div className="bg-dark text-white p-3 d-flex flex-wrap align-items-center justify-content-between gap-3 border-bottom shadow-sm">
        
        {/* Left: Sidebar Toggle, Page Counter & Jump */}
        <div className="d-flex align-items-center gap-2">
          <button
            type="button"
            className={`btn btn-sm ${showThumbnails ? 'btn-primary' : 'btn-outline-light'} me-1`}
            onClick={() => setShowThumbnails(!showThumbnails)}
            title="Toggle Page Thumbnails Sidebar"
          >
            <i className="bi bi-layout-sidebar-inset me-1"></i> Thumbnails
          </button>

          <div className="vr bg-secondary opacity-50 mx-1"></div>

          <button
            type="button"
            className="btn btn-outline-light btn-sm rounded-circle p-1 px-2"
            disabled={activePageNum <= 1}
            onClick={() => scrollToPage(Math.max(1, activePageNum - 1))}
            title="Previous Page (PgUp)"
          >
            <i className="bi bi-chevron-left"></i>
          </button>

          <span className="fw-semibold small px-2 font-monospace">
            Page {activePageNum} of {numPages}
          </span>

          <button
            type="button"
            className="btn btn-outline-light btn-sm rounded-circle p-1 px-2"
            disabled={activePageNum >= numPages}
            onClick={() => scrollToPage(Math.min(numPages, activePageNum + 1))}
            title="Next Page (PgDn)"
          >
            <i className="bi bi-chevron-right"></i>
          </button>

          <div className="vr bg-secondary opacity-50 mx-1"></div>

          {/* Zoom Level Controls */}
          <div className="d-flex align-items-center gap-1">
            <button
              type="button"
              className="btn btn-outline-light btn-sm"
              onClick={() => { setFitMode('custom'); setZoom(prev => Math.max(0.3, prev - 0.15)); }}
              title="Zoom Out (-)"
            >
              <i className="bi bi-zoom-out"></i>
            </button>

            <span className="small fw-bold px-2 text-info font-monospace" style={{ minWidth: '55px', textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </span>

            <button
              type="button"
              className="btn btn-outline-light btn-sm"
              onClick={() => { setFitMode('custom'); setZoom(prev => Math.min(3.0, prev + 0.15)); }}
              title="Zoom In (+)"
            >
              <i className="bi bi-zoom-in"></i>
            </button>

            <button
              type="button"
              className={`btn btn-sm ${fitMode === 'width' ? 'btn-info text-dark fw-bold' : 'btn-outline-light'}`}
              onClick={() => setFitMode(fitMode === 'width' ? 'custom' : 'width')}
              title="Fit to Container Width"
            >
              Fit Width
            </button>
          </div>
        </div>

        {/* Center: Ratio Presets, Full Page Reset & History */}
        <div className="d-flex align-items-center gap-2">
          <div className="dropdown">
            <button
              className="btn btn-outline-info btn-sm dropdown-toggle fw-semibold text-uppercase"
              type="button"
              data-bs-toggle="dropdown"
            >
              <i className="bi bi-aspect-ratio me-1"></i> Ratio: {aspectRatioPreset}
            </button>
            <ul className="dropdown-menu shadow">
              {[
                { id: 'free', label: 'Freeform Drag' },
                { id: 'original', label: 'Original Page Ratio' },
                { id: '1:1', label: '1:1 Square' },
                { id: '4:3', label: '4:3 Standard' },
                { id: '16:9', label: '16:9 Widescreen' },
                { id: '3:2', label: '3:2 Photo' },
                { id: 'a4', label: 'A4 Document Ratio' },
              ].map(p => (
                <li key={p.id}>
                  <button
                    className={`dropdown-item ${aspectRatioPreset === p.id ? 'active fw-bold' : ''}`}
                    type="button"
                    onClick={() => applyAspectRatioPreset(p.id)}
                  >
                    {p.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <button
            type="button"
            className="btn btn-outline-light btn-sm"
            onClick={resetFullPage}
            title="Reset to Full Page Margins"
          >
            <i className="bi bi-arrow-counterclockwise me-1"></i> Full Page
          </button>

          <button
            type="button"
            className="btn btn-outline-light btn-sm"
            disabled={historyIndex <= 0}
            onClick={handleUndo}
            title="Undo (Ctrl+Z)"
          >
            <i className="bi bi-arrow-return-left"></i>
          </button>

          <button
            type="button"
            className="btn btn-outline-light btn-sm"
            disabled={historyIndex >= history.length - 1}
            onClick={handleRedo}
            title="Redo (Ctrl+Y)"
          >
            <i className="bi bi-arrow-return-right"></i>
          </button>
        </div>

        {/* Right: Live Dimensions Badge */}
        <div className="d-flex align-items-center gap-2">
          <div className="bg-secondary bg-opacity-50 text-warning px-3 py-1 rounded font-monospace small border border-secondary shadow-sm">
            <i className="bi bi-bounding-box-circles me-1"></i>
            {cropWPt} × {cropHPt} pt ({cropWPct}% × {cropHPct}%)
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. MAIN WORKSPACE CONTENT AREA (SIDEBAR + MULTI-PAGE SCROLL VIEWER) */}
      {/* ========================================================================= */}
      <div className="d-flex flex-grow-1 position-relative overflow-hidden" style={{ height: '700px' }}>
        
        {/* Left Page Thumbnail Sidebar */}
        {showThumbnails && (
          <div className="pdf-thumbnail-sidebar border-end bg-light p-3 overflow-auto flex-shrink-0 shadow-inner" style={{ width: '220px' }}>
            <h6 className="fw-bold text-secondary small text-uppercase mb-3 d-flex align-items-center justify-content-between">
              <span>Page Navigator</span>
              <span className="badge bg-primary rounded-pill">{numPages}</span>
            </h6>
            <div className="d-flex flex-column gap-3">
              {pageThumbnails.map((thumb) => (
                <div
                  key={thumb.pageNum}
                  ref={el => thumbnailRefs.current[thumb.pageNum] = el}
                  className={`thumbnail-card rounded p-2 text-center cursor-pointer border transition-all ${activePageNum === thumb.pageNum ? 'border-primary bg-white shadow me-1 border-2' : 'border-secondary-subtle bg-white opacity-75 hover-opacity-100'}`}
                  onClick={() => scrollToPage(thumb.pageNum)}
                  style={{ cursor: 'pointer' }}
                >
                  {thumb.dataUrl ? (
                    <img src={thumb.dataUrl} alt={`Page ${thumb.pageNum}`} className="img-fluid rounded border mb-1 shadow-sm" style={{ maxHeight: '140px' }} />
                  ) : (
                    <div className="py-4 bg-light text-muted small rounded mb-1">Page {thumb.pageNum}</div>
                  )}
                  <div className={`small font-monospace fw-bold ${activePageNum === thumb.pageNum ? 'text-primary' : 'text-secondary'}`}>
                    Page {thumb.pageNum}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Center Multi-Page Continuous Scroll View */}
        <div
          ref={scrollContainerRef}
          className="pdf-multi-page-scroll-viewer flex-grow-1 bg-secondary bg-opacity-10 overflow-auto position-relative"
          style={{ padding: '40px 20px 60px 20px' }} // Generous padding fixes top & bottom page margin clipping completely!
        >
          <div className="d-flex flex-column align-items-center gap-5">
            {pageDetails.map((detail) => (
              <RenderPageCard
                key={detail.pageNum}
                pdfDoc={pdfDoc}
                pageNum={detail.pageNum}
                unscaledW={detail.unscaledW}
                unscaledH={detail.unscaledH}
                scale={getPageScale(detail.unscaledW, detail.unscaledH)}
                cropBox={cropBox}
                isActive={activePageNum === detail.pageNum}
                pageRef={el => pageRefs.current[detail.pageNum] = el}
                onPointerDown={(e, renderW, renderH, canvas) => handlePointerDown(e, detail.pageNum, renderW, renderH, canvas)}
                onPointerMove={(e, canvas, renderW, renderH) => handlePointerMove(e, canvas, renderW, renderH)}
                onPointerUp={handlePointerUp}
              />
            ))}
          </div>
        </div>

        {/* Right Scope & Process Control Panel */}
        <div className="pdf-crop-control-panel border-start bg-white p-4 flex-shrink-0 d-flex flex-column justify-content-between shadow-sm" style={{ width: '320px' }}>
          <div>
            <h6 className="fw-bold text-dark mb-3 border-bottom pb-2 d-flex align-items-center">
              <i className="bi bi-crop text-primary me-2 fs-5"></i> Crop Scope & Execution
            </h6>

            {/* Scope Selection */}
            <div className="mb-4">
              <label className="form-label fw-semibold text-secondary small text-uppercase">Apply Crop Selection To</label>
              <select
                className="form-select form-select-lg mb-2 shadow-sm border-primary-subtle"
                value={pageScope}
                onChange={(e) => setPageScope(e.target.value)}
              >
                <option value="all">All Pages in PDF ({numPages} pages)</option>
                <option value="current">Current Page Only (Page {activePageNum})</option>
                <option value="odd">Odd Pages Only (1, 3, 5...)</option>
                <option value="even">Even Pages Only (2, 4, 6...)</option>
                <option value="custom">Custom Page Range</option>
              </select>

              {pageScope === 'custom' && (
                <input
                  type="text"
                  className="form-control form-control-lg mt-2"
                  placeholder="e.g. 1-3, 5, 7-10"
                  value={customRange}
                  onChange={(e) => setCustomRange(e.target.value)}
                />
              )}
            </div>

            {/* Live Active Page Card Meta */}
            <div className="card bg-light border-0 rounded-3 p-3 mb-4">
              <div className="d-flex align-items-center justify-content-between mb-2">
                <span className="small text-secondary fw-semibold text-uppercase">Active Focus Page</span>
                <span className="badge bg-primary">Page {activePageNum}</span>
              </div>
              <div className="small font-monospace text-dark">
                Dimensions: {activeDetail.unscaledW} × {activeDetail.unscaledH} pt
              </div>
              <div className="small font-monospace text-dark">
                Aspect Ratio: {(activeDetail.unscaledW / activeDetail.unscaledH).toFixed(2)}
              </div>
            </div>

            {/* Enterprise Guidance Box */}
            <div className="alert alert-info border-0 rounded-3 p-3 mb-4 small shadow-sm">
              <div className="d-flex align-items-center mb-1 text-info-emphasis fw-bold">
                <i className="bi bi-shield-check me-2 fs-5"></i> Vector PDF Crop Guarantee
              </div>
              <p className="mb-0 text-muted" style={{ fontSize: '0.85rem' }}>
                Modifies PDF boundaries directly. Text searchability, vector graphics, bookmarks, and font clarity remain 100% intact.
              </p>
            </div>
          </div>

          {/* Action / Progress Button */}
          <div>
            {processing ? (
              <div className="text-center py-2">
                <div className="progress mb-2 rounded-pill shadow-sm" style={{ height: '10px' }}>
                  <div className="progress-bar progress-bar-striped progress-bar-animated bg-primary" style={{ width: `${progressBarWidth}%` }}></div>
                </div>
                <small className="text-muted fw-semibold">{statusText || 'Cropping PDF pages...'}</small>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-lg w-100 py-3 shadow-lg fw-bold text-uppercase d-flex align-items-center justify-content-center gap-2 rounded-3"
                onClick={handleExecuteCrop}
              >
                <i className="bi bi-crop fs-4"></i> CROP PDF NOW
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

// =============================================================================
// SUB-COMPONENT: Individual Page Renderer with Lazy Canvas & Crop Box Overlay
// =============================================================================
function RenderPageCard({ pdfDoc, pageNum, unscaledW, unscaledH, scale, cropBox, isActive, pageRef, onPointerDown, onPointerMove, onPointerUp }) {
  const [isVisible, setIsVisible] = useState(false);
  const cardRef = useRef(null);
  const canvasRef = useRef(null);
  const overlayCanvasRef = useRef(null);
  const renderTaskRef = useRef(null);

  const renderW = Math.round(unscaledW * scale);
  const renderH = Math.round(unscaledH * scale);

  // IntersectionObserver Lazy Rendering Strategy
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsVisible(entry.isIntersecting);
      },
      { rootMargin: '350px' }
    );

    if (cardRef.current) {
      observer.observe(cardRef.current);
    }

    return () => {
      if (cardRef.current) observer.unobserve(cardRef.current);
    };
  }, []);

  // PDF Page Canvas Renderer
  useEffect(() => {
    if (!isVisible || !pdfDoc || !canvasRef.current) return;

    let isCancelled = false;

    const render = async () => {
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (isCancelled) return;

        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        if (renderTaskRef.current) {
          renderTaskRef.current.cancel();
        }

        const renderContext = { canvasContext: ctx, viewport };
        const task = page.render(renderContext);
        renderTaskRef.current = task;

        await task.promise;
      } catch (err) {
        if (err.name !== 'RenderingCancelledException') {
          console.error(`Page ${pageNum} render error:`, err);
        }
      }
    };

    render();

    return () => {
      isCancelled = true;
      if (renderTaskRef.current) renderTaskRef.current.cancel();
    };
  }, [isVisible, pdfDoc, pageNum, scale]);

  // Crop Box Overlay Canvas Renderer
  useEffect(() => {
    if (!overlayCanvasRef.current || renderW === 0) return;

    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');

    canvas.width = renderW;
    canvas.height = renderH;

    ctx.clearRect(0, 0, renderW, renderH);

    // Compute pixel coordinates
    const cropX = cropBox.left * renderW;
    const cropY = cropBox.top * renderH;
    const cropW = (cropBox.right - cropBox.left) * renderW;
    const cropH = (cropBox.bottom - cropBox.top) * renderH;

    // 1. Semi-transparent dark overlay outside crop area
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, renderW, cropY); // Top
    ctx.fillRect(0, cropY + cropH, renderW, renderH - (cropY + cropH)); // Bottom
    ctx.fillRect(0, cropY, cropX, cropH); // Left
    ctx.fillRect(cropX + cropW, cropY, renderW - (cropX + cropW), cropH); // Right

    // 2. Vibrant Blue Border
    ctx.strokeStyle = '#2563eb';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.strokeRect(cropX, cropY, cropW, cropH);

    // 3. Grid Lines (Rule of Thirds)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(cropX, cropY + cropH / 3);
    ctx.lineTo(cropX + cropW, cropY + cropH / 3);
    ctx.moveTo(cropX, cropY + (2 * cropH) / 3);
    ctx.lineTo(cropX + cropW, cropY + (2 * cropH) / 3);
    ctx.moveTo(cropX + cropW / 3, cropY);
    ctx.lineTo(cropX + cropW / 3, cropY + cropH);
    ctx.moveTo(cropX + (2 * cropW) / 3, cropY);
    ctx.lineTo(cropX + (2 * cropW) / 3, cropY + cropH);
    ctx.stroke();

    // 4. Handles (Corners & Edges)
    ctx.setLineDash([]);
    const handleSize = 12;
    const edgeLen = 22;

    const drawSquareHandle = (cx, cy) => {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.rect(cx - handleSize / 2, cy - handleSize / 2, handleSize, handleSize);
      ctx.fill();
      ctx.stroke();
    };

    const drawEdgeHandle = (cx, cy, isVertical) => {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#2563eb';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      if (isVertical) {
        ctx.rect(cx - 3.5, cy - edgeLen / 2, 7, edgeLen);
      } else {
        ctx.rect(cx - edgeLen / 2, cy - 3.5, edgeLen, 7);
      }
      ctx.fill();
      ctx.stroke();
    };

    // Corners
    drawSquareHandle(cropX, cropY); // NW
    drawSquareHandle(cropX + cropW, cropY); // NE
    drawSquareHandle(cropX + cropW, cropY + cropH); // SE
    drawSquareHandle(cropX, cropY + cropH); // SW

    // Edges
    drawEdgeHandle(cropX + cropW / 2, cropY, false); // N
    drawEdgeHandle(cropX + cropW, cropY + cropH / 2, true); // E
    drawEdgeHandle(cropX + cropW / 2, cropY + cropH, false); // S
    drawEdgeHandle(cropX, cropY + cropH / 2, true); // W

  }, [cropBox, renderW, renderH]);

  return (
    <div
      ref={el => {
        cardRef.current = el;
        if (pageRef) pageRef(el);
      }}
      className={`pdf-page-card bg-white rounded-3 shadow-lg p-3 transition-all position-relative border ${isActive ? 'border-primary border-2 shadow-xl' : 'border-secondary-subtle'}`}
      style={{ width: renderW + 32 }}
    >
      {/* Page Card Header Badge */}
      <div className="d-flex align-items-center justify-content-between mb-2 px-1">
        <span className={`badge ${isActive ? 'bg-primary' : 'bg-secondary'} font-monospace`}>
          Page {pageNum}
        </span>
        <span className="small text-muted font-monospace">
          {unscaledW} × {unscaledH} pt
        </span>
      </div>

      {/* Page Canvas Container with Full Top Margin Padding */}
      <div className="position-relative border rounded bg-white shadow-sm overflow-hidden" style={{ width: renderW, height: renderH }}>
        {isVisible ? (
          <>
            <canvas ref={canvasRef} style={{ width: renderW, height: renderH, display: 'block' }} />
            <canvas
              ref={overlayCanvasRef}
              className="position-absolute top-0 start-0 touch-action-none"
              style={{ width: renderW, height: renderH }}
              onMouseDown={(e) => onPointerDown(e, renderW, renderH, overlayCanvasRef.current)}
              onMouseMove={(e) => onPointerMove(e, overlayCanvasRef.current, renderW, renderH)}
              onMouseUp={onPointerUp}
              onMouseLeave={onPointerUp}
              onTouchStart={(e) => onPointerDown(e, renderW, renderH, overlayCanvasRef.current)}
              onTouchMove={(e) => onPointerMove(e, overlayCanvasRef.current, renderW, renderH)}
              onTouchEnd={onPointerUp}
            />
          </>
        ) : (
          <div className="d-flex align-items-center justify-content-center h-100 bg-light text-muted font-monospace small">
            Loading Page {pageNum}...
          </div>
        )}
      </div>
    </div>
  );
}
