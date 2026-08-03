import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth, getCookie } from '../context/AuthContext';

export default function EditPdf() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Core Editor States
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingProgress, setSavingProgress] = useState('');
  const [hasPdf, setHasPdf] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [zoom, setZoom] = useState(0.75);

  // Tools & Formatting States
  const [selectedTool, setSelectedTool] = useState('select'); 
  const [fontFamilyState, setFontFamilyState] = useState('Arial');
  const [fontSizeState, setFontSizeState] = useState('24');
  const [strokeColor, setStrokeColor] = useState('#000000');
  const [fillColor, setFillColor] = useState('#ffff00');
  const [noFill, setNoFill] = useState(true);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [opacityState, setOpacityState] = useState(1.0);

  // Formatting Active Button States
  const [isBoldActive, setIsBoldActive] = useState(false);
  const [isItalicActive, setIsItalicActive] = useState(false);
  const [isUnderlineActive, setIsUnderlineActive] = useState(false);
  const [isStrikethroughActive, setIsStrikethroughActive] = useState(false);
  const [dashStyleState, setDashStyleState] = useState('solid');
  const [stickyColor, setStickyColor] = useState('#ffeb3b');
  const [recentColors, setRecentColors] = useState(['#000000', '#ffffff', '#e11d48', '#2563eb', '#16a34a', '#ca8a04', '#9333ea', '#475569']);

  // Page Operations States
  const [pageOrder, setPageOrder] = useState([]); 
  const [pageRotations, setPageRotations] = useState({}); 

  // Inspector & History
  const [layersList, setLayersList] = useState([]);
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);

  // Drag & Drop Upload Highlight
  const [isDragOver, setIsDragOver] = useState(false);

  // Refs
  const fileInputRef = useRef(null);
  const pagesContainerRef = useRef(null);
  const sidebarRef = useRef(null);
  const canvasesRef = useRef([]);
  const pdfDocRef = useRef(null);
  const isStateSavingRef = useRef(false);
  const copiedObjectRef = useRef(null);

  // Color Input Refs
  const strokeColorInputRef = useRef(null);
  const fillColorInputRef = useRef(null);

  // Real-Time Drag-to-Draw Refs
  const isDrawingShapeRef = useRef(false);
  const shapeStartRef = useRef({ x: 0, y: 0 });
  const activeShapeObjRef = useRef(null);
  const selectedToolRef = useRef(selectedTool);

  useEffect(() => {
    selectedToolRef.current = selectedTool;
  }, [selectedTool]);

  // Security & PRO check
  useEffect(() => {
    const checkPro = async () => {
      if (!user) {
        navigate('/accounts/login');
        return;
      }
      try {
        const res = await axios.get('/api/auth-status/');
        if (!res.data.user?.is_pro) {
          alert('This is a PRO tool. Please upgrade your plan to use it.');
          navigate('/accounts/pricing');
        }
      } catch (err) {
        navigate('/accounts/login');
      }
    };
    checkPro();
  }, [user, navigate]);

  // Synchronize Fabric canvas modes on tool/color changes
  useEffect(() => {
    canvasesRef.current.forEach((c) => {
      if (!c) return;
      
      const isDrawingFreehand = selectedTool === 'pencil' || selectedTool === 'highlighter';
      c.isDrawingMode = isDrawingFreehand;
      c.selection = selectedTool === 'select' || selectedTool === 'edit_content';

      if (isDrawingFreehand && c.freeDrawingBrush) {
        const isHighlighter = selectedTool === 'highlighter';
        c.freeDrawingBrush.width = isHighlighter ? 24 : strokeWidth;
        c.freeDrawingBrush.color = isHighlighter ? 'rgba(255, 255, 0, 0.4)' : strokeColor;
        c.freeDrawingBrush.strokeLineCap = 'round';
        c.freeDrawingBrush.strokeLineJoin = 'round';
      }
    });
  }, [selectedTool, strokeColor, strokeWidth, currentPage]);

  // Undo / Redo system
  const saveState = () => {
    if (isStateSavingRef.current) return;
    const canvasStates = canvasesRef.current.map((c) => {
      if (!c) return null;
      return c.toJSON(['isOriginal', 'isWhiteout', 'isSticky', 'isHighlighter', 'hasBeenEdited', 'originalText']);
    });

    const fullState = {
      canvasStates,
      pageOrder: [...pageOrder],
      pageRotations: { ...pageRotations },
    };

    setUndoStack((prev) => {
      const next = [...prev, JSON.stringify(fullState)];
      if (next.length > 50) next.shift();
      return next;
    });
    setRedoStack([]);
  };

  const applyState = (jsonString) => {
    if (!jsonString) return;
    isStateSavingRef.current = true;
    const parsed = JSON.parse(jsonString);

    if (parsed.pageOrder) setPageOrder(parsed.pageOrder);
    if (parsed.pageRotations) setPageRotations(parsed.pageRotations);

    let p = Promise.resolve();
    if (parsed.canvasStates) {
      parsed.canvasStates.forEach((s, i) => {
        if (!canvasesRef.current[i] || !s) return;
        p = p.then(() => new Promise((resolve) => {
          canvasesRef.current[i].loadFromJSON(s, () => {
            canvasesRef.current[i].renderAll();
            resolve();
          });
        }));
      });
    }

    p.then(() => {
      isStateSavingRef.current = false;
      updateLayerList();
    });
  };

  const handleUndo = () => {
    if (undoStack.length <= 1) return;
    const nextUndo = [...undoStack];
    const current = nextUndo.pop();
    setRedoStack((prev) => [...prev, current]);
    setUndoStack(nextUndo);

    const targetState = nextUndo[nextUndo.length - 1];
    applyState(targetState);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    const nextRedo = [...redoStack];
    const pop = nextRedo.pop();
    setUndoStack((prev) => [...prev, pop]);
    setRedoStack(nextRedo);

    applyState(pop);
  };

  // Advanced Keyboard Shortcuts (Undo, Redo, Delete, Copy, Paste)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) {
        return;
      }

      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      } else if (e.ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        handleRedo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        const active = getActiveObject();
        if (active) {
          e.preventDefault();
          deleteActiveObject();
        }
      } else if (e.ctrlKey && e.key === 'c') {
        const active = getActiveObject();
        if (active) {
          e.preventDefault();
          copiedObjectRef.current = active.toJSON(['isOriginal', 'isSticky', 'isHighlighter']);
        }
      } else if (e.ctrlKey && e.key === 'v') {
        if (copiedObjectRef.current) {
          e.preventDefault();
          const canvas = canvasesRef.current[currentPage - 1];
          if (!canvas) return;

          window.fabric.util.enlivenObjects([copiedObjectRef.current], (objects) => {
            objects.forEach((obj) => {
              obj.set({
                left: (obj.left || 100) + 20,
                top: (obj.top || 100) + 20,
              });
              canvas.add(obj);
              canvas.setActiveObject(obj);
              canvas.renderAll();
            });
            saveState();
          });
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoStack, redoStack, currentPage]);

  // Drag & Drop PDF File Upload
  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
        loadPdfFile(file);
      } else {
        alert('Please select a valid PDF document.');
      }
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      loadPdfFile(selected);
    }
  };

  const loadPdfFile = async (selectedFile) => {
    setLoading(true);
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) }).promise;
      pdfDocRef.current = pdf;

      const initOrder = Array.from({ length: pdf.numPages }, (_, i) => i);
      const initRotations = {};
      initOrder.forEach((idx) => { initRotations[idx] = 0; });

      setPageOrder(initOrder);
      setPageRotations(initRotations);
      setTotalPages(pdf.numPages);
      setHasPdf(true);

      setTimeout(() => {
        renderEditorPages(pdf, initOrder, initRotations);
      }, 100);
    } catch (err) {
      console.error(err);
      alert('Error loading PDF file: ' + err.message);
      setLoading(false);
    }
  };

  // Synchronize object properties to editor toolbar controls upon selection
  const syncSelectionProperties = (obj) => {
    if (!obj) return;
    if (obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox') {
      if (obj.fontFamily) setFontFamilyState(obj.fontFamily);
      if (obj.fontSize) setFontSizeState(obj.fontSize.toString());
      if (obj.fill && typeof obj.fill === 'string') setStrokeColor(obj.fill);
      setIsBoldActive(obj.fontWeight === 'bold');
      setIsItalicActive(obj.fontStyle === 'italic');
      setIsUnderlineActive(!!obj.underline);
      setIsStrikethroughActive(!!obj.linethrough);
      if (obj.opacity !== undefined) setOpacityState(obj.opacity);
    } else if (obj.stroke) {
      if (typeof obj.stroke === 'string') setStrokeColor(obj.stroke);
      if (obj.strokeWidth) setStrokeWidth(obj.strokeWidth);
      if (obj.fill && typeof obj.fill === 'string' && obj.fill !== 'transparent') {
        setFillColor(obj.fill);
        setNoFill(false);
      } else if (obj.fill === 'transparent') {
        setNoFill(true);
      }
    }
  };

  // Attach Interactive Shape Drag-to-Draw & Single-Click Text Editing Events
  const attachInteractiveDrawingEvents = (fCanvas) => {
    fCanvas.on('selection:created', (e) => syncSelectionProperties(e.selected ? e.selected[0] : null));
    fCanvas.on('selection:updated', (e) => syncSelectionProperties(e.selected ? e.selected[0] : null));

    fCanvas.on('mouse:down', (e) => {
      // Single click on text immediately enters editing mode & activates whiteout mask
      if (e.target && (e.target.type === 'i-text' || e.target.type === 'textbox')) {
        if (e.target.bgRect) {
          e.target.bgRect.set('fill', 'white');
          fCanvas.renderAll();
        }
        e.target.enterEditing();
      }

      const tool = selectedToolRef.current;
      if (!tool.startsWith('shape_')) return;

      const pointer = fCanvas.getPointer(e.e);
      isDrawingShapeRef.current = true;
      shapeStartRef.current = { x: pointer.x, y: pointer.y };

      const fillVal = noFill ? 'transparent' : fillColor;
      let newShape = null;

      if (tool === 'shape_rect') {
        newShape = new window.fabric.Rect({
          left: pointer.x, top: pointer.y,
          width: 1, height: 1,
          fill: fillVal, stroke: strokeColor, strokeWidth: strokeWidth, rx: 4, ry: 4
        });
      } else if (tool === 'shape_circle') {
        newShape = new window.fabric.Circle({
          left: pointer.x, top: pointer.y,
          radius: 1,
          fill: fillVal, stroke: strokeColor, strokeWidth: strokeWidth
        });
      } else if (tool === 'shape_triangle') {
        newShape = new window.fabric.Triangle({
          left: pointer.x, top: pointer.y,
          width: 1, height: 1,
          fill: fillVal, stroke: strokeColor, strokeWidth: strokeWidth
        });
      } else if (tool === 'shape_diamond') {
        newShape = new window.fabric.Rect({
          left: pointer.x, top: pointer.y,
          width: 1, height: 1, angle: 45,
          fill: fillVal, stroke: strokeColor, strokeWidth: strokeWidth
        });
      } else if (tool === 'shape_line') {
        newShape = new window.fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: strokeColor, strokeWidth: strokeWidth || 3
        });
      } else if (tool === 'shape_arrow') {
        newShape = new window.fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: strokeColor, strokeWidth: strokeWidth || 3,
          isArrow: true
        });
      }

      if (newShape) {
        fCanvas.add(newShape);
        activeShapeObjRef.current = newShape;
      }
    });

    fCanvas.on('mouse:move', (e) => {
      if (!isDrawingShapeRef.current || !activeShapeObjRef.current) return;
      const pointer = fCanvas.getPointer(e.e);
      const start = shapeStartRef.current;
      const shape = activeShapeObjRef.current;
      const tool = selectedToolRef.current;

      if (tool === 'shape_line' || tool === 'shape_arrow') {
        shape.set({ x2: pointer.x, y2: pointer.y });
      } else if (tool === 'shape_circle') {
        const rad = Math.max(Math.abs(pointer.x - start.x), Math.abs(pointer.y - start.y)) / 2;
        shape.set({
          left: Math.min(pointer.x, start.x),
          top: Math.min(pointer.y, start.y),
          radius: rad
        });
      } else {
        const w = Math.abs(pointer.x - start.x);
        const h = Math.abs(pointer.y - start.y);
        shape.set({
          left: Math.min(pointer.x, start.x),
          top: Math.min(pointer.y, start.y),
          width: w,
          height: h
        });
      }
      fCanvas.renderAll();
    });

    fCanvas.on('mouse:up', () => {
      if (!isDrawingShapeRef.current) return;
      isDrawingShapeRef.current = false;
      const shape = activeShapeObjRef.current;
      
      if (shape) {
        if (shape.width < 5 && shape.height < 5 && !shape.x2) {
          shape.set({ width: 120, height: 80 });
        }
        shape.setCoords();
        fCanvas.setActiveObject(shape);
        fCanvas.renderAll();
      }

      setSelectedTool('select');
      saveState();
    });
  };

  // Render All PDF Pages with Fabric Overlays
  const renderEditorPages = async (pdf, currentOrder, currentRotations) => {
    setLoading(false);
    canvasesRef.current = [];

    if (sidebarRef.current) sidebarRef.current.innerHTML = '';
    if (pagesContainerRef.current) pagesContainerRef.current.innerHTML = '';

    const pagesToDraw = [];

    for (let displayIdx = 0; displayIdx < currentOrder.length; displayIdx++) {
      const origPageIndex = currentOrder[displayIdx];
      const pageNum = origPageIndex + 1;
      const rotationAngle = (currentRotations[origPageIndex] || 0) % 360;

      const page = await pdf.getPage(pageNum);
      const viewport = page.getViewport({ scale: 2.0, rotation: rotationAngle });

      // DOM Page Wrapper
      const wrapper = document.createElement('div');
      wrapper.className = 'page-wrapper shadow-lg rounded-3 position-relative mb-4 bg-white';
      wrapper.id = `page-wrapper-${displayIdx + 1}`;
      wrapper.style.width = `${viewport.width}px`;
      wrapper.style.height = `${viewport.height}px`;

      // Page Badge Header
      const pageBadge = document.createElement('div');
      pageBadge.className = 'position-absolute top-0 start-0 m-2 badge bg-dark opacity-75 rounded-pill px-3 py-2 text-white shadow';
      pageBadge.style.zIndex = '50';
      pageBadge.innerHTML = `<i class="bi bi-file-earmark-pdf me-1"></i> Page ${displayIdx + 1} of ${currentOrder.length}`;
      wrapper.appendChild(pageBadge);

      // Base PDF Canvas
      const pdfCanvas = document.createElement('canvas');
      pdfCanvas.height = viewport.height;
      pdfCanvas.width = viewport.width;
      pdfCanvas.style.display = 'block';

      // Overlay Canvas for Fabric
      const overlayCanvas = document.createElement('canvas');
      overlayCanvas.id = `fabric-canvas-${displayIdx + 1}`;

      wrapper.appendChild(pdfCanvas);
      wrapper.appendChild(overlayCanvas);
      pagesContainerRef.current.appendChild(wrapper);

      // Sidebar Thumbnail Item
      const thumbItem = document.createElement('div');
      thumbItem.className = `thumbnail-item rounded p-2 position-relative ${displayIdx + 1 === 1 ? 'active border-primary' : ''}`;
      thumbItem.id = `thumb-item-${displayIdx + 1}`;

      const thumbWrap = document.createElement('div');
      thumbWrap.className = 'thumb-wrap mb-1 overflow-hidden rounded bg-light border position-relative';
      thumbWrap.onclick = () => scrollToPage(displayIdx + 1);

      const thumbImg = document.createElement('img');
      thumbImg.id = `thumb-img-${displayIdx + 1}`;
      thumbImg.style.width = '100%';
      thumbImg.style.display = 'block';

      thumbWrap.appendChild(thumbImg);

      // Thumbnail Action Bar
      const thumbActions = document.createElement('div');
      thumbActions.className = 'thumb-actions d-flex justify-content-center gap-1 mt-1';
      thumbActions.innerHTML = `
        <button class="btn btn-sm btn-light border p-1 rounded-circle" title="Rotate CCW" onclick="window.__editPdfRotate(${displayIdx}, -90)"><i class="bi bi-arrow-counterclockwise" style="font-size: 11px;"></i></button>
        <button class="btn btn-sm btn-light border p-1 rounded-circle" title="Rotate CW" onclick="window.__editPdfRotate(${displayIdx}, 90)"><i class="bi bi-arrow-clockwise" style="font-size: 11px;"></i></button>
        <button class="btn btn-sm btn-light border p-1 rounded-circle text-primary" title="Duplicate Page" onclick="window.__editPdfDuplicate(${displayIdx})"><i class="bi bi-copy" style="font-size: 11px;"></i></button>
        <button class="btn btn-sm btn-light border p-1 rounded-circle text-danger" title="Delete Page" onclick="window.__editPdfDelete(${displayIdx})"><i class="bi bi-trash" style="font-size: 11px;"></i></button>
      `;

      const thumbLabel = document.createElement('div');
      thumbLabel.className = 'text-center small fw-bold text-muted mt-1';
      thumbLabel.innerText = `Page ${displayIdx + 1}`;

      thumbItem.appendChild(thumbWrap);
      thumbItem.appendChild(thumbActions);
      thumbItem.appendChild(thumbLabel);
      sidebarRef.current.appendChild(thumbItem);

      // Initialize Fabric Instance
      const fCanvas = new window.fabric.Canvas(`fabric-canvas-${displayIdx + 1}`, {
        width: viewport.width,
        height: viewport.height,
        selection: true,
      });

      fCanvas.on('selection:created', (e) => onObjectSelected(e.selected[0]));
      fCanvas.on('selection:updated', (e) => onObjectSelected(e.selected[0]));
      fCanvas.on('selection:cleared', onObjectCleared);

      fCanvas.on('object:added', () => !isStateSavingRef.current && saveState());
      fCanvas.on('object:modified', () => !isStateSavingRef.current && saveState());
      fCanvas.on('object:removed', () => !isStateSavingRef.current && saveState());

      // Attach Interactive Shape Drag-to-Draw
      attachInteractiveDrawingEvents(fCanvas);

      canvasesRef.current.push(fCanvas);

      pagesToDraw.push({
        displayIdx,
        page,
        viewport,
        pdfCanvas,
        thumbImg,
      });
    }

    // Attach global thumbnail action handlers
    window.__editPdfRotate = (idx, angle) => handleRotatePage(idx, angle);
    window.__editPdfDuplicate = (idx) => handleDuplicatePage(idx);
    window.__editPdfDelete = (idx) => handleDeletePage(idx);

    // Sequential PDF page & thumbnail renders
    for (const { page, viewport, pdfCanvas, thumbImg } of pagesToDraw) {
      await page.render({ canvasContext: pdfCanvas.getContext('2d'), viewport }).promise;

      const thumbCanvas = document.createElement('canvas');
      const thumbViewport = page.getViewport({ scale: 0.2 });
      thumbCanvas.height = thumbViewport.height;
      thumbCanvas.width = thumbViewport.width;

      await page.render({ canvasContext: thumbCanvas.getContext('2d'), viewport: thumbViewport }).promise;
      thumbImg.src = thumbCanvas.toDataURL('image/jpeg', 0.6);
    }

    autoFitZoom();

    // Auto-detect text for all pages so user can edit text immediately in real-time
    for (let pIdx = 1; pIdx <= currentOrder.length; pIdx++) {
      await detectOriginalText(pIdx);
    }

    // Initial state snapshot
    const initialCanvasStates = canvasesRef.current.map((c) => c.toJSON(['isOriginal', 'isWhiteout', 'isSticky', 'isHighlighter']));
    setUndoStack([JSON.stringify({ canvasStates: initialCanvasStates, pageOrder: currentOrder, pageRotations: currentRotations })]);
  };

  // Page Operations
  const handleRotatePage = (displayIndex, angle) => {
    const origIdx = pageOrder[displayIndex];
    if (origIdx === undefined) return;

    const nextRotations = { ...pageRotations };
    nextRotations[origIdx] = ((nextRotations[origIdx] || 0) + angle + 360) % 360;

    setPageRotations(nextRotations);
    renderEditorPages(pdfDocRef.current, pageOrder, nextRotations);
    saveState();
  };

  const handleDuplicatePage = (displayIndex) => {
    const origIdx = pageOrder[displayIndex];
    if (origIdx === undefined) return;

    const nextOrder = [...pageOrder];
    nextOrder.splice(displayIndex + 1, 0, origIdx);

    setPageOrder(nextOrder);
    setTotalPages(nextOrder.length);
    renderEditorPages(pdfDocRef.current, nextOrder, pageRotations);
    saveState();
  };

  const handleDeletePage = (displayIndex) => {
    if (pageOrder.length <= 1) {
      alert('Cannot delete the only page in the document.');
      return;
    }
    if (!window.confirm(`Are you sure you want to delete Page ${displayIndex + 1}?`)) return;

    const nextOrder = [...pageOrder];
    nextOrder.splice(displayIndex, 1);

    setPageOrder(nextOrder);
    setTotalPages(nextOrder.length);
    renderEditorPages(pdfDocRef.current, nextOrder, pageRotations);
    saveState();
  };

  // Scroll & Zoom
  const scrollToPage = (displayNum) => {
    const el = document.getElementById(`page-wrapper-${displayNum}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
      setCurrentPage(displayNum);
      document.querySelectorAll('.thumbnail-item').forEach((item, idx) => {
        item.classList.toggle('active', idx + 1 === displayNum);
      });
    }
  };

  const getVisiblePage = () => {
    const wrappers = document.querySelectorAll('.page-wrapper');
    for (let w of wrappers) {
      const r = w.getBoundingClientRect();
      if (r.top >= 0 && r.top < window.innerHeight) {
        return parseInt(w.id.replace('page-wrapper-', ''));
      }
    }
    return 1;
  };

  useEffect(() => {
    const handleScroll = () => {
      if (hasPdf) {
        const visible = getVisiblePage();
        setCurrentPage(visible);
      }
    };
    const container = document.getElementById('editor-canvas-container');
    container?.addEventListener('scroll', handleScroll);
    return () => container?.removeEventListener('scroll', handleScroll);
  }, [hasPdf]);

  // Object Selection & Layer Inspector Synchronization
  const onObjectSelected = (obj) => {
    if (!obj) return;
    const isText = obj.type === 'i-text' || obj.type === 'text' || obj.type === 'textbox';
    
    if (isText) {
      setFontFamilyState(obj.fontFamily || 'Arial');
      setFontSizeState((obj.fontSize || 24).toString());
      if (obj.fill) setStrokeColor(obj.fill);
      setIsBoldActive(obj.fontWeight === 'bold');
      setIsItalicActive(obj.fontStyle === 'italic');
      setIsUnderlineActive(!!obj.underline);
    } else {
      if (obj.stroke) setStrokeColor(obj.stroke);
      if (obj.fill) {
        if (obj.fill === 'transparent') {
          setNoFill(true);
        } else {
          setFillColor(obj.fill);
          setNoFill(false);
        }
      }
      setIsBoldActive(false);
      setIsItalicActive(false);
      setIsUnderlineActive(false);
    }
    if (obj.opacity !== undefined) {
      setOpacityState(obj.opacity);
    }
    updateLayerList();
  };

  const onObjectCleared = () => {
    setIsBoldActive(false);
    setIsItalicActive(false);
    setIsUnderlineActive(false);
    updateLayerList();
  };

  const getActiveObject = () => {
    for (let c of canvasesRef.current) {
      if (c && c.getActiveObject()) return c.getActiveObject();
    }
    return null;
  };

  const updateLayerList = () => {
    const items = [];
    let count = 0;
    canvasesRef.current.forEach((c, i) => {
      if (!c) return;
      c.getObjects().forEach((o) => {
        if (o.isWhiteout && o.fill === 'transparent') return;
        count++;
        items.push({
          num: count,
          page: i + 1,
          canvas: c,
          obj: o,
          type: o.type,
          label: o.text ? `"${o.text.substring(0, 15)}..."` : `${o.type.toUpperCase()}`,
        });
      });
    });
    setLayersList(items);
  };

  const deleteActiveObject = () => {
    const active = getActiveObject();
    if (active) {
      const c = active.canvas;
      if (active.bgRect) {
        c.remove(active.bgRect);
      }
      c.remove(active);
      c.renderAll();
      updateLayerList();
    }
  };

  // Object Order & Transform Handlers
  const handleBringToFront = () => {
    const active = getActiveObject();
    if (active) {
      active.bringToFront();
      active.canvas?.renderAll();
      updateLayerList();
      saveState();
    }
  };

  const handleSendToBack = () => {
    const active = getActiveObject();
    if (active) {
      active.sendToBack();
      active.canvas?.renderAll();
      updateLayerList();
      saveState();
    }
  };

  const handleFlipHorizontal = () => {
    const active = getActiveObject();
    if (active) {
      active.set('flipX', !active.flipX);
      active.canvas?.renderAll();
      saveState();
    }
  };

  const handleFlipVertical = () => {
    const active = getActiveObject();
    if (active) {
      active.set('flipY', !active.flipY);
      active.canvas?.renderAll();
      saveState();
    }
  };

  const handleOpacityChange = (e) => {
    const val = parseFloat(e.target.value);
    setOpacityState(val);
    const active = getActiveObject();
    if (active) {
      active.set('opacity', val);
      active.canvas?.renderAll();
      saveState();
    }
  };

  // Real-Time Tool & Formatting Actions
  const handleAddText = () => {
    const canvas = canvasesRef.current[currentPage - 1];
    if (!canvas) return;
    const text = new window.fabric.IText('New Text Box', {
      left: 150,
      top: 150,
      fontSize: parseInt(fontSizeState),
      fontFamily: fontFamilyState,
      fill: strokeColor,
    });
    canvas.add(text);
    canvas.setActiveObject(text);
    text.enterEditing();
    text.selectAll();
    canvas.renderAll();
    setSelectedTool('select');
  };

  const handleEditTextTool = async () => {
    setSelectedTool('edit_content');
    const canvas = canvasesRef.current[currentPage - 1];
    if (!canvas) return;

    await detectOriginalText(currentPage);

    const textObj = canvas.getObjects().find((o) => o.type === 'i-text' || o.type === 'textbox');
    if (textObj) {
      if (textObj.bgRect) {
        textObj.bgRect.set('fill', 'white');
        canvas.renderAll();
      }
      canvas.setActiveObject(textObj);
      textObj.enterEditing();
      textObj.selectAll();
      canvas.renderAll();
    }
  };

  const handleAddStickyNote = () => {
    const canvas = canvasesRef.current[currentPage - 1];
    if (!canvas) return;

    const noteBg = new window.fabric.Rect({
      width: 180,
      height: 180,
      fill: '#fef08a',
      stroke: '#eab308',
      strokeWidth: 1,
      rx: 8, ry: 8,
      shadow: new window.fabric.Shadow({ color: 'rgba(0,0,0,0.15)', blur: 10, offsetX: 3, offsetY: 3 }),
    });

    const noteText = new window.fabric.IText('Sticky Note\nType here...', {
      left: 15,
      top: 15,
      fontSize: 18,
      fontFamily: 'Arial',
      fill: '#713f12',
      width: 150,
    });

    const group = new window.fabric.Group([noteBg, noteText], {
      left: 150,
      top: 150,
      isSticky: true,
    });

    canvas.add(group);
    canvas.setActiveObject(group);
    setSelectedTool('select');
  };

  const handleAddImage = () => {
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = 'image/*';
    inp.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (evt) => {
        window.fabric.Image.fromURL(evt.target.result, (img) => {
          const canvas = canvasesRef.current[currentPage - 1];
          if (!canvas) return;
          img.scaleToWidth(250);
          img.set({ left: 150, top: 150 });
          canvas.add(img);
          canvas.setActiveObject(img);
          setSelectedTool('select');
        });
      };
      reader.readAsDataURL(file);
    };
    inp.click();
  };

  // Real-Time Property Format Handlers
  const handleFontFamilyChange = (e) => {
    const val = e.target.value;
    setFontFamilyState(val);
    const active = getActiveObject();
    if (!active) return;

    const apply = (o) => {
      if (o.type === 'i-text' || o.type === 'text' || o.type === 'textbox') {
        o.set('fontFamily', val);
      }
    };
    if (active.type === 'activeSelection' || active.type === 'group') {
      active.getObjects().forEach(apply);
    } else {
      apply(active);
    }
    active.canvas?.renderAll();
    saveState();
  };

  const handleFontSizeChange = (e) => {
    const val = e.target.value;
    setFontSizeState(val);
    const active = getActiveObject();
    if (!active) return;

    const apply = (o) => {
      if (o.type === 'i-text' || o.type === 'text' || o.type === 'textbox') {
        o.set('fontSize', parseInt(val));
      }
    };
    if (active.type === 'activeSelection' || active.type === 'group') {
      active.getObjects().forEach(apply);
    } else {
      apply(active);
    }
    active.canvas?.renderAll();
    saveState();
  };

  const handleStrokeColorChange = (e) => {
    const color = e.target.value;
    setStrokeColor(color);
    const active = getActiveObject();
    if (!active) return;

    const apply = (o) => {
      if (o.type === 'i-text' || o.type === 'text' || o.type === 'textbox') {
        o.set('fill', color);
      } else {
        o.set('stroke', color);
      }
    };

    if (active.type === 'activeSelection' || active.type === 'group') {
      active.getObjects().forEach(apply);
    } else {
      apply(active);
    }
    active.canvas?.renderAll();
    saveState();
  };

  const handleFillColorChange = (e) => {
    const color = e.target.value;
    setFillColor(color);
    setNoFill(false);
    const active = getActiveObject();
    if (!active) return;

    const apply = (o) => {
      if (o.type !== 'i-text' && o.type !== 'text' && o.type !== 'textbox' && o.type !== 'line') {
        o.set('fill', color);
      }
    };

    if (active.type === 'activeSelection' || active.type === 'group') {
      active.getObjects().forEach(apply);
    } else {
      apply(active);
    }
    active.canvas?.renderAll();
    saveState();
  };

  const handleNoFillToggle = () => {
    const nextNoFill = !noFill;
    setNoFill(nextNoFill);
    const active = getActiveObject();
    if (!active) return;

    const apply = (o) => {
      if (o.type !== 'i-text' && o.type !== 'text' && o.type !== 'textbox' && o.type !== 'line') {
        o.set('fill', nextNoFill ? 'transparent' : fillColor);
      }
    };

    if (active.type === 'activeSelection' || active.type === 'group') {
      active.getObjects().forEach(apply);
    } else {
      apply(active);
    }
    active.canvas?.renderAll();
    saveState();
  };

  const handleTextStyle = (styleType) => {
    const active = getActiveObject();
    if (!active) return;

    const applyToText = (o) => {
      if (o.type === 'i-text' || o.type === 'text' || o.type === 'textbox') {
        if (styleType === 'bold') {
          const next = o.fontWeight === 'bold' ? 'normal' : 'bold';
          o.set('fontWeight', next);
          setIsBoldActive(next === 'bold');
        } else if (styleType === 'italic') {
          const next = o.fontStyle === 'italic' ? 'normal' : 'italic';
          o.set('fontStyle', next);
          setIsItalicActive(next === 'italic');
        } else if (styleType === 'underline') {
          const next = !o.underline;
          o.set('underline', next);
          setIsUnderlineActive(next);
        } else if (styleType === 'strikethrough') {
          const next = !o.linethrough;
          o.set('linethrough', next);
          setIsStrikethroughActive(next);
        }
      }
    };

    if (active.type === 'activeSelection' || active.type === 'group') {
      active.getObjects().forEach(applyToText);
    } else {
      applyToText(active);
    }

    active.canvas?.renderAll();
    saveState();
  };

  const handleTextAlign = (align) => {
    const active = getActiveObject();
    if (!active) return;

    const apply = (o) => {
      if (o.type === 'i-text' || o.type === 'text' || o.type === 'textbox') {
        o.set('textAlign', align);
      }
    };
    if (active.type === 'activeSelection' || active.type === 'group') {
      active.getObjects().forEach(apply);
    } else {
      apply(active);
    }
    active.canvas?.renderAll();
    saveState();
  };

  const handleDashStyleChange = (style) => {
    setDashStyleState(style);
    const active = getActiveObject();
    if (!active) return;

    let dashArray = [];
    if (style === 'dashed') dashArray = [10, 5];
    else if (style === 'dotted') dashArray = [3, 3];

    const apply = (o) => {
      if (o.stroke) {
        o.set('strokeDashArray', dashArray);
      }
    };
    if (active.type === 'activeSelection' || active.type === 'group') {
      active.getObjects().forEach(apply);
    } else {
      apply(active);
    }
    active.canvas?.renderAll();
    saveState();
  };

  const handleLayerMove = (direction) => {
    const active = getActiveObject();
    if (!active || !active.canvas) return;
    const canvas = active.canvas;

    if (direction === 'forward') canvas.bringForward(active);
    else if (direction === 'backward') canvas.sendBackwards(active);
    else if (direction === 'front') canvas.bringToFront(active);
    else if (direction === 'back') canvas.sendToBack(active);

    canvas.renderAll();
    saveState();
  };

  const handleObjectAlign = (alignment) => {
    const active = getActiveObject();
    if (!active || !active.canvas) return;
    const canvas = active.canvas;
    const cw = canvas.width;
    const ch = canvas.height;

    if (alignment === 'left') active.set('left', 10);
    else if (alignment === 'center') active.set('left', (cw - active.width * active.scaleX) / 2);
    else if (alignment === 'right') active.set('left', cw - active.width * active.scaleX - 10);
    else if (alignment === 'top') active.set('top', 10);
    else if (alignment === 'middle') active.set('top', (ch - active.height * active.scaleY) / 2);
    else if (alignment === 'bottom') active.set('top', ch - active.height * active.scaleY - 10);

    active.setCoords();
    canvas.renderAll();
    saveState();
  };

  const handleObjectFlip = (axis) => {
    const active = getActiveObject();
    if (!active || !active.canvas) return;
    if (axis === 'X') active.set('flipX', !active.flipX);
    if (axis === 'Y') active.set('flipY', !active.flipY);
    active.canvas.renderAll();
    saveState();
  };

  const handleRecolorAll = () => {
    const fColor = noFill ? 'transparent' : fillColor;
    canvasesRef.current.forEach((c) => {
      if (!c) return;
      c.getObjects().forEach((o) => {
        if (o.isWhiteout) return;
        if (o.type === 'i-text' || o.type === 'text' || o.type === 'textbox') {
          o.set('fill', strokeColor);
        } else {
          if (o.stroke) o.set('stroke', strokeColor);
          if (o.fill && o.fill !== 'transparent') o.set('fill', fColor);
        }
      });
      c.renderAll();
    });
    saveState();
  };

  // Zoom Controls
  const changeZoom = (delta) => {
    const nextZoom = Math.min(Math.max(0.2, zoom + delta), 2.5);
    setZoom(nextZoom);
    if (pagesContainerRef.current) {
      pagesContainerRef.current.style.transform = `scale(${nextZoom})`;
    }
  };

  const autoFitZoom = () => {
    const container = document.getElementById('editor-canvas-container');
    const pageWrapper = pagesContainerRef.current?.querySelector('.page-wrapper');
    if (container && pageWrapper) {
      const containerWidth = container.clientWidth - 80;
      const pageWidth = pageWrapper.clientWidth || 800;
      const nextZoom = Math.min(0.85, Math.max(0.3, containerWidth / pageWidth));
      setZoom(nextZoom);
      pagesContainerRef.current.style.transform = `scale(${nextZoom})`;
    }
  };

  // Font Name Parser for Preserving Original Font Family & Style
  const parsePdfFont = (fontNameStr) => {
    if (!fontNameStr) return { fontFamily: 'Arial', fontWeight: 'normal', fontStyle: 'normal' };
    const str = fontNameStr.toLowerCase();

    let family = 'Arial';
    if (str.includes('times') || str.includes('georgia') || str.includes('garamond') || str.includes('baskerville') || str.includes('palatino') || str.includes('serif')) {
      family = 'Times New Roman';
    } else if (str.includes('courier') || str.includes('mono') || str.includes('code') || str.includes('consolas')) {
      family = 'Courier New';
    } else if (str.includes('calibri')) {
      family = 'Arial';
    } else if (str.includes('roboto')) {
      family = 'Roboto';
    } else if (str.includes('open') || str.includes('lato')) {
      family = 'Open Sans';
    } else if (str.includes('poppins') || str.includes('montserrat')) {
      family = 'Poppins';
    } else if (str.includes('verdana') || str.includes('tahoma')) {
      family = 'Verdana';
    } else if (str.includes('trebuchet')) {
      family = 'Trebuchet MS';
    } else if (str.includes('impact')) {
      family = 'Impact';
    } else if (str.includes('comic')) {
      family = 'Comic Sans MS';
    } else if (str.includes('helvetica') || str.includes('arial') || str.includes('sans')) {
      family = 'Arial';
    }

    const isBold = str.includes('bold') || str.includes('black') || str.includes('heavy') || str.includes('700') || str.includes('800') || str.includes('900');
    const isItalic = str.includes('italic') || str.includes('oblique') || str.includes('slanted') || str.includes('it');

    return {
      fontFamily: family,
      fontWeight: isBold ? 'bold' : 'normal',
      fontStyle: isItalic ? 'italic' : 'normal',
    };
  };

  // Extract Exact Color RGB/Hex from PDF.js item if present
  const extractPdfColor = (item) => {
    if (item && item.color) {
      if (Array.isArray(item.color) && item.color.length >= 3) {
        const r = Math.round(item.color[0]);
        const g = Math.round(item.color[1]);
        const b = Math.round(item.color[2]);
        return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
      }
      if (typeof item.color === 'string') return item.color;
    }
    return '#000000';
  };

  // Professional PDF Real-Time Text Detection & Editing Engine with Zero-Appearance Shift
  const detectOriginalText = async (pageNum) => {
    const origIdx = pageOrder[pageNum - 1];
    if (origIdx === undefined || !pdfDocRef.current) return;

    const page = await pdfDocRef.current.getPage(origIdx + 1);
    const textContent = await page.getTextContent();
    const rotationAngle = (pageRotations[origIdx] || 0) % 360;
    const viewport = page.getViewport({ scale: 2.0, rotation: rotationAngle });

    const canvas = canvasesRef.current[pageNum - 1];
    if (!canvas) return;

    const existingOriginals = canvas.getObjects().filter((o) => o.isOriginal);
    if (existingOriginals.length > 0) return;

    isStateSavingRef.current = true;

    const items = textContent.items;
    const processedSpans = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.str || !item.str.trim()) continue;

      const tx = window.pdfjsLib.Util.transform(viewport.transform, item.transform);
      const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);
      const fontMeta = parsePdfFont(item.fontName);
      const textColor = extractPdfColor(item);

      const last = processedSpans[processedSpans.length - 1];
      if (last && Math.abs(last.y - tx[5]) < 2) {
        const charGap = tx[4] - (last.x + last.width);
        if (charGap >= -1 && charGap < fontSize * 0.3) {
          last.str += item.str;
          last.width += (item.width * 2) + Math.max(0, charGap);
          continue;
        }
      }

      processedSpans.push({
        str: item.str,
        x: tx[4],
        y: tx[5],
        width: item.width * 2,
        fontSize: fontSize,
        fontFamily: fontMeta.fontFamily,
        fontWeight: fontMeta.fontWeight,
        fontStyle: fontMeta.fontStyle,
        color: textColor,
      });
    }

    processedSpans.forEach((span) => {
      const textLeft = span.x;
      const textTop = span.y - (span.fontSize * 0.82); // Precise baseline positioning

      // Transparent whiteout box until user actually edits this text block
      const bgRect = new window.fabric.Rect({
        left: textLeft - 2,
        top: textTop - 1,
        width: span.width + 6,
        height: span.fontSize + 4,
        fill: 'transparent',
        selectable: false,
        isWhiteout: true,
      });

      const textObj = new window.fabric.IText(span.str, {
        left: textLeft,
        top: textTop,
        fontSize: span.fontSize,
        fontFamily: span.fontFamily,
        fontWeight: span.fontWeight,
        fontStyle: span.fontStyle,
        fill: span.color || '#000000',
        isOriginal: true,
        originalText: span.str,
        opacity: 0.001, // Invisible until clicked/edited so native PDF.js vector rendering displays 100% identically!
      });

      textObj.bgRect = bgRect;

      // Synchronize Whiteout rectangle & make text interactive when user begins editing
      const syncBg = () => {
        textObj.set('opacity', 1.0);
        bgRect.set({
          left: textObj.left - 2,
          top: textObj.top - 1,
          width: Math.max(span.width + 6, textObj.width + 8),
          height: Math.max(span.fontSize + 4, textObj.height + 4),
          fill: 'white',
          isWhiteout: true
        });
        canvas.renderAll();
      };

      textObj.on('changed', syncBg);
      textObj.on('editing:entered', syncBg);
      textObj.on('moving', syncBg);
      textObj.on('scaling', syncBg);

      canvas.add(bgRect);
      canvas.add(textObj);
    });

    isStateSavingRef.current = false;
    saveState();
    canvas.renderAll();
    updateLayerList();
  };

  // Real-Time Save & Instant Download Payload
  const handleSaveChanges = async () => {
    if (!fileInputRef.current?.files[0]) {
      alert('No original PDF file available.');
      return;
    }

    setSaving(true);
    setSavingProgress('Compiling PDF modifications...');

    const annotations = canvasesRef.current.map((c, displayIdx) => {
      if (!c) return null;

      return {
        page_index: displayIdx,
        canvas_width: c.width,
        canvas_height: c.height,
        elements: c.getObjects().map((o) => {
          let type = o.type === 'i-text' || o.type === 'textbox' ? 'text' : o.type;
          let normPoints = null;

          if (type === 'rect' && o.angle === 45) {
            type = 'diamond';
          }

          if (o.type === 'line') {
            normPoints = [
              { x: o.x1, y: o.y1 },
              { x: o.x2, y: o.y2 }
            ];
          } else if (o.type === 'path' && Array.isArray(o.path)) {
            const offsetX = o.pathOffset ? o.pathOffset.x : 0;
            const offsetY = o.pathOffset ? o.pathOffset.y : 0;
            normPoints = o.path.map(cmd => {
              if (Array.isArray(cmd) && cmd.length >= 3) {
                return {
                  x: o.left + (cmd[cmd.length - 2] - offsetX) * (o.scaleX || 1),
                  y: o.top + (cmd[cmd.length - 1] - offsetY) * (o.scaleY || 1)
                };
              }
              return null;
            }).filter(Boolean);
          } else if (o.points) {
            normPoints = o.points;
          }

          return {
            type: type,
            x: o.left,
            y: o.top,
            width: o.width * (o.scaleX || 1),
            height: o.height * (o.scaleY || 1),
            angle: o.angle || 0,
            text: o.text || '',
            font_size: o.fontSize || 14,
            font_family: o.fontFamily || 'Arial',
            color: o.fill || '#000000',
            font_weight: o.fontWeight || 'normal',
            font_style: o.fontStyle || 'normal',
            underline: !!o.underline,
            text_align: o.textAlign || 'left',
            stroke: o.stroke || '#000000',
            stroke_width: o.strokeWidth || 2,
            opacity: o.opacity !== undefined ? o.opacity : 1.0,
            flip_x: !!o.flipX,
            flip_y: !!o.flipY,
            shape_fill: o.fill || 'transparent',
            image_data: o.type === 'image' ? o.toDataURL() : null,
            path_data: o.type === 'path' ? o.path : null,
            radius: o.type === 'circle' ? (o.radius || 30) * (o.scaleX || 1) : null,
            points: normPoints,
            is_original: !!o.isOriginal,
            is_whiteout: !!o.isWhiteout && o.fill !== 'transparent',
            is_sticky: !!o.isSticky,
            is_highlighter: !!o.isHighlighter,
          };
        }),
      };
    }).filter((a) => a && a.elements.length > 0);

    const formData = new FormData();
    formData.append('files', fileInputRef.current.files[0]);
    formData.append('annotations', JSON.stringify(annotations));
    formData.append('page_order', JSON.stringify(pageOrder));
    formData.append('page_rotations', JSON.stringify(pageRotations));

    try {
      const res = await axios.post('/process/edit-pdf/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-CSRFToken': getCookie('csrftoken'),
        },
      });

      if (!res.data.task_id) {
        throw new Error(res.data.error || 'Server error initializing PDF process.');
      }

      const taskId = res.data.task_id;
      setSavingProgress('Rendering high-res PDF output...');

      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await axios.get(`/status/${taskId}/`);
          if (statusRes.data.status === 'completed') {
            clearInterval(pollInterval);
            setSavingProgress('Download ready!');

            const link = document.createElement('a');
            link.href = statusRes.data.download_url;
            link.download = statusRes.data.filename || 'edited.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            setSaving(false);
          } else if (statusRes.data.status === 'failed') {
            clearInterval(pollInterval);
            throw new Error(statusRes.data.error || 'PDF rendering failed on server.');
          }
        } catch (err) {
          clearInterval(pollInterval);
          setSaving(false);
          alert(err.message || 'Error checking task status.');
        }
      }, 800);
    } catch (err) {
      setSaving(false);
      alert(err.response?.data?.error || err.message || 'Error processing request.');
    }
  };

  return (
    <div className="editor-wrapper">
      {/* Top Header Navbar */}
      <div className="header-toolbar shadow-sm border-bottom py-2 px-4 d-flex align-items-center justify-content-between bg-white sticky-top">
        <div className="d-flex align-items-center gap-3">
          <Link to="/" className="text-decoration-none d-flex align-items-center">
            <img src="/static/images/logo_circle.png" style={{ width: '28px', height: '28px' }} className="brand-logo me-2" alt="logo" />
            <span className="fw-bold text-dark fs-5 mb-0">
              PDF Editor{' '}
              {user?.is_pro ? (
                <span className="badge bg-warning text-dark rounded-pill ms-2" style={{ fontSize: '11px' }}>
                  PRO ({user?.days_left}d)
                </span>
              ) : (
                <span className="badge bg-secondary rounded-pill ms-2" style={{ fontSize: '11px' }}>
                  FREE
                </span>
              )}
            </span>
          </Link>
        </div>

        <div className="d-flex align-items-center gap-3">
          <button
            onClick={handleUndo}
            disabled={undoStack.length <= 1}
            className="btn btn-sm btn-light border px-3 fw-semibold shadow-xs"
            title="Undo (Ctrl+Z)"
          >
            <i className="bi bi-arrow-counterclockwise me-1"></i> Undo
          </button>
          <button
            onClick={handleRedo}
            disabled={redoStack.length === 0}
            className="btn btn-sm btn-light border px-3 fw-semibold shadow-xs"
            title="Redo (Ctrl+Y)"
          >
            <i className="bi bi-arrow-clockwise me-1"></i> Redo
          </button>
          <div className="vr"></div>
          <button
            id="saveChanges"
            disabled={saving || !hasPdf}
            onClick={handleSaveChanges}
            className="btn btn-danger rounded-pill px-4 fw-bold shadow-sm border-0 d-flex align-items-center gap-2"
            style={{ background: '#e11d48' }}
          >
            {saving ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status"></span>
                <span>{savingProgress || 'Saving...'}</span>
              </>
            ) : (
              <>
                <span>Save & Download</span>
                <i className="bi bi-download"></i>
              </>
            )}
          </button>
        </div>

        <div className="d-flex align-items-center gap-2">
          <Link to="/dashboard" className="btn btn-outline-secondary btn-sm rounded-pill px-3">
            <i className="bi bi-grid me-1"></i> Dashboard
          </Link>
        </div>
      </div>

      {/* Formatting & Tool System Navbar */}
      <div className="format-toolbar border-bottom bg-white px-4 py-2 d-flex align-items-center gap-2 shadow-sm flex-wrap">
        <div className="d-flex align-items-center gap-1 border-end pe-3 me-1">
          <button
            onClick={() => setSelectedTool('select')}
            className={`btn btn-light btn-sm px-2 ${selectedTool === 'select' ? 'active' : ''}`}
            title="Select Element"
          >
            <i className="bi bi-cursor-fill fs-5"></i>
          </button>
          <button onClick={handleAddText} className="btn btn-light btn-sm px-2" title="Add Text Box">
            <i className="bi bi-type fs-5"></i>
          </button>
          <button onClick={handleAddImage} className="btn btn-light btn-sm px-2" title="Insert Image">
            <i className="bi bi-image fs-5"></i>
          </button>

          {/* Interactive Drag-to-Draw Shape Selection Buttons */}
          <div className="btn-group btn-group-sm ms-1">
            <button
              onClick={() => setSelectedTool('shape_rect')}
              className={`btn btn-light ${selectedTool === 'shape_rect' ? 'active' : ''}`}
              title="Draw Rectangle (Click & Drag)"
            >
              <i className="bi bi-square"></i>
            </button>
            <button
              onClick={() => setSelectedTool('shape_circle')}
              className={`btn btn-light ${selectedTool === 'shape_circle' ? 'active' : ''}`}
              title="Draw Circle (Click & Drag)"
            >
              <i className="bi bi-circle"></i>
            </button>
            <button
              onClick={() => setSelectedTool('shape_triangle')}
              className={`btn btn-light ${selectedTool === 'shape_triangle' ? 'active' : ''}`}
              title="Draw Triangle (Click & Drag)"
            >
              <i className="bi bi-triangle"></i>
            </button>
            <button
              onClick={() => setSelectedTool('shape_diamond')}
              className={`btn btn-light ${selectedTool === 'shape_diamond' ? 'active' : ''}`}
              title="Draw Diamond (Click & Drag)"
            >
              <i className="bi bi-diamond"></i>
            </button>
            <button
              onClick={() => setSelectedTool('shape_line')}
              className={`btn btn-light ${selectedTool === 'shape_line' ? 'active' : ''}`}
              title="Draw Line (Click & Drag)"
            >
              <i className="bi bi-slash-lg"></i>
            </button>
            <button
              onClick={() => setSelectedTool('shape_arrow')}
              className={`btn btn-light ${selectedTool === 'shape_arrow' ? 'active' : ''}`}
              title="Draw Arrow (Click & Drag)"
            >
              <i className="bi bi-arrow-up-right"></i>
            </button>
          </div>

          {/* Freehand Pencil, Highlighter & Sticky Notes */}
          <div className="vr mx-1"></div>
          <button
            onClick={() => setSelectedTool('pencil')}
            className={`btn btn-light btn-sm px-2 ${selectedTool === 'pencil' ? 'active' : ''}`}
            title="Pencil Freehand"
          >
            <i className="bi bi-pencil-fill fs-5"></i>
          </button>
          <button
            onClick={() => setSelectedTool('highlighter')}
            className={`btn btn-light btn-sm px-2 ${selectedTool === 'highlighter' ? 'active text-warning' : ''}`}
            title="Highlighter"
          >
            <i className="bi bi-highlighter fs-5"></i>
          </button>
          <button
            onClick={handleAddStickyNote}
            className="btn btn-light btn-sm px-2 text-warning"
            title="Sticky Note"
          >
            <i className="bi bi-sticky-fill fs-5"></i>
          </button>

          <div className="vr mx-1"></div>
          <button
            onClick={handleEditTextTool}
            className={`btn btn-outline-primary btn-sm px-3 fw-bold ${selectedTool === 'edit_content' ? 'active' : ''}`}
            title="Edit Text"
          >
            <i className="bi bi-pencil-square me-1"></i> Edit Text
          </button>
        </div>

        {/* Font Family */}
        <div className="input-group input-group-sm border-end pe-2 me-1" style={{ maxWidth: '150px' }}>
          <select
            value={fontFamilyState}
            onChange={handleFontFamilyChange}
            className="form-select border-0 fw-semibold shadow-none"
          >
            <option value="Arial">Arial</option>
            <option value="Inter">Inter</option>
            <option value="Roboto">Roboto</option>
            <option value="Open Sans">Open Sans</option>
            <option value="Lato">Lato</option>
            <option value="Poppins">Poppins</option>
            <option value="Montserrat">Montserrat</option>
            <option value="Helvetica">Helvetica</option>
            <option value="Verdana">Verdana</option>
            <option value="Tahoma">Tahoma</option>
            <option value="Trebuchet MS">Trebuchet MS</option>
            <option value="Times New Roman">Times New Roman</option>
            <option value="Georgia">Georgia</option>
            <option value="Garamond">Garamond</option>
            <option value="Palatino">Palatino</option>
            <option value="Baskerville">Baskerville</option>
            <option value="Courier New">Courier New</option>
            <option value="Consolas">Consolas</option>
            <option value="Monaco">Monaco</option>
            <option value="Impact">Impact</option>
            <option value="Comic Sans MS">Comic Sans MS</option>
            <option value="Oswald">Oswald</option>
            <option value="Raleway">Raleway</option>
            <option value="Pacifico">Pacifico</option>
          </select>
        </div>

        {/* Font Size */}
        <div className="input-group input-group-sm border-end pe-2 me-1" style={{ maxWidth: '85px' }}>
          <select
            value={fontSizeState}
            onChange={handleFontSizeChange}
            className="form-select border-0 fw-semibold shadow-none"
          >
            <option value="8">8</option>
            <option value="10">10</option>
            <option value="12">12</option>
            <option value="14">14</option>
            <option value="16">16</option>
            <option value="18">18</option>
            <option value="20">20</option>
            <option value="24">24</option>
            <option value="28">28</option>
            <option value="32">32</option>
            <option value="36">36</option>
            <option value="48">48</option>
            <option value="64">64</option>
            <option value="72">72</option>
            <option value="96">96</option>
            <option value="144">144</option>
          </select>
        </div>

        {/* Text Styling (Bold, Italic, Underline, Strikethrough, Align) & Colors */}
        <div className="d-flex align-items-center gap-1 border-end pe-2 me-1">
          <button
            onClick={() => handleTextStyle('bold')}
            className={`btn btn-light btn-sm border-0 ${isBoldActive ? 'active bg-primary text-white fw-bold' : ''}`}
            title="Bold"
          >
            <i className="bi bi-type-bold fs-5"></i>
          </button>
          <button
            onClick={() => handleTextStyle('italic')}
            className={`btn btn-light btn-sm border-0 ${isItalicActive ? 'active bg-primary text-white fw-bold' : ''}`}
            title="Italic"
          >
            <i className="bi bi-type-italic fs-5"></i>
          </button>
          <button
            onClick={() => handleTextStyle('underline')}
            className={`btn btn-light btn-sm border-0 ${isUnderlineActive ? 'active bg-primary text-white fw-bold' : ''}`}
            title="Underline"
          >
            <i className="bi bi-type-underline fs-5"></i>
          </button>
          <button
            onClick={() => handleTextStyle('strikethrough')}
            className={`btn btn-light btn-sm border-0 ${isStrikethroughActive ? 'active bg-primary text-white fw-bold' : ''}`}
            title="Strikethrough"
          >
            <i className="bi bi-type-strikethrough fs-5"></i>
          </button>

          <div className="btn-group btn-group-sm ms-1" title="Text Alignment">
            <button onClick={() => handleTextAlign('left')} className="btn btn-light border-0"><i className="bi bi-text-left"></i></button>
            <button onClick={() => handleTextAlign('center')} className="btn btn-light border-0"><i className="bi bi-text-center"></i></button>
            <button onClick={() => handleTextAlign('right')} className="btn btn-light border-0"><i className="bi bi-text-right"></i></button>
            <button onClick={() => handleTextAlign('justify')} className="btn btn-light border-0"><i className="bi bi-justify"></i></button>
          </div>
        </div>

        {/* Dash Style & Layer / Alignment System */}
        <div className="d-flex align-items-center gap-1 border-end pe-2 me-1">
          <select
            value={dashStyleState}
            onChange={(e) => handleDashStyleChange(e.target.value)}
            className="form-select form-select-sm border-0 fw-semibold shadow-none"
            style={{ width: '80px' }}
            title="Stroke Dash Style"
          >
            <option value="solid">Solid</option>
            <option value="dashed">Dashed</option>
            <option value="dotted">Dotted</option>
          </select>

          <div className="btn-group btn-group-sm ms-1" title="Layer Ordering">
            <button onClick={() => handleLayerMove('forward')} className="btn btn-light border-0" title="Bring Forward"><i className="bi bi-layer-forward"></i></button>
            <button onClick={() => handleLayerMove('backward')} className="btn btn-light border-0" title="Send Backward"><i className="bi bi-layer-backward"></i></button>
          </div>

          <div className="btn-group btn-group-sm ms-1" title="Image Flip">
            <button onClick={() => handleObjectFlip('X')} className="btn btn-light border-0" title="Flip Horizontal"><i className="bi bi-arrow-left-right"></i></button>
            <button onClick={() => handleObjectFlip('Y')} className="btn btn-light border-0" title="Flip Vertical"><i className="bi bi-arrow-down-up"></i></button>
          </div>
        </div>

          {/* Stroke / Text Color Picker Trigger Button */}
          <button
            type="button"
            className="btn btn-light btn-sm border-0 d-flex flex-column align-items-center p-1 ms-1"
            onClick={() => strokeColorInputRef.current?.click()}
            title="Text / Stroke Color"
          >
            <i className="bi bi-pencil" style={{ lineHeight: '1', fontSize: '13px' }}></i>
            <div style={{ width: '16px', height: '3px', background: strokeColor, marginTop: '2px' }}></div>
          </button>
          <input
            type="color"
            ref={strokeColorInputRef}
            className="d-none"
            value={strokeColor}
            onChange={handleStrokeColorChange}
          />

          {/* Shape Fill Color Picker Trigger Button */}
          <button
            type="button"
            className="btn btn-light btn-sm border-0 d-flex flex-column align-items-center p-1 ms-1"
            onClick={() => fillColorInputRef.current?.click()}
            title="Shape Fill Color"
          >
            <i className="bi bi-paint-bucket" style={{ lineHeight: '1', fontSize: '13px' }}></i>
            <div
              style={{
                width: '16px',
                height: '3px',
                background: noFill ? 'transparent' : fillColor,
                border: '1px solid #ccc',
                marginTop: '2px',
              }}
            ></div>
          </button>
          <input
            type="color"
            ref={fillColorInputRef}
            className="d-none"
            value={fillColor}
            onChange={handleFillColorChange}
          />

          {/* No Fill Toggle Button */}
          <button
            onClick={handleNoFillToggle}
            className={`btn btn-light btn-sm border-0 ms-1 ${noFill ? 'text-primary fw-bold' : 'text-muted'}`}
            title="No Fill"
          >
            <i className="bi bi-x-circle-fill fs-5"></i>
          </button>

          {/* Opacity Slider */}
          <div className="d-flex align-items-center gap-1 border-start ps-2 ms-1" title="Opacity">
            <i className="bi bi-circle-half text-muted" style={{ fontSize: '12px' }}></i>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              className="form-range"
              style={{ width: '60px' }}
              value={opacityState}
              onChange={handleOpacityChange}
            />
          </div>

          {/* Recolor & Delete */}
          <div className="d-flex align-items-center gap-1 ms-auto">
            <button onClick={handleRecolorAll} className="btn btn-light btn-sm border-0" title="Recolor All Elements">
              <i className="bi bi-palette fs-5"></i>
            </button>
            <button onClick={deleteActiveObject} className="btn btn-light btn-sm border-0 text-danger" title="Delete Selected Element (Del)">
              <i className="bi bi-trash3 fs-5"></i>
            </button>
          </div>
        </div>

      {/* Main Workspace Layout */}
      <div className="d-flex flex-grow-1 overflow-hidden position-relative">
        {/* Left Sidebar: Page Thumbnails */}
        <div id="editor-sidebar" className="bg-white border-end shadow-sm overflow-auto" style={{ width: '220px', minWidth: '220px' }}>
          <div className="p-3 border-bottom bg-light fw-bold text-secondary d-flex justify-content-between align-items-center">
            <span>PAGES ({pageOrder.length})</span>
          </div>
          <div id="thumbnail-list" className="p-3 d-flex flex-column gap-3" ref={sidebarRef}>
            {/* Thumbnails dynamically populated */}
          </div>
        </div>

        {/* Center Main Editor Viewport */}
        <div
          id="editor-canvas-container"
          className="flex-grow-1 position-relative overflow-auto d-flex flex-column align-items-center py-5 bg-secondary-subtle"
        >
          {!hasPdf && !loading && (
            <div id="pdf-upload-view" className="my-auto text-center animate__animated animate__fadeIn">
              <div
                className={`upload-area border-dashed rounded-5 p-5 bg-white shadow-lg mx-auto ${isDragOver ? 'bg-light border-primary' : ''}`}
                style={{ maxWidth: '520px', cursor: 'pointer', transition: 'all 0.2s' }}
                onClick={handleUploadClick}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <i className="bi bi-cloud-arrow-up display-1 text-primary mb-4 d-block"></i>
                <h3 className="fw-bold">Upload PDF Document</h3>
                <p className="text-muted mb-4">Edit text, images, shapes, and pages directly in your browser. Drag & drop file here.</p>
                <button className="btn btn-primary rounded-pill px-5 py-3 fw-bold shadow">Select PDF File</button>
              </div>
              <input type="file" id="fileInput" ref={fileInputRef} accept=".pdf" onChange={handleFileChange} hidden />
            </div>
          )}

          {loading && (
            <div id="loader" className="text-center my-auto">
              <div className="spinner-grow text-primary" style={{ width: '3.5rem', height: '3.5rem' }}></div>
              <h4 className="mt-4 fw-bold text-dark">Initializing Real-Time PDF Editor...</h4>
            </div>
          )}

          <div
            id="pages-container"
            className={`${hasPdf ? 'd-flex' : 'd-none'} flex-column align-items-center`}
            ref={pagesContainerRef}
            style={{ transformOrigin: 'top center', transition: 'transform 0.15s ease-out' }}
          >
            {/* Pages dynamically rendered */}
          </div>

          {/* Floating Bottom Navigation Bar */}
          {hasPdf && (
            <div
              className="bottom-nav position-fixed bottom-0 start-50 translate-middle-x mb-4 shadow-lg rounded-pill px-4 py-2 d-flex align-items-center gap-4 text-white"
              style={{ background: '#1e293b', zIndex: 2000, minWidth: '460px' }}
            >
              <div className="d-flex align-items-center gap-3 pe-4 border-end border-secondary">
                <button
                  className="btn btn-link text-white p-0"
                  onClick={() => scrollToPage(Math.max(1, currentPage - 1))}
                  title="Previous Page"
                >
                  <i className="bi bi-chevron-up"></i>
                </button>
                <button
                  className="btn btn-link text-white p-0"
                  onClick={() => scrollToPage(Math.min(totalPages, currentPage + 1))}
                  title="Next Page"
                >
                  <i className="bi bi-chevron-down"></i>
                </button>
              </div>

              <div className="d-flex align-items-center gap-2 pe-4 border-end border-secondary">
                <input
                  type="number"
                  className="form-control form-control-sm bg-dark border-0 text-white text-center fw-bold"
                  value={currentPage}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    if (val >= 1 && val <= totalPages) scrollToPage(val);
                  }}
                  style={{ width: '50px' }}
                />
                <span className="small opacity-50">/ <span>{totalPages}</span></span>
              </div>

              <div className="d-flex align-items-center gap-3 pe-4 border-end border-secondary">
                <button className="btn btn-link text-white p-0" onClick={() => changeZoom(-0.1)} title="Zoom Out">
                  <i className="bi bi-dash-circle fs-5"></i>
                </button>
                <button className="btn btn-link text-white p-0" onClick={() => changeZoom(0.1)} title="Zoom In">
                  <i className="bi bi-plus-circle fs-5"></i>
                </button>
              </div>

              <div className="pe-4 border-end border-secondary">
                <span className="badge bg-secondary rounded-pill px-3 py-2 fw-bold" style={{ fontSize: '13px' }}>
                  {Math.round(zoom * 100)}%
                </span>
              </div>

              <div className="d-flex align-items-center gap-3">
                <button className="btn btn-link text-white p-0" onClick={autoFitZoom} title="Fit to Screen">
                  <i className="bi bi-arrows-expand fs-5"></i>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Sidebar: Layers Inspector */}
        <div id="editor-layers" className="bg-white border-start shadow-sm overflow-auto" style={{ width: '240px', minWidth: '240px' }}>
          <div className="p-3 border-bottom fw-bold bg-light d-flex justify-content-between align-items-center text-secondary">
            <span>ELEMENTS</span>
            <span className="badge bg-primary rounded-circle">{layersList.length}</span>
          </div>
          <div id="layer-list" className="p-3 d-flex flex-column gap-2">
            {layersList.length > 0 ? (
              layersList.map((item) => (
                <div
                  key={item.num}
                  className="layer-item d-flex align-items-center justify-content-between p-2 border rounded shadow-xs"
                  onClick={() => {
                    scrollToPage(item.page);
                    item.canvas.setActiveObject(item.obj);
                    item.canvas.renderAll();
                  }}
                  style={{ cursor: 'pointer', background: '#f8fafc' }}
                >
                  <span className="small fw-semibold text-truncate">
                    <i className="bi bi-layers me-2 text-primary"></i>
                    {item.label} (P{item.page})
                  </span>
                  <button
                    className="btn btn-link btn-sm text-danger p-0 ms-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      item.canvas.remove(item.obj);
                      item.canvas.renderAll();
                      updateLayerList();
                    }}
                  >
                    <i className="bi bi-x"></i>
                  </button>
                </div>
              ))
            ) : (
              <div className="text-center text-muted py-5 small">No elements added yet.</div>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .editor-wrapper {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            z-index: 1050;
            display: flex;
            flex-direction: column;
            background: #f1f5f9;
            font-family: 'Inter', system-ui, sans-serif;
        }
        .header-toolbar {
            height: 60px;
            z-index: 1100;
        }
        .format-toolbar {
            min-height: 50px;
            z-index: 1090;
        }
        .page-wrapper {
            position: relative;
            background: white;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
        }
        .canvas-container {
            position: absolute !important;
            top: 0;
            left: 0;
        }
        .thumbnail-item {
            cursor: pointer;
            transition: all 0.2s;
        }
        .thumb-wrap {
            border: 2px solid transparent;
            transition: border-color 0.2s;
        }
        .thumbnail-item.active .thumb-wrap {
            border-color: #3b82f6 !important;
        }
        .thumbnail-item:hover .thumb-wrap {
            transform: scale(1.02);
        }
        .border-dashed {
            border: 2px dashed #cbd5e1;
            transition: all 0.2s;
        }
        .border-dashed:hover {
            border-color: #3b82f6;
            background: #f8fafc;
        }
        .btn-light.active {
            background: #e2e8f0;
            border-color: #3b82f6 !important;
            color: #1d4ed8;
        }
      `}} />
    </div>
  );
}
