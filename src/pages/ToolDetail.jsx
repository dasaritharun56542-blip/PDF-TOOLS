import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth, getCookie } from '../context/AuthContext';
import { TOOLS } from '../utils/tools';
import InteractiveImageEditor from '../components/InteractiveImageEditor';
import InteractivePdfRedactor from '../components/InteractivePdfRedactor';
import InteractivePdfCropper from '../components/InteractivePdfCropper';
import GlobalFileUpload from '../components/GlobalFileUpload';
import DynamicActionButton from '../components/DynamicActionButton';
import { validateFileForTool, getToolAcceptAttribute, getToolSupportedFormatsLabel } from '../utils/fileValidation';

export default function ToolDetail() {
  const { toolSlug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const tool = TOOLS[toolSlug];
  if (!tool) {
    useEffect(() => {
      navigate('/');
    }, []);
    return null;
  }

  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [loadingPages, setLoadingPages] = useState(false);
  const [totalPages, setTotalPages] = useState(0);
  const [pageThumbnails, setPageThumbnails] = useState([]); // Array of { num, url, rotation: 0, deleted: false }
  const [selectedPages, setSelectedPages] = useState([]); // Split/Extract selections
  const [convertedPageThumbnails, setConvertedPageThumbnails] = useState([]);
  const [previewZoom, setPreviewZoom] = useState(1.25);
  const [currentPreviewPage, setCurrentPreviewPage] = useState(1);
  const [previewPdfDoc, setPreviewPdfDoc] = useState(null);
  
  // Custom tool configuration options
  const [password, setPassword] = useState('');
  const [rotationAngle, setRotationAngle] = useState('90');
  const [watermarkType, setWatermarkType] = useState('text');
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [watermarkLogo, setWatermarkLogo] = useState(null);
  const [htmlContent, setHtmlContent] = useState('');
  const [signatureText, setSignatureText] = useState('');
  const [editText, setEditText] = useState('');
  const [editFontSize, setEditFontSize] = useState('20');
  const [editColor, setEditColor] = useState('#000000');
  const [editLogo, setEditLogo] = useState(null);
  const [editX, setEditX] = useState(10);
  const [editY, setEditY] = useState(10);

  // Convert Image Format / Image & PDF Options State
  const [targetFormat, setTargetFormat] = useState('png');
  const [resizeWidth, setResizeWidth] = useState('800');
  const [resizeHeight, setResizeHeight] = useState('600');
  const [cropLeft, setCropLeft] = useState('0');
  const [cropTop, setCropTop] = useState('0');
  const [cropRight, setCropRight] = useState('0');
  const [cropBottom, setCropBottom] = useState('0');
  const [compressQuality, setCompressQuality] = useState('75');
  const [redactPattern, setRedactPattern] = useState('');
  const [redactPreset, setRedactPreset] = useState('custom');
  const [redactFillColor, setRedactFillColor] = useState('#000000');
  const [redactOverlayText, setRedactOverlayText] = useState('REDACTED');

  // Missing Pure PDF Tool States
  const [headerText, setHeaderText] = useState('Document Header');
  const [footerText, setFooterText] = useState('Page Footer');
  const [cropMarginTop, setCropMarginTop] = useState('10');
  const [cropMarginBottom, setCropMarginBottom] = useState('10');
  const [cropMarginLeft, setCropMarginLeft] = useState('10');
  const [cropMarginRight, setCropMarginRight] = useState('10');
  const [metaTitle, setMetaTitle] = useState('Document Title');
  const [metaAuthor, setMetaAuthor] = useState('Author Name');
  const [metaSubject, setMetaSubject] = useState('Subject / Category');
  const [metaKeywords, setMetaKeywords] = useState('PDF, Document, Optimized');
  const [metaCreator, setMetaCreator] = useState('PDF PowerHouse');
  const [metaProducer, setMetaProducer] = useState('PyMuPDF Engine');

  // Rotation History & Multi-Selection States
  const [rotationHistory, setRotationHistory] = useState([]);
  const [redoHistory, setRedoHistory] = useState([]);
  const [lastSelectedPage, setLastSelectedPage] = useState(null);

  // Flow State
  const [status, setStatus] = useState('idle'); // idle, processing, completed, failed
  const [progressBarWidth, setProgressBarWidth] = useState(0);
  const [statusText, setStatusText] = useState('Connecting to engine...');
  const [downloadUrl, setDownloadUrl] = useState('');
  const [outputFilename, setOutputFilename] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Refs
  const fileInputRef = useRef(null);
  const pageGridRef = useRef(null);
  const pdfDocRef = useRef(null);

  useEffect(() => {
    // Check if premium and user is not authenticated/pro
    const checkPremium = async () => {
      if (tool.premium) {
        if (!user) {
          navigate('/accounts/login');
          return;
        }
        try {
          const profileRes = await axios.get('/api/auth-status/');
          if (!profileRes.data.user?.is_pro) {
            alert('This is a PRO tool. Please upgrade your plan to use it.');
            navigate('/accounts/pricing');
          }
        } catch (err) {
          navigate('/accounts/login');
        }
      }
    };
    checkPremium();

    // Clear state on tool change
    setUploadedFiles([]);
    setPageThumbnails([]);
    setSelectedPages([]);
    setStatus('idle');
  }, [toolSlug, user, navigate]);

  // SortableJS initialization for organize tool
  useEffect(() => {
    if (toolSlug === 'organize' && pageThumbnails.length > 0 && pageGridRef.current && window.Sortable) {
      const sortable = new window.Sortable(pageGridRef.current, {
        animation: 150,
        ghostClass: 'bg-info-subtle',
        onEnd: () => {
          // Re-calculate the page order based on DOM children order
          const children = Array.from(pageGridRef.current.children);
          const newOrder = children.map(child => {
            const pageNum = parseInt(child.getAttribute('data-page-num'));
            return pageThumbnails.find(t => t.num === pageNum);
          }).filter(Boolean);
          setPageThumbnails(newOrder);
        }
      });
      return () => sortable.destroy();
    }
  }, [toolSlug, pageThumbnails]);

  // Keyboard shortcuts for Rotate PDF (Ctrl+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (toolSlug !== 'rotate') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        handleRedo();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toolSlug, rotationHistory, redoHistory, pageThumbnails]);

  // Handle Paste Events (Ctrl+V)
  useEffect(() => {
    const handlePaste = (e) => {
      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        handleFiles(e.clipboardData.files);
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [toolSlug, uploadedFiles]);

  const handleFiles = async (files) => {
    const fileList = Array.from(files);
    const validFiles = [];
    const errorMessages = [];

    for (const f of fileList) {
      const isDuplicate = uploadedFiles.some(existing => existing.name === f.name && existing.size === f.size);
      if (isDuplicate) continue;

      const result = await validateFileForTool(f, toolSlug);
      if (result.valid) {
        validFiles.push(f);
      } else {
        errorMessages.push(result.error);
      }
    }

    if (errorMessages.length > 0) {
      alert(`File Validation Alert:\n\n${errorMessages.join('\n\n')}`);
    }

    if (validFiles.length > 0) {
      setUploadedFiles(prev => [...prev, ...validFiles]);
    }
  };

  const generatePreviews = async (filesList) => {
    setLoadingPages(true);
    const allThumbs = [];
    let pageCounter = 1;

    for (const file of filesList) {
      if (file.type === 'application/pdf') {
        try {
          const fileURL = URL.createObjectURL(file);
          const pdf = await window.pdfjsLib.getDocument(fileURL).promise;
          const count = pdf.numPages;

          try {
            const metaObj = await pdf.getMetadata();
            if (metaObj && metaObj.info) {
              if (metaObj.info.Title) setMetaTitle(metaObj.info.Title);
              if (metaObj.info.Author) setMetaAuthor(metaObj.info.Author);
              if (metaObj.info.Subject) setMetaSubject(metaObj.info.Subject);
              if (metaObj.info.Keywords) setMetaKeywords(metaObj.info.Keywords);
              if (metaObj.info.Creator) setMetaCreator(metaObj.info.Creator);
              if (metaObj.info.Producer) setMetaProducer(metaObj.info.Producer);
            }
          } catch (mErr) {
            console.warn('Metadata parsing skipped:', mErr);
          }
          
          for (let i = 1; i <= count; i++) {
            const page = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 0.3 });
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            canvas.height = viewport.height;
            canvas.width = viewport.width;

            await page.render({ canvasContext: context, viewport: viewport }).promise;
            allThumbs.push({
              num: pageCounter++,
              url: canvas.toDataURL('image/jpeg', 0.65),
              rotation: 0,
              deleted: false,
              fileName: file.name,
              pdfPageNum: i,
              fileURL: fileURL
            });
          }
        } catch (err) {
          console.error('Failed to parse PDF file pages', file.name, err);
        }
      } else if (file.type.startsWith('image/')) {
        const url = URL.createObjectURL(file);
        allThumbs.push({
          num: pageCounter++,
          url: url,
          rotation: 0,
          deleted: false,
          fileName: file.name
        });
      } else {
        let placeholderUrl = '';
        const ext = file.name.split('.').pop().toLowerCase();
        if (['doc', 'docx'].includes(ext)) {
          placeholderUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140" viewBox="0 0 100 140"><rect width="100" height="140" rx="8" fill="%232b579a"/><text x="50" y="75" font-family="Arial" font-size="24" fill="white" font-weight="bold" text-anchor="middle">WORD</text></svg>';
        } else if (['xls', 'xlsx'].includes(ext)) {
          placeholderUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140" viewBox="0 0 100 140"><rect width="100" height="140" rx="8" fill="%23217346"/><text x="50" y="75" font-family="Arial" font-size="24" fill="white" font-weight="bold" text-anchor="middle">EXCEL</text></svg>';
        } else if (['ppt', 'pptx'].includes(ext)) {
          placeholderUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140" viewBox="0 0 100 140"><rect width="100" height="140" rx="8" fill="%23b7472a"/><text x="50" y="75" font-family="Arial" font-size="24" fill="white" font-weight="bold" text-anchor="middle">PPT</text></svg>';
        } else {
          placeholderUrl = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="140" viewBox="0 0 100 140"><rect width="100" height="140" rx="8" fill="%237f8c8d"/><text x="50" y="75" font-family="Arial" font-size="20" fill="white" font-weight="bold" text-anchor="middle">FILE</text></svg>';
        }
        allThumbs.push({
          num: pageCounter++,
          url: placeholderUrl,
          rotation: 0,
          deleted: false,
          fileName: file.name
        });
      }
    }
    setPageThumbnails(allThumbs);
    setTotalPages(pageCounter - 1);
    setLoadingPages(false);
  };

  useEffect(() => {
    if (uploadedFiles.length > 0) {
      generatePreviews(uploadedFiles);
    } else {
      setPageThumbnails([]);
      setTotalPages(0);
    }
  }, [uploadedFiles]);

  const loadConvertedPdfPreviews = async (url) => {
    try {
      setLoadingPages(true);
      if (previewPdfDoc && previewPdfDoc.destroy) {
        try { previewPdfDoc.destroy(); } catch (e) {}
      }
      setPreviewPdfDoc(null);
      setConvertedPageThumbnails([]);
      setSelectedPages([]);
      setRotationHistory([]);
      setRedoHistory([]);

      const cacheBustedUrl = url.includes('?') ? `${url}&t=${Date.now()}` : `${url}?t=${Date.now()}`;
      const res = await axios.get(cacheBustedUrl, { responseType: 'arraybuffer' });
      const pdf = await window.pdfjsLib.getDocument({ data: res.data }).promise;
      setPreviewPdfDoc(pdf);
      const count = pdf.numPages;

      try {
        const metaObj = await pdf.getMetadata();
        if (metaObj && metaObj.info) {
          if (metaObj.info.Title) setMetaTitle(metaObj.info.Title);
          if (metaObj.info.Author) setMetaAuthor(metaObj.info.Author);
          if (metaObj.info.Subject) setMetaSubject(metaObj.info.Subject);
          if (metaObj.info.Keywords) setMetaKeywords(metaObj.info.Keywords);
          if (metaObj.info.Creator) setMetaCreator(metaObj.info.Creator);
          if (metaObj.info.Producer) setMetaProducer(metaObj.info.Producer);
        }
      } catch (mErr) {
        console.warn('Post-save metadata sync skipped:', mErr);
      }
      const allThumbs = [];

      for (let i = 1; i <= count; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 0.4 });
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        await page.render({ canvasContext: context, viewport: viewport }).promise;
        allThumbs.push({
          num: i,
          url: canvas.toDataURL('image/jpeg', 0.8),
          rotation: 0,
          deleted: false,
          fileName: outputFilename || 'converted.pdf',
          pdfPageNum: i,
          isConverted: true
        });
      }

      setConvertedPageThumbnails(allThumbs);
      setPageThumbnails(allThumbs);
      setTotalPages(count);
      setLoadingPages(false);
      return allThumbs;
    } catch (err) {
      console.error('Failed to load converted PDF thumbnails:', err);
      setLoadingPages(false);
      return [];
    }
  };

  const renderModalPage = async (pageNum, scale = previewZoom) => {
    const canvas = document.getElementById('preview-canvas');
    const loading = document.getElementById('preview-loading');
    if (!canvas || !loading) return;

    canvas.style.display = 'none';
    loading.style.display = 'block';
    setCurrentPreviewPage(pageNum);

    try {
      let pageObj = null;

      if (previewPdfDoc && pageNum <= previewPdfDoc.numPages) {
        pageObj = await previewPdfDoc.getPage(pageNum);
      } else if (status !== 'completed' && convertedPageThumbnails.length === 0) {
        const thumb = pageThumbnails.find(t => t.num === pageNum);
        if (thumb && thumb.fileURL) {
          const pdf = await window.pdfjsLib.getDocument(thumb.fileURL).promise;
          pageObj = await pdf.getPage(thumb.pdfPageNum);
        }
      }

      if (pageObj) {
        const viewport = pageObj.getViewport({ scale: scale });
        const context = canvas.getContext('2d');
        const outputScale = window.devicePixelRatio || 1;

        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = Math.floor(viewport.width) + 'px';
        canvas.style.height = Math.floor(viewport.height) + 'px';

        const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
        await pageObj.render({ canvasContext: context, transform: transform, viewport: viewport }).promise;

        loading.style.display = 'none';
        canvas.style.display = 'block';
        return;
      }

      const thumb = pageThumbnails.find(t => t.num === pageNum) || convertedPageThumbnails.find(t => t.num === pageNum);
      if (thumb && thumb.url) {
        const img = new Image();
        img.onload = () => {
          const context = canvas.getContext('2d');
          canvas.width = img.width || 600;
          canvas.height = img.height || 800;
          canvas.style.width = '100%';
          canvas.style.height = 'auto';
          context.clearRect(0, 0, canvas.width, canvas.height);
          context.drawImage(img, 0, 0, canvas.width, canvas.height);
          loading.style.display = 'none';
          canvas.style.display = 'block';
        };
        img.onerror = () => {
          loading.innerHTML = '<p class="text-danger p-4">Failed to render page image</p>';
        };
        img.src = thumb.url;
        return;
      }

      loading.innerHTML = '<p class="text-danger p-4">No preview available</p>';
    } catch (err) {
      console.error('Modal render failed', err);
      loading.innerHTML = '<p class="text-danger p-4">Failed to render page preview</p>';
    }
  };

  const showPagePreview = async (pageNum) => {
    const modalEl = document.getElementById('previewModal');
    if (modalEl && window.bootstrap) {
      const modal = new window.bootstrap.Modal(modalEl);
      modal.show();
    }
    renderModalPage(pageNum, previewZoom);
  };

  const togglePageSelection = (pageNum) => {
    if (selectedPages.includes(pageNum)) {
      setSelectedPages(selectedPages.filter(p => p !== pageNum));
    } else {
      setSelectedPages([...selectedPages, pageNum].sort((a, b) => a - b));
    }
  };

  const pushHistory = (currentThumbs) => {
    setRotationHistory(prev => [...prev, currentThumbs.map(t => ({ num: t.num, rotation: t.rotation }))]);
    setRedoHistory([]);
  };

  const handlePageRotate = (pageNum, direction) => {
    pushHistory(pageThumbnails);
    setPageThumbnails(prev => prev.map(thumb => {
      if (thumb.num === pageNum) {
        const delta = direction === 'right' ? 90 : -90;
        return { ...thumb, rotation: (thumb.rotation + delta + 360) % 360 };
      }
      return thumb;
    }));
  };

  const handleBulkRotate = (action) => {
    pushHistory(pageThumbnails);
    setPageThumbnails(prev => prev.map(thumb => {
      const isTarget = selectedPages.length === 0 || selectedPages.includes(thumb.num);
      if (isTarget) {
        let newRot = thumb.rotation;
        if (action === 'reset') newRot = 0;
        else if (action === 'left') newRot = (thumb.rotation - 90 + 360) % 360;
        else if (action === 'right') newRot = (thumb.rotation + 90) % 360;
        else if (action === '180') newRot = (thumb.rotation + 180) % 360;
        return { ...thumb, rotation: newRot };
      }
      return thumb;
    }));
  };

  const handleUndo = () => {
    if (rotationHistory.length === 0) return;
    const previousState = rotationHistory[rotationHistory.length - 1];
    setRedoHistory(prev => [...prev, pageThumbnails.map(t => ({ num: t.num, rotation: t.rotation }))]);
    setRotationHistory(prev => prev.slice(0, -1));

    setPageThumbnails(prev => prev.map(thumb => {
      const saved = previousState.find(s => s.num === thumb.num);
      return saved ? { ...thumb, rotation: saved.rotation } : thumb;
    }));
  };

  const handleRedo = () => {
    if (redoHistory.length === 0) return;
    const nextState = redoHistory[redoHistory.length - 1];
    setRotationHistory(prev => [...prev, pageThumbnails.map(t => ({ num: t.num, rotation: t.rotation }))]);
    setRedoHistory(prev => prev.slice(0, -1));

    setPageThumbnails(prev => prev.map(thumb => {
      const saved = nextState.find(s => s.num === thumb.num);
      return saved ? { ...thumb, rotation: saved.rotation } : thumb;
    }));
  };

  const handleSelectAllToggle = () => {
    const validPages = pageThumbnails.filter(t => !t.deleted).map(t => t.num);
    if (selectedPages.length === validPages.length) {
      setSelectedPages([]);
    } else {
      setSelectedPages(validPages);
    }
  };

  const handlePageClick = (pageNum, event) => {
    if (event.shiftKey && lastSelectedPage !== null) {
      const start = Math.min(lastSelectedPage, pageNum);
      const end = Math.max(lastSelectedPage, pageNum);
      const range = Array.from({ length: end - start + 1 }, (_, i) => start + i);
      const combined = Array.from(new Set([...selectedPages, ...range])).sort((a, b) => a - b);
      setSelectedPages(combined);
    } else {
      togglePageSelection(pageNum);
      setLastSelectedPage(pageNum);
    }
  };

  const handlePageDelete = (pageNum) => {
    setPageThumbnails(pageThumbnails.map(thumb => {
      if (thumb.num === pageNum) {
        return { ...thumb, deleted: true };
      }
      return thumb;
    }));
  };

  const handleRemoveFile = (index) => {
    const updated = [...uploadedFiles];
    updated.splice(index, 1);
    setUploadedFiles(updated);

    if (updated.length === 0) {
      setPageThumbnails([]);
      setSelectedPages([]);
      setTotalPages(0);
    }
  };

  const handleRemoveAll = () => {
    setUploadedFiles([]);
    setPageThumbnails([]);
    setSelectedPages([]);
    setTotalPages(0);
  };

  const handleProcess = async () => {
    setStatus('processing');
    setProgressBarWidth(10);
    setStatusText('Connecting to engine...');

    const formData = new FormData();
    uploadedFiles.forEach(file => {
      formData.append('files', file);
    });

    // Populate common parameters
    if (password) formData.append('password', password);
    if (rotationAngle) formData.append('angle', rotationAngle);
    if (htmlContent) formData.append('html', htmlContent);
    if (signatureText) formData.append('signature', signatureText);
    
    // Watermark params
    if (toolSlug === 'watermark') {
      formData.append('wm_type', watermarkType);
      if (watermarkType === 'text') formData.append('watermark', watermarkText);
      if (watermarkType === 'image' && watermarkLogo) formData.append('logo', watermarkLogo);
    }

    // Edit PDF params
    if (toolSlug === 'edit-pdf') {
      formData.append('text', editText);
      formData.append('font_size', editFontSize);
      formData.append('color', editColor);
      if (editLogo) formData.append('logo', editLogo);
      formData.append('x_percent', editX);
      formData.append('y_percent', editY);
    }

    // Convert Image Format params
    if (toolSlug === 'convert-image-format') {
      formData.append('format', targetFormat);
    }

    // Resize Image params
    if (toolSlug === 'resize-image') {
      formData.append('width', resizeWidth);
      formData.append('height', resizeHeight);
    }

    // Crop Image params
    if (toolSlug === 'crop-image') {
      formData.append('left', cropLeft);
      formData.append('top', cropTop);
      formData.append('right', cropRight);
      formData.append('bottom', cropBottom);
    }

    // Compress Image params
    if (toolSlug === 'compress-image') {
      formData.append('quality', compressQuality);
    }

    // Redact PDF params
    if (toolSlug === 'redact-pdf') {
      formData.append('pattern', redactPattern);
      formData.append('preset_type', redactPreset);
      formData.append('fill_color', redactFillColor);
      formData.append('overlay_text', redactOverlayText);
    }

    // Header & Footer params
    if (toolSlug === 'header-footer') {
      formData.append('header_text', headerText);
      formData.append('footer_text', footerText);
    }

    // Crop PDF params
    if (toolSlug === 'crop-pdf') {
      formData.append('margin_top', cropMarginTop);
      formData.append('margin_bottom', cropMarginBottom);
      formData.append('margin_left', cropMarginLeft);
      formData.append('margin_right', cropMarginRight);
    }

    // Calculate ranges or reordering output values
    const nonDeletedThumbs = pageThumbnails.filter(t => !t.deleted);

    if (toolSlug === 'organize' || toolSlug === 'delete-pages' || toolSlug === 'rotate') {
      const order = nonDeletedThumbs.map(t => t.num).join(',');
      const angles = nonDeletedThumbs.map(t => t.rotation).join(',');
      formData.append('pdf-order', order);
      formData.append('pdf-angles', angles);
    }

    if (toolSlug === 'split' || toolSlug === 'extract-pages') {
      let rangeVal = '1-end';
      if (selectedPages.length > 0) {
        if (toolSlug === 'split') {
          // Construct part1 (selected range) and part2 (unselected range)
          const totalList = Array.from({ length: totalPages }, (_, i) => i + 1);
          const unselected = totalList.filter(x => !selectedPages.includes(x));

          const r1 = buildRangeString(selectedPages);
          const r2 = buildRangeString(unselected);
          rangeVal = r2 ? `${r1},${r2}` : r1;
        } else {
          rangeVal = buildRangeString(selectedPages).replace(/,/g, '&');
        }
      }
      formData.append('ranges', rangeVal);
    }

    try {
      const res = await axios.post(`/process/${toolSlug}/`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-CSRFToken': getCookie('csrftoken')
        }
      });
      const task_id = res.data.task_id;
      pollStatus(task_id);
    } catch (err) {
      setStatus('failed');
      setErrorMessage(err.response?.data?.error || 'An error occurred during file processing.');
    }
  };

  const handleInteractiveImageProcess = async (editorParams) => {
    setStatus('processing');
    setProgressBarWidth(10);
    setStatusText('Applying interactive image transformations...');

    const formData = new FormData();
    formData.append('files', uploadedFiles[0]);
    formData.append('left', editorParams.left);
    formData.append('top', editorParams.top);
    formData.append('right', editorParams.right);
    formData.append('bottom', editorParams.bottom);
    formData.append('width', editorParams.width);
    formData.append('height', editorParams.height);
    formData.append('angle', editorParams.angle);
    formData.append('flip_h', editorParams.flip_h);
    formData.append('flip_v', editorParams.flip_v);

    try {
      const res = await axios.post('/process/resize-image/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-CSRFToken': getCookie('csrftoken')
        }
      });
      const task_id = res.data.task_id;
      pollStatus(task_id);
    } catch (err) {
      setStatus('failed');
      setErrorMessage(err.response?.data?.error || 'An error occurred during image processing.');
    }
  };

  const handleInteractiveRedactProcess = async (payload) => {
    if (uploadedFiles.length === 0) return;
    setStatus('processing');
    setStatusText('Applying permanent redactions...');
    setProgressBarWidth(30);

    const formData = new FormData();
    formData.append('tool', toolSlug);
    formData.append('files', uploadedFiles[0]);
    formData.append('options', JSON.stringify({
      pattern: payload.text,
      overlay_text: payload.overlay_text,
      fill_color: payload.fill_color,
      text_color: payload.text_color,
      redaction_boxes: payload.redaction_boxes
    }));

    try {
      const res = await axios.post('/process/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-CSRFToken': getCookie('csrftoken')
        },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgressBarWidth(Math.min(90, percent));
        }
      });

      if (res.data.task_id) {
        pollStatus(res.data.task_id);
      } else {
        setProgressBarWidth(100);
        setStatusText('Redaction completed!');
        setTimeout(() => {
          setDownloadUrl(res.data.download_url);
          setOutputFilename(res.data.filename);
          setStatus('completed');
          if (res.data.download_url && res.data.download_url.toLowerCase().split('?')[0].endsWith('.pdf')) {
            loadConvertedPdfPreviews(res.data.download_url);
          }
        }, 500);
      }
    } catch (err) {
      console.error("Redaction processing failed:", err);
      setStatus('failed');
      setErrorMessage(err.response?.data?.error || "Redaction failed. Please try again.");
    }
  };

  const handleInteractiveCropProcess = async (cropParams) => {
    if (uploadedFiles.length === 0) return;
    setStatus('processing');
    setStatusText('Cropping PDF pages...');
    setProgressBarWidth(20);

    const formData = new FormData();
    formData.append('files', uploadedFiles[0]);
    formData.append('left', cropParams.left);
    formData.append('top', cropParams.top);
    formData.append('right', cropParams.right);
    formData.append('bottom', cropParams.bottom);
    formData.append('scope', cropParams.scope);
    formData.append('custom_range', cropParams.custom_range || '');
    formData.append('current_page', cropParams.current_page || 1);

    try {
      const res = await axios.post('/process/crop-pdf/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'X-CSRFToken': getCookie('csrftoken')
        },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setProgressBarWidth(Math.min(90, percent));
        }
      });
      const task_id = res.data.task_id;
      pollStatus(task_id);
    } catch (err) {
      console.error("PDF crop processing failed:", err);
      setStatus('failed');
      setErrorMessage(err.response?.data?.error || "PDF cropping failed. Please try again.");
    }
  };

  const buildRangeString = (pagesList) => {
    if (pagesList.length === 0) return '';
    pagesList.sort((a, b) => a - b);
    const ranges = [];
    let start = pagesList[0];
    let prev = start;

    for (let i = 1; i < pagesList.length; i++) {
      if (pagesList[i] === prev + 1) {
        prev = pagesList[i];
      } else {
        ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
        start = pagesList[i];
        prev = start;
      }
    }
    ranges.push(start === prev ? `${start}` : `${start}-${prev}`);
    return ranges.join(',');
  };

  const getSplitPreviewNames = () => {
    let rangeVal = '1-end';
    if (selectedPages.length > 0) {
      const totalList = Array.from({ length: totalPages }, (_, i) => i + 1);
      const unselected = totalList.filter(x => !selectedPages.includes(x));
      const r1 = buildRangeString(selectedPages);
      const r2 = buildRangeString(unselected);
      rangeVal = r2 ? `${r1},${r2}` : r1;
    }

    if (!rangeVal || rangeVal === '1-end') {
      return totalPages > 1 ? [`Pages 1 to ${totalPages || 'end'}.pdf`] : ['Page 1.pdf'];
    }

    const groups = rangeVal.split(',').map(s => s.trim()).filter(Boolean);
    return groups.map(r_str => {
      const parts = r_str.split('&').map(s => s.trim()).filter(Boolean);
      let isSinglePage = true;
      const cleanedParts = parts.map(part => {
        if (part.includes('-')) {
          const [startStr, endStr] = part.split('-').map(s => s.trim());
          const endVal = endStr.toLowerCase() === 'end' ? (totalPages || 'end') : endStr;
          if (startStr !== endVal) {
            isSinglePage = false;
            return `${startStr} to ${endVal}`;
          }
          return `${startStr}`;
        }
        return part;
      });

      if (parts.length > 1) isSinglePage = false;
      const rangeText = cleanedParts.join(' & ');
      return isSinglePage ? `Page ${rangeText}.pdf` : `Pages ${rangeText}.pdf`;
    });
  };

  const pollStatus = (taskId) => {
    let progress = 20;
    const interval = setInterval(async () => {
      try {
        const res = await axios.get(`/status/${taskId}/`);
        const serverStatus = res.data.status;
        
        if (serverStatus === 'processing') {
          progress = Math.min(progress + 15, 90);
          setProgressBarWidth(progress);
          setStatusText('Processing document options...');
        } else if (serverStatus === 'completed') {
          clearInterval(interval);
          setProgressBarWidth(100);
          setStatusText('Conversion completed!');
          
          let dlUrl = res.data.download_url || '';
          if (dlUrl && !dlUrl.startsWith('http')) {
            const base = (axios.defaults.baseURL || 'https://pdf-tools-1-zr56.onrender.com').replace(/\/+$/, '');
            dlUrl = `${base}${dlUrl.startsWith('/') ? '' : '/'}${dlUrl}`;
          }
          const outName = res.data.filename || 'converted.pdf';
          
          setDownloadUrl(dlUrl);
          setOutputFilename(outName);
          setStatus('completed');

          if (dlUrl) {
            try {
              const isPdfOutput = dlUrl.toLowerCase().split('?')[0].endsWith('.pdf') || (res.data.file_type === 'pdf') || !dlUrl.match(/\.(zip|jpg|jpeg|png|json|docx|xlsx|pptx)$/i);
              if (isPdfOutput && window.pdfjsLib) {
                loadConvertedPdfPreviews(dlUrl);
              }
            } catch (previewErr) {
              console.warn("Client preview generation skipped:", previewErr);
            }
          }
        } else if (serverStatus === 'failed') {
          clearInterval(interval);
          setStatus('failed');
          setErrorMessage(res.data.error || 'The PDF engine failed to convert the files.');
        }
      } catch (err) {
        console.warn('Status poll warning:', err);
      }
    }, 1000);
  };

  return (
    <div className="container py-5">
      <div className="row justify-content-center">
        <div className="col-lg-10">
          <div className="text-center mb-5" data-aos="zoom-in">
            <span className="badge bg-primary-subtle text-primary rounded-pill px-3 py-2 mb-3">
              {tool.cat.toUpperCase()}
            </span>
            <h1 className="display-4 fw-bold mb-3">{tool.name}</h1>

            <div className="mb-4">
              {user?.is_pro ? (
                <span className="badge bg-warning-subtle text-warning border border-warning px-3 py-2 rounded-pill fw-bold">
                  <i className="bi bi-star-fill me-1"></i> PRO MEMBER ({user?.days_left} Days Remaining)
                </span>
              ) : (
                <span className="badge bg-light text-muted border px-3 py-2 rounded-pill">
                  <i className="bi bi-person me-1"></i> FREE ACCOUNT —{' '}
                  <Link to="/accounts/pricing" className="text-primary text-decoration-none">
                    Upgrade to PRO
                  </Link>
                </span>
              )}
            </div>

            <p className="text-muted lead mx-auto" style={{ maxWidth: '700px' }}>
              {tool.desc}
            </p>
          </div>

          {status === 'idle' && (
            <>
              {/* Global File Upload Component */}
              <GlobalFileUpload
                toolSlug={toolSlug}
                uploadedFiles={uploadedFiles}
                onFilesAdd={handleFiles}
                onFileRemove={handleRemoveFile}
                onRemoveAll={handleRemoveAll}
                disabled={status !== 'idle'}
              />

              {/* Options Panel */}
              {uploadedFiles.length > 0 && (
                <div id="options-panel" className="card border-0 shadow-sm p-4 p-md-5 mb-5 rounded-4 animate__animated animate__fade-in">
                  <div className="d-flex align-items-center mb-4 pb-3 border-bottom">
                    <div className="bg-primary-subtle p-2 rounded-3 me-3">
                      <i className={`bi ${tool.icon} text-primary fs-4`}></i>
                    </div>
                    <h2 className="h5 mb-0 fw-bold">Configure {tool.name}</h2>
                  </div>

                  <div id="tool-options" className="mb-4">
                    {toolSlug === 'protect' && (
                      <div className="form-group mb-3">
                        <label className="form-label fw-semibold">Set Password</label>
                        <input
                          type="password"
                          className="form-control form-control-lg"
                          placeholder="Enter a secure password..."
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                      </div>
                    )}

                    {(toolSlug === 'split' || toolSlug === 'extract-pages') && (
                      <div className="form-group mb-3">
                        <label className="form-label fw-semibold">Page Range</label>
                        <input
                          type="text"
                          className="form-control form-control-lg"
                          value={selectedPages.length > 0 ? buildRangeString(selectedPages) : '1-end'}
                          readOnly
                        />
                        <div className="form-text mt-2">Select pages from the grid below.</div>

                        {toolSlug === 'split' && (
                          <div className="mt-4 p-3 bg-light rounded-3 border">
                            <div className="small fw-bold text-dark mb-2">
                              <i className="bi bi-file-earmark-zip me-1 text-primary"></i> Generated Output PDF Names:
                            </div>
                            <div className="d-flex flex-column gap-1">
                              {getSplitPreviewNames().map((fileName, i) => (
                                <div key={i} className="small text-secondary d-flex align-items-center">
                                  <i className="bi bi-file-earmark-pdf text-danger me-2"></i>
                                  <span>📄 {fileName}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {toolSlug === 'rotate' && (
                      <div className="alert alert-info border-0 shadow-xs rounded-4 p-4 mb-0">
                        <div className="d-flex align-items-center">
                          <div className="bg-info-subtle text-info p-3 rounded-circle me-3 flex-shrink-0">
                            <i className="bi bi-arrow-repeat fs-3"></i>
                          </div>
                          <div>
                            <h6 className="fw-bold text-dark mb-1">Interactive Page Rotation Stage</h6>
                            <p className="small text-muted mb-0">
                              Use the page grid below to rotate individual pages using <strong>↺</strong> and <strong>↻</strong>, or use the quick action bar above the page grid to rotate multiple pages at once. Click <strong>Rotate PDF</strong> when ready.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {toolSlug === 'watermark' && (
                      <div className="row g-4">
                        <div className="col-md-6">
                          <div className="form-group">
                            <label className="form-label fw-semibold">Watermark Type</label>
                            <select
                              className="form-select form-select-lg"
                              value={watermarkType}
                              onChange={(e) => setWatermarkType(e.target.value)}
                            >
                              <option value="text">Text Overlay</option>
                              <option value="image">Image Logo</option>
                            </select>
                          </div>
                        </div>
                        {watermarkType === 'text' ? (
                          <div className="col-md-6">
                            <div className="form-group">
                              <label className="form-label fw-semibold">Watermark Text</label>
                              <input
                                type="text"
                                className="form-control form-control-lg"
                                value={watermarkText}
                                onChange={(e) => setWatermarkText(e.target.value)}
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="col-md-6">
                            <div className="form-group">
                              <label className="form-label fw-semibold">Select Image (PNG/JPG)</label>
                              <input
                                type="file"
                                className="form-control form-control-lg"
                                accept="image/*"
                                onChange={(e) => setWatermarkLogo(e.target.files[0])}
                              />
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {(toolSlug === 'organize' || toolSlug === 'delete-pages') && (
                      <div className="form-group mb-3">
                        <label className="form-label fw-semibold">Manage Pages</label>
                        <p className="small text-muted mb-3">
                          Drag to reorder, use icons to rotate or delete specific pages.
                        </p>
                      </div>
                    )}

                    {(toolSlug === 'html-to-pdf' || toolSlug === 'html-to-image') && (
                      <div className="form-group mb-3">
                        <label className="form-label fw-semibold">HTML Content</label>
                        <textarea
                          className="form-control form-control-lg"
                          rows="6"
                          placeholder="Enter HTML code or a URL to convert..."
                          value={htmlContent}
                          onChange={(e) => setHtmlContent(e.target.value)}
                        />
                      </div>
                    )}

                    {toolSlug === 'sign-pdf' && (
                      <div className="form-group mb-3">
                        <label className="form-label fw-semibold">Signature Text</label>
                        <input
                          type="text"
                          className="form-control form-control-lg"
                          placeholder="Enter your name to sign..."
                          value={signatureText}
                          onChange={(e) => setSignatureText(e.target.value)}
                        />
                      </div>
                    )}

                    {toolSlug === 'convert-image-format' && (
                      <div className="form-group mb-3">
                        <label className="form-label fw-semibold fs-5 mb-3">Select Output Image Format</label>
                        <div className="row g-2 mb-3">
                          {[
                            { id: 'png', label: 'PNG', desc: 'Lossless' },
                            { id: 'jpg', label: 'JPG', desc: 'Standard' },
                            { id: 'webp', label: 'WEBP', desc: 'Web Optimized' },
                            { id: 'bmp', label: 'BMP', desc: 'Bitmap' },
                            { id: 'tiff', label: 'TIFF', desc: 'Print Quality' },
                            { id: 'gif', label: 'GIF', desc: 'Graphics' }
                          ].map((fmt) => (
                            <div key={fmt.id} className="col-6 col-md-4">
                              <button
                                type="button"
                                className={`btn w-100 py-3 text-start border rounded-3 transition-all ${
                                  targetFormat === fmt.id
                                    ? 'btn-primary shadow-sm'
                                    : 'btn-outline-light text-dark bg-white'
                                }`}
                                onClick={() => setTargetFormat(fmt.id)}
                              >
                                <div className="fw-bold text-uppercase">{fmt.label}</div>
                                <div className="small opacity-75">{fmt.desc}</div>
                              </button>
                            </div>
                          ))}
                        </div>
                        <label className="form-label fw-semibold">Format Dropdown</label>
                        <select
                          className="form-select form-select-lg"
                          value={targetFormat}
                          onChange={(e) => setTargetFormat(e.target.value)}
                        >
                          <option value="png">PNG (.png) - Portable Network Graphics (Lossless Transparency)</option>
                          <option value="jpg">JPG / JPEG (.jpg) - Joint Photographic Experts Group (Compressed)</option>
                          <option value="webp">WEBP (.webp) - Modern High Efficiency Web Image</option>
                          <option value="bmp">BMP (.bmp) - Uncompressed Windows Bitmap</option>
                          <option value="tiff">TIFF (.tiff) - High Quality Tagged Image File Format</option>
                          <option value="gif">GIF (.gif) - Graphics Interchange Format</option>
                        </select>
                      </div>
                    )}

                    {(toolSlug === 'resize-image' || toolSlug === 'crop-image') && uploadedFiles.length > 0 && (
                      <InteractiveImageEditor
                        imageFile={uploadedFiles[0]}
                        onProcess={handleInteractiveImageProcess}
                        processing={status === 'processing'}
                        statusText={statusText}
                        progressBarWidth={progressBarWidth}
                      />
                    )}

                    {toolSlug === 'compress-image' && (
                      <div className="form-group mb-3">
                        <div className="d-flex justify-content-between align-items-center mb-2">
                          <label className="form-label fw-semibold mb-0">Compression Quality</label>
                          <span className="badge bg-primary fs-6">{compressQuality}%</span>
                        </div>
                        <input
                          type="range"
                          className="form-range"
                          min="10"
                          max="100"
                          step="5"
                          value={compressQuality}
                          onChange={(e) => setCompressQuality(e.target.value)}
                        />
                      </div>
                    )}

                    {toolSlug === 'redact-pdf' && uploadedFiles.length > 0 && (
                      <InteractivePdfRedactor
                        pdfFile={uploadedFiles[0]}
                        onProcess={handleInteractiveRedactProcess}
                        processing={status === 'processing'}
                        statusText={statusText}
                        progressBarWidth={progressBarWidth}
                      />
                    )}

                    {toolSlug === 'header-footer' && (
                      <div className="row g-3">
                        <div className="col-md-6">
                          <label className="form-label fw-semibold">Header Text</label>
                          <input
                            type="text"
                            className="form-control form-control-lg"
                            placeholder="Enter header text..."
                            value={headerText}
                            onChange={(e) => setHeaderText(e.target.value)}
                          />
                        </div>
                        <div className="col-md-6">
                          <label className="form-label fw-semibold">Footer Text</label>
                          <input
                            type="text"
                            className="form-control form-control-lg"
                            placeholder="Enter footer text..."
                            value={footerText}
                            onChange={(e) => setFooterText(e.target.value)}
                          />
                        </div>
                      </div>
                    )}

                    {toolSlug === 'crop-pdf' && uploadedFiles.length > 0 && (
                      <InteractivePdfCropper
                        pdfFile={uploadedFiles[0]}
                        onProcess={handleInteractiveCropProcess}
                        processing={status === 'processing'}
                        statusText={statusText}
                        progressBarWidth={progressBarWidth}
                      />
                    )}





                    {toolSlug === 'remove-blank-pages' && (
                      <div className="alert alert-warning border-0 rounded-4 p-4 mb-0">
                        <i className="bi bi-magic me-2"></i> Auto-Detection Active: Blank pages will be automatically detected and removed during processing.
                      </div>
                    )}

                    {toolSlug === 'reverse-page-order' && (
                      <div className="alert alert-info border-0 rounded-4 p-4 mb-0">
                        <i className="bi bi-arrow-down-up me-2"></i> Reverse Order Stage: Page sequence will be inverted from last page to first page.
                      </div>
                    )}

                    {toolSlug === 'duplicate-pages' && (
                      <div className="alert alert-secondary border-0 rounded-4 p-4 mb-0">
                        <i className="bi bi-files me-2"></i> Select pages in the grid below to duplicate them in the output PDF.
                      </div>
                    )}

                    {toolSlug === 'extract-images' && (
                      <div className="alert alert-success border-0 rounded-4 p-4 mb-0">
                        <i className="bi bi-file-earmark-image-fill me-2"></i> Embedded Image Extractor: Scans PDF pages and packages all embedded raster images into a download bundle.
                      </div>
                    )}

                    {toolSlug === 'pdf-to-png' && (
                      <div className="alert alert-dark border-0 rounded-4 p-4 mb-0 text-white">
                        <i className="bi bi-filetype-png me-2"></i> PNG High-DPI Export: Converts PDF pages into lossless PNG images (300 DPI).
                      </div>
                    )}

                    {toolSlug === 'flatten-pdf' && (
                      <div className="alert alert-secondary border-0 rounded-4 p-4 mb-0">
                        <i className="bi bi-layers-half me-2"></i> Flatten PDF Engine: Converts annotations, text layers, and form fields into static PDF content.
                      </div>
                    )}

                    {toolSlug === 'pdf-thumbnail-viewer' && (
                      <div className="alert alert-info border-0 rounded-4 p-4 mb-0">
                        <i className="bi bi-grid-fill me-2"></i> High-Resolution Thumbnail Grid: View and inspect all page previews below.
                      </div>
                    )}
                  </div>

                  {/* Page Selector Grid */}
                  {pageThumbnails.length > 0 && (
                    <div id="page-selector-container" className="mt-4">
                      <div className="d-flex align-items-center justify-content-between mb-3">
                        <h5 className="fw-bold mb-0">
                          {toolSlug === 'rotate' ? 'Interactive Page Rotation Stage' : 'Select Pages'}
                        </h5>
                        {toolSlug === 'rotate' && (
                          <span className="small text-muted fw-semibold d-none d-md-inline">
                            Tip: Press <strong>Ctrl+Z</strong> to Undo, <strong>Ctrl+Y</strong> to Redo. Hold <strong>Shift</strong> to select range.
                          </span>
                        )}
                      </div>

                      {/* Quick Action Toolbar for Rotate Tool */}
                      {toolSlug === 'rotate' && (
                        <div className="card border-0 shadow-xs rounded-4 p-3 mb-4 bg-white animate__animated animate__fadeIn">
                          <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary rounded-pill px-3 fw-semibold d-inline-flex align-items-center gap-1"
                                onClick={handleSelectAllToggle}
                              >
                                <i className={`bi ${selectedPages.length === totalPages ? 'bi-dash-square' : 'bi-check2-square'}`}></i>
                                {selectedPages.length === totalPages ? 'Deselect All' : 'Select All'}
                              </button>

                              <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-3 py-1.5 fw-bold">
                                {selectedPages.length > 0 ? `${selectedPages.length} Selected` : 'All Pages Selected'}
                              </span>

                              <div className="vr mx-1 d-none d-sm-block"></div>

                              <button
                                type="button"
                                className="btn btn-sm btn-light border rounded-pill px-2.5 fw-semibold"
                                onClick={handleUndo}
                                disabled={rotationHistory.length === 0}
                                title="Undo Rotation (Ctrl+Z)"
                              >
                                <i className="bi bi-arrow-counterclockwise me-1"></i> Undo
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm btn-light border rounded-pill px-2.5 fw-semibold"
                                onClick={handleRedo}
                                disabled={redoHistory.length === 0}
                                title="Redo Rotation (Ctrl+Y)"
                              >
                                <i className="bi bi-arrow-clockwise me-1"></i> Redo
                              </button>
                            </div>

                            <div className="d-flex align-items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold d-inline-flex align-items-center gap-1"
                                onClick={() => handleBulkRotate('left')}
                                title="Rotate Left (-90°)"
                              >
                                <i className="bi bi-arrow-counterclockwise fs-6"></i> Rotate Left (↺)
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-bold d-inline-flex align-items-center gap-1"
                                onClick={() => handleBulkRotate('right')}
                                title="Rotate Right (+90°)"
                              >
                                <i className="bi bi-arrow-clockwise fs-6"></i> Rotate Right (↻)
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary rounded-pill px-3 fw-semibold d-inline-flex align-items-center gap-1"
                                onClick={() => handleBulkRotate('180')}
                                title="Rotate 180°"
                              >
                                <i className="bi bi-arrow-repeat fs-6"></i> 180°
                              </button>

                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger rounded-pill px-3 fw-semibold d-inline-flex align-items-center gap-1"
                                onClick={() => handleBulkRotate('reset')}
                                title="Reset All Rotations"
                              >
                                <i className="bi bi-x-circle fs-6"></i> Reset
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {loadingPages ? (
                        <div className="text-center py-4">
                          <div className="spinner-border text-info"></div>
                          <p className="mt-2 small text-secondary">LOADING THUMBNAILS...</p>
                        </div>
                      ) : (
                        <div id="page-grid" className="row g-3" ref={pageGridRef}>
                          {pageThumbnails.map((thumb) => {
                            if (thumb.deleted) return null;
                            const isSelected = selectedPages.includes(thumb.num);

                            return (
                              <div
                                key={thumb.num}
                                className={`${toolSlug === 'rotate' ? 'col-6 col-sm-4 col-md-3 col-lg-2' : 'col-12 col-sm-6 col-md-4 col-lg-3'} page-node`}
                                data-page-num={thumb.num}
                              >
                                <div
                                  className={`page-card ${isSelected ? 'selected' : ''}`}
                                  style={{
                                    backgroundImage: `url(${thumb.url})`,
                                    transform: `rotate(${thumb.rotation}deg)`,
                                    backgroundSize: 'cover',
                                    backgroundPosition: 'center',
                                    aspectRatio: '1/1.4',
                                    position: 'relative',
                                    borderRadius: '12px',
                                    cursor: 'pointer'
                                  }}
                                  onClick={(e) => handlePageClick(thumb.num, e)}
                                >
                                  {/* Rotation Angle Badge */}
                                  <span
                                    className="badge bg-dark text-white rounded-pill position-absolute top-0 start-0 m-2 px-2.5 py-1 small opacity-85 shadow-xs"
                                    style={{ zIndex: 12 }}
                                  >
                                    {thumb.rotation}°
                                  </span>

                                  <div className="page-controls">
                                    <i
                                      className="bi bi-arrow-counterclockwise control-btn"
                                      title="Rotate Left (-90°)"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePageRotate(thumb.num, 'left');
                                      }}
                                    ></i>
                                    <i
                                      className="bi bi-arrow-clockwise control-btn"
                                      title="Rotate Right (+90°)"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handlePageRotate(thumb.num, 'right');
                                      }}
                                    ></i>
                                    <i
                                      className="bi bi-eye control-btn view-btn"
                                      title="View Page"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        showPagePreview(thumb.num);
                                      }}
                                    ></i>
                                    {(toolSlug === 'organize' || toolSlug === 'delete-pages') && (
                                      <i
                                        className="bi bi-trash control-btn btn-delete"
                                        title="Delete Page"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handlePageDelete(thumb.num);
                                        }}
                                      ></i>
                                    )}
                                  </div>
                                  <span className="page-number">{thumb.num}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {toolSlug !== 'resize-image' && toolSlug !== 'crop-image' && toolSlug !== 'redact-pdf' && toolSlug !== 'crop-pdf' && (
                    <div className="d-grid mt-5">
                      <DynamicActionButton
                        toolSlug={toolSlug}
                        status={status}
                        statusText={statusText}
                        disabled={uploadedFiles.length === 0}
                        onClick={handleProcess}
                        className="w-100 py-3"
                      />
                    </div>
                  )}
                </div>
              )}
            </>
          )}

          {/* Progress State */}
          {status === 'processing' && (
            <div id="progress-container" className="mt-5 text-center py-5">
              <div className="mb-5">
                <div className="spinner-grow text-primary mb-3" style={{ width: '3rem', height: '3rem' }} role="status"></div>
                <h3 className="fw-bold">Processing Your File</h3>
                <p className="text-muted">Please wait while we handle the heavy lifting...</p>
              </div>
              <div className="progress mx-auto" style={{ height: '10px', maxWidth: '400px', borderRadius: '5px' }}>
                <div
                  className="progress-bar progress-bar-striped progress-bar-animated bg-primary"
                  role="progressbar"
                  style={{ width: `${progressBarWidth}%` }}
                ></div>
              </div>
              <div className="mt-4">
                <span className="text-primary fw-semibold fw-bold">{statusText}</span>
              </div>
            </div>
          )}

          {/* Failed State */}
          {status === 'failed' && (
            <div className="mt-5 text-center py-5">
              <div className="alert alert-danger mx-auto" style={{ maxWidth: '600px' }}>
                <i className="bi bi-exclamation-triangle-fill me-2 fs-4"></i>
                <h4 className="fw-bold mt-2">Processing Failed</h4>
                <p>{errorMessage}</p>
              </div>
              <button className="btn btn-outline-secondary rounded-pill px-4 py-2 mt-3" onClick={() => setStatus('idle')}>
                Try Again
              </button>
            </div>
          )}

          {/* Result State */}
          {status === 'completed' && (
            <div id="result-container" className="mt-5 text-center">
              <div className="card border-0 shadow-lg p-5 rounded-4 animate__animated animate__zoomIn bg-white overflow-hidden position-relative">
                <div className="position-absolute top-0 end-0 p-5 opacity-10">
                  <i className="bi bi-file-earmark-check display-1"></i>
                </div>

                <div className="mb-4">
                  <div className="bg-success-subtle d-inline-block p-4 rounded-circle mb-4 shadow-sm border border-success-subtle">
                    <i className="bi bi-check2-all display-3 text-success"></i>
                  </div>
                </div>

                <h2 className="fw-bold mb-2">Wonderful!</h2>
                <p className="text-muted mb-4 lead">Your document is processed and ready.</p>

                {toolSlug === 'split' && (
                  <div className="card border-0 bg-light p-4 rounded-4 mb-4 text-start mx-auto shadow-xs" style={{ maxWidth: '540px' }}>
                    <h6 className="fw-bold mb-3 text-dark d-flex align-items-center">
                      <i className="bi bi-file-earmark-pdf-fill me-2 text-danger fs-5"></i>
                      Generated Output Files:
                    </h6>
                    <div className="d-flex flex-column gap-2">
                      {getSplitPreviewNames().map((fileName, i) => (
                        <div key={i} className="p-2.5 bg-white border rounded-3 small fw-semibold text-dark d-flex align-items-center justify-content-between">
                          <span className="d-flex align-items-center">
                            <i className="bi bi-file-earmark-pdf text-danger me-2 fs-5"></i>
                            📄 {fileName}
                          </span>
                          <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2.5 py-1">
                            Ready
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Converted Document Page Previews Grid */}
                {convertedPageThumbnails.length > 0 && (
                  <div className="card border-0 bg-light p-4 rounded-4 mb-4 text-start mx-auto shadow-xs" style={{ maxWidth: '800px' }}>
                    <div className="d-flex align-items-center justify-content-between mb-3">
                      <h6 className="fw-bold mb-0 text-dark d-flex align-items-center">
                        <i className="bi bi-grid-3x3-gap-fill me-2 text-primary fs-5"></i>
                        Converted PDF Page Previews ({convertedPageThumbnails.length} {convertedPageThumbnails.length === 1 ? 'Page' : 'Pages'}):
                      </h6>
                      <span className="badge bg-primary-subtle text-primary border border-primary-subtle rounded-pill px-3 py-1 fw-bold">
                        High Resolution Preview
                      </span>
                    </div>

                    <div className="row g-3">
                      {convertedPageThumbnails.map((thumb) => (
                        <div key={thumb.num} className="col-6 col-sm-4 col-md-3">
                          <div
                            className="page-card shadow-sm hover-bg-light"
                            style={{
                              backgroundImage: `url(${thumb.url})`,
                              backgroundSize: 'cover',
                              backgroundPosition: 'center',
                              aspectRatio: '1/1.4',
                              position: 'relative',
                              borderRadius: '12px',
                              cursor: 'pointer'
                            }}
                            onClick={() => {
                              showPagePreview(thumb.num);
                            }}
                          >
                            <span className="page-number">{thumb.num}</span>
                            <div className="page-controls">
                              <i
                                className="bi bi-eye control-btn view-btn fs-5 text-primary"
                                title="Click to View Full-Page Preview"
                              ></i>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="d-flex flex-column flex-sm-row gap-3 justify-content-center align-items-center">
                  <a
                    id="downloadLink"
                    href={downloadUrl}
                    className="btn btn-premium-download rounded-pill px-4 py-2.5 fw-bold shadow-sm"
                    download={outputFilename}
                  >
                    <i className="bi bi-cloud-arrow-down-fill me-2"></i> Download file
                  </a>
                  <button
                    className="btn btn-outline-secondary rounded-pill px-4 py-2.5 fw-semibold border-2 transition-all"
                    onClick={() => {
                      setUploadedFiles([]);
                      setPageThumbnails([]);
                      setSelectedPages([]);
                      setStatus('idle');
                    }}
                  >
                    <i className="bi bi-arrow-counterclockwise me-2"></i> Convert Another
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Tutorial Section */}
          <div id="tutorial-section" className="mt-5 pt-5 border-top border-light" data-aos="fade-up">
            <div className="d-flex align-items-center mb-5">
              <div className="bg-primary p-2 rounded-3 me-3">
                <i className="bi bi-info-circle text-white fs-4"></i>
              </div>
              <div>
                <h2 className="h4 mb-0 fw-bold">How to use this tool</h2>
                <p className="text-muted small mb-0">Follow these simple steps</p>
              </div>
            </div>

            <div className="row g-4">
              <div className="col-md-3">
                <div className="card h-100 border-0 bg-white p-4 text-center rounded-4 shadow-sm">
                  <div
                    className="bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                    style={{ width: '50px', height: '50px' }}
                  >
                    <i className="bi bi-upload fs-4"></i>
                  </div>
                  <h5 className="fw-bold h6">1. Upload</h5>
                  <p className="small text-muted mb-0">Drag and drop or select your PDF files.</p>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card h-100 border-0 bg-white p-4 text-center rounded-4 shadow-sm">
                  <div
                    className="bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                    style={{ width: '50px', height: '50px' }}
                  >
                    <i className="bi bi-gear fs-4"></i>
                  </div>
                  <h5 className="fw-bold h6">2. Configure</h5>
                  <p className="small text-muted mb-0">Set ranges, passwords, or other options.</p>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card h-100 border-0 bg-white p-4 text-center rounded-4 shadow-sm">
                  <div
                    className="bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                    style={{ width: '50px', height: '50px' }}
                  >
                    <i className="bi bi-cpu fs-4"></i>
                  </div>
                  <h5 className="fw-bold h6">3. Process</h5>
                  <p className="small text-muted mb-0">Click process and wait for the conversion.</p>
                </div>
              </div>
              <div className="col-md-3">
                <div className="card h-100 border-0 bg-white p-4 text-center rounded-4 shadow-sm">
                  <div
                    className="bg-primary-subtle text-primary rounded-circle d-flex align-items-center justify-content-center mx-auto mb-3"
                    style={{ width: '50px', height: '50px' }}
                  >
                    <i className="bi bi-download fs-4"></i>
                  </div>
                  <h5 className="fw-bold h6">4. Download</h5>
                  <p className="small text-muted mb-0">Save the processed files to your device.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Page Preview Modal */}
      <div className="modal fade" id="previewModal" tabIndex="-1" aria-hidden="true">
        <div className="modal-dialog modal-xl modal-dialog-centered">
          <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
            <div className="modal-header bg-dark text-white p-3 d-flex align-items-center justify-content-between">
              <h5 className="modal-title h6 fw-bold mb-0 text-white d-flex align-items-center gap-2">
                <i className="bi bi-file-earmark-pdf-fill text-danger fs-5"></i>
                Document Page Viewer
              </h5>

              <div className="d-flex align-items-center gap-2">
                {/* Zoom Controls */}
                <div className="btn-group btn-group-sm bg-secondary bg-opacity-25 rounded-pill p-1">
                  <button
                    className="btn btn-outline-light border-0 rounded-circle py-1 px-2"
                    title="Zoom Out (-)"
                    onClick={() => {
                      const newZoom = Math.max(0.75, previewZoom - 0.25);
                      setPreviewZoom(newZoom);
                      renderModalPage(currentPreviewPage, newZoom);
                    }}
                  >
                    <i className="bi bi-zoom-out"></i>
                  </button>
                  <span className="text-white px-2 small align-self-center fw-bold">
                    {Math.round(previewZoom * 100)}%
                  </span>
                  <button
                    className="btn btn-outline-light border-0 rounded-circle py-1 px-2"
                    title="Zoom In (+)"
                    onClick={() => {
                      const newZoom = Math.min(3.0, previewZoom + 0.25);
                      setPreviewZoom(newZoom);
                      renderModalPage(currentPreviewPage, newZoom);
                    }}
                  >
                    <i className="bi bi-zoom-in"></i>
                  </button>
                  <button
                    className="btn btn-outline-light border-0 rounded-pill px-2 small"
                    title="Fit Width"
                    onClick={() => {
                      setPreviewZoom(1.25);
                      renderModalPage(currentPreviewPage, 1.25);
                    }}
                  >
                    Fit Width
                  </button>
                </div>

                {/* Page Navigation Controls */}
                {totalPages > 1 && (
                  <div className="d-flex align-items-center gap-1 bg-secondary bg-opacity-25 rounded-pill px-2 py-1">
                    <button
                      className="btn btn-outline-light btn-sm border-0 py-0 px-2"
                      disabled={currentPreviewPage <= 1}
                      onClick={() => {
                        const prevP = Math.max(1, currentPreviewPage - 1);
                        renderModalPage(prevP, previewZoom);
                      }}
                    >
                      <i className="bi bi-chevron-left"></i>
                    </button>
                    <span className="text-white small fw-bold px-1">
                      {currentPreviewPage} / {totalPages}
                    </span>
                    <button
                      className="btn btn-outline-light btn-sm border-0 py-0 px-2"
                      disabled={currentPreviewPage >= totalPages}
                      onClick={() => {
                        const nextP = Math.min(totalPages, currentPreviewPage + 1);
                        renderModalPage(nextP, previewZoom);
                      }}
                    >
                      <i className="bi bi-chevron-right"></i>
                    </button>
                  </div>
                )}

                <button
                  type="button"
                  className="btn-close btn-close-white ms-2"
                  data-bs-dismiss="modal"
                  aria-label="Close"
                ></button>
              </div>
            </div>

            <div className="modal-body p-4 bg-secondary bg-opacity-10 text-center overflow-auto position-relative" style={{ maxHeight: '75vh' }}>
              <div id="preview-loading" className="py-5">
                <div className="spinner-border text-primary"></div>
                <p className="mt-2 text-muted fw-semibold">Rendering high-resolution page...</p>
              </div>
              <canvas id="preview-canvas" className="shadow-sm rounded-3 bg-white mx-auto d-block"></canvas>
            </div>
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .border-dashed {
            border: 2px dashed #cbd5e1;
            transition: all 0.2s ease;
        }
        .border-dashed:hover {
            border-color: #4f46e5;
            background: #f8fafc;
        }
        .page-card {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            transition: all 0.2s;
            position: relative;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }
        .page-card:hover {
            border-color: #4f46e5;
            transform: translateY(-5px);
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        .page-card.selected {
            border-color: #4f46e5 !important;
            border-width: 2px;
        }
        .page-card.selected::after {
            content: '\\F272';
            font-family: 'bootstrap-icons';
            position: absolute;
            top: 8px;
            right: 8px;
            color: white;
            background: #4f46e5;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            font-size: 0.9rem;
            z-index: 15;
        }
        .page-card .page-controls {
            position: absolute;
            bottom: 0;
            left: 0;
            right: 0;
            background: rgba(255, 255, 255, 0.9);
            display: flex;
            justify-content: space-around;
            padding: 12px;
            opacity: 0;
            transition: 0.2s;
            z-index: 10;
            border-top: 1px solid #e2e8f0;
        }
        .page-card:hover .page-controls {
            opacity: 1;
        }
        .control-btn {
            color: #64748b;
            cursor: pointer;
            padding: 4px;
            border-radius: 6px;
            transition: 0.2s;
        }
        .control-btn:hover {
            color: #4f46e5;
            background: #f1f5f9;
        }
        .page-number {
            position: absolute;
            top: 8px;
            left: 8px;
            font-weight: 700;
            color: #1e293b;
            font-size: 0.9rem;
            background: rgba(255, 255, 255, 0.95);
            padding: 4px 10px;
            border-radius: 6px;
            pointer-events: none;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
        }
        .btn-premium-download {
            background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
            border: none;
            color: white;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            display: inline-flex;
            align-items: center;
            letter-spacing: -0.2px;
            box-shadow: 0 4px 15px rgba(99, 102, 241, 0.2);
        }
        .btn-premium-download:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 20px rgba(168, 85, 247, 0.3) !important;
            color: white;
            background: linear-gradient(135deg, #4f46e5 0%, #9333ea 100%);
        }
        .btn-premium-download:active {
            transform: translateY(0) scale(0.98);
        }
        .transition-all {
            transition: all 0.2s ease;
        }
        .hover-bg-light:hover {
            background: #f8fafc;
            border-color: #4f46e5 !important;
        }
      `}} />
    </div>
  );
}
