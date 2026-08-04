import React, { useState, useEffect, useRef } from 'react';

export default function InteractiveImageEditor({ imageFile, onProcess, processing, statusText, progressBarWidth }) {
  const [imageObj, setImageObj] = useState(null);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [zoom, setZoom] = useState(1.0);

  // Aspect Ratio & Lock
  const [aspectRatioPreset, setAspectRatioPreset] = useState('free'); // free, original, 1:1, 4:3, 16:9, 3:2
  const [isAspectLocked, setIsAspectLocked] = useState(false);

  // Crop Box Coordinates (Normalized 0 to 1 relative to image width/height)
  const [cropBox, setCropBox] = useState({ left: 0, top: 0, width: 1, height: 1 });

  // Custom Target Width & Height in Pixels
  const [targetWidth, setTargetWidth] = useState('');
  const [targetHeight, setTargetHeight] = useState('');

  // Drag State
  const [dragState, setDragState] = useState(null); // { type: 'move' | 'nw' | 'ne' | 'se' | 'sw' | 'n' | 'e' | 's' | 'w', startX, startY, startCrop }

  const canvasRef = useRef(null);
  const containerRef = useRef(null);

  // Load Image File
  useEffect(() => {
    if (!imageFile) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        setImageObj(img);
        setCropBox({ left: 0, top: 0, width: 1, height: 1 });
        setTargetWidth(img.width.toString());
        setTargetHeight(img.height.toString());
        setRotation(0);
        setFlipH(false);
        setFlipV(false);
        setZoom(1.0);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(imageFile);
  }, [imageFile]);

  // Compute Current Image Render Bounds (considering Rotation)
  const getTransformedDimensions = () => {
    if (!imageObj) return { width: 1, height: 1 };
    const isRotated = rotation % 180 !== 0;
    return {
      width: isRotated ? imageObj.height : imageObj.width,
      height: isRotated ? imageObj.width : imageObj.height,
    };
  };

  // Sync Target Dimensions when Crop Box or Rotation Changes
  useEffect(() => {
    if (!imageObj) return;
    const { width: currentW, height: currentH } = getTransformedDimensions();
    const pixelW = Math.round(cropBox.width * currentW);
    const pixelH = Math.round(cropBox.height * currentH);
    setTargetWidth(pixelW.toString());
    setTargetHeight(pixelH.toString());
  }, [cropBox, rotation, imageObj]);

  // Handle Aspect Ratio Presets
  const applyAspectRatioPreset = (preset) => {
    setAspectRatioPreset(preset);
    if (!imageObj) return;
    const { width: imgW, height: imgH } = getTransformedDimensions();

    if (preset === 'free') {
      setIsAspectLocked(false);
      return;
    }

    setIsAspectLocked(true);
    let ratio = 1.0;
    if (preset === 'original') ratio = imgW / imgH;
    else if (preset === '1:1') ratio = 1.0;
    else if (preset === '4:3') ratio = 4 / 3;
    else if (preset === '16:9') ratio = 16 / 9;
    else if (preset === '3:2') ratio = 3 / 2;

    // Calculate crop dimensions to fit ratio inside current image
    let newW = 1.0;
    let newH = 1.0;
    const imgRatio = imgW / imgH;

    if (ratio > imgRatio) {
      newW = 1.0;
      newH = (imgW / ratio) / imgH;
    } else {
      newH = 1.0;
      newW = (imgH * ratio) / imgW;
    }

    const newLeft = (1.0 - newW) / 2;
    const newTop = (1.0 - newH) / 2;
    setCropBox({ left: newLeft, top: newTop, width: newW, height: newH });
  };

  // Canvas Live Preview Render Loop
  useEffect(() => {
    if (!imageObj || !canvasRef.current || !containerRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const container = containerRef.current;

    const { width: transW, height: transH } = getTransformedDimensions();

    // Scale canvas view to fit inside container viewport
    const containerW = container.clientWidth - 40 || 600;
    const containerH = 480;
    const scale = Math.min(containerW / transW, containerH / transH) * zoom;

    const viewW = Math.round(transW * scale);
    const viewH = Math.round(transH * scale);

    canvas.width = viewW;
    canvas.height = viewH;

    ctx.clearRect(0, 0, viewW, viewH);

    // Draw Transformed Base Image
    ctx.save();
    ctx.translate(viewW / 2, viewH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    const drawW = (rotation % 180 !== 0 ? transH : transW) * scale;
    const drawH = (rotation % 180 !== 0 ? transW : transH) * scale;

    ctx.drawImage(imageObj, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Draw Semi-transparent Overlay over non-cropped areas
    ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
    ctx.fillRect(0, 0, viewW, viewH);

    // Crop Box Pixel Coordinates
    const cbX = cropBox.left * viewW;
    const cbY = cropBox.top * viewH;
    const cbW = cropBox.width * viewW;
    const cbH = cropBox.height * viewH;

    // Clear overlay over active crop area
    ctx.save();
    ctx.translate(viewW / 2, viewH / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);

    // Draw active un-shaded crop region
    ctx.beginPath();
    ctx.rect(-drawW / 2 + (cropBox.left * drawW), -drawH / 2 + (cropBox.top * drawH), cropBox.width * drawW, cropBox.height * drawH);
    ctx.clip();
    ctx.drawImage(imageObj, -drawW / 2, -drawH / 2, drawW, drawH);
    ctx.restore();

    // Draw Crop Box Outline Grid & Drag Handles
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 2;
    ctx.strokeRect(cbX, cbY, cbW, cbH);

    // Rule of Thirds Grid Lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    ctx.beginPath();
    ctx.moveTo(cbX + cbW / 3, cbY); ctx.lineTo(cbX + cbW / 3, cbY + cbH);
    ctx.moveTo(cbX + (cbW * 2) / 3, cbY); ctx.lineTo(cbX + (cbW * 2) / 3, cbY + cbH);
    ctx.moveTo(cbX, cbY + cbH / 3); ctx.lineTo(cbX + cbW, cbY + cbH / 3);
    ctx.moveTo(cbX, cbY + (cbH * 2) / 3); ctx.lineTo(cbX + cbW, cbY + (cbH * 2) / 3);
    ctx.stroke();
    ctx.setLineDash([]);

    // Draw 8 Interactive Resize Handles
    const handleSize = 10;
    const handles = [
      { x: cbX, y: cbY }, // NW
      { x: cbX + cbW / 2, y: cbY }, // N
      { x: cbX + cbW, y: cbY }, // NE
      { x: cbX + cbW, y: cbY + cbH / 2 }, // E
      { x: cbX + cbW, y: cbY + cbH }, // SE
      { x: cbX + cbW / 2, y: cbY + cbH }, // S
      { x: cbX, y: cbY + cbH }, // SW
      { x: cbX, y: cbY + cbH / 2 }, // W
    ];

    handles.forEach((h) => {
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = '#3b82f6';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(h.x, h.y, handleSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }, [imageObj, rotation, flipH, flipV, zoom, cropBox]);

  // Pointer & Touch Events for Dragging Handles & Moving Crop Area
  const handlePointerDown = (e) => {
    if (!canvasRef.current || !imageObj) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);

    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const viewW = canvasRef.current.width;
    const viewH = canvasRef.current.height;

    const cbX = cropBox.left * viewW;
    const cbY = cropBox.top * viewH;
    const cbW = cropBox.width * viewW;
    const cbH = cropBox.height * viewH;

    const handleThreshold = 14;

    // Detect which handle was clicked
    let type = null;
    if (Math.abs(x - cbX) < handleThreshold && Math.abs(y - cbY) < handleThreshold) type = 'nw';
    else if (Math.abs(x - (cbX + cbW)) < handleThreshold && Math.abs(y - cbY) < handleThreshold) type = 'ne';
    else if (Math.abs(x - (cbX + cbW)) < handleThreshold && Math.abs(y - (cbY + cbH)) < handleThreshold) type = 'se';
    else if (Math.abs(x - cbX) < handleThreshold && Math.abs(y - (cbY + cbH)) < handleThreshold) type = 'sw';
    else if (Math.abs(x - (cbX + cbW / 2)) < handleThreshold && Math.abs(y - cbY) < handleThreshold) type = 'n';
    else if (Math.abs(x - (cbX + cbW)) < handleThreshold && Math.abs(y - (cbY + cbH / 2)) < handleThreshold) type = 'e';
    else if (Math.abs(x - (cbX + cbW / 2)) < handleThreshold && Math.abs(y - (cbY + cbH)) < handleThreshold) type = 's';
    else if (Math.abs(x - cbX) < handleThreshold && Math.abs(y - (cbY + cbH / 2)) < handleThreshold) type = 'w';
    else if (x >= cbX && x <= cbX + cbW && y >= cbY && y <= cbY + cbH) type = 'move';

    if (type) {
      setDragState({
        type,
        startX: clientX,
        startY: clientY,
        startCrop: { ...cropBox },
      });
    }
  };

  const handlePointerMove = (e) => {
    if (!dragState || !canvasRef.current) return;
    const clientX = e.clientX || (e.touches && e.touches[0]?.clientX);
    const clientY = e.clientY || (e.touches && e.touches[0]?.clientY);

    const viewW = canvasRef.current.width;
    const viewH = canvasRef.current.height;

    const deltaX = (clientX - dragState.startX) / viewW;
    const deltaY = (clientY - dragState.startY) / viewH;

    let { left, top, width, height } = dragState.startCrop;
    const type = dragState.type;

    if (type === 'move') {
      left = Math.max(0, Math.min(1 - width, left + deltaX));
      top = Math.max(0, Math.min(1 - height, top + deltaY));
    } else {
      if (type.includes('w')) {
        const newLeft = Math.max(0, Math.min(left + width - 0.05, left + deltaX));
        width = width + (left - newLeft);
        left = newLeft;
      }
      if (type.includes('e')) {
        width = Math.max(0.05, Math.min(1 - left, width + deltaX));
      }
      if (type.includes('n')) {
        const newTop = Math.max(0, Math.min(top + height - 0.05, top + deltaY));
        height = height + (top - newTop);
        top = newTop;
      }
      if (type.includes('s')) {
        height = Math.max(0.05, Math.min(1 - top, height + deltaY));
      }
    }

    setCropBox({ left, top, width, height });
  };

  const handlePointerUp = () => {
    setDragState(null);
  };

  // Process Confirmation & Submit Payload
  const handleConfirmProcess = () => {
    if (!imageObj) return;
    const { width: transW, height: transH } = getTransformedDimensions();

    const cropLeftPx = Math.round(cropBox.left * transW);
    const cropTopPx = Math.round(cropBox.top * transH);
    const cropRightPx = Math.round((cropBox.left + cropBox.width) * transW);
    const cropBottomPx = Math.round((cropBox.top + cropBox.height) * transH);

    const finalW = parseInt(targetWidth) || (cropRightPx - cropLeftPx);
    const finalH = parseInt(targetHeight) || (cropBottomPx - cropTopPx);

    onProcess({
      left: cropLeftPx,
      top: cropTopPx,
      right: cropRightPx,
      bottom: cropBottomPx,
      width: finalW,
      height: finalH,
      angle: rotation,
      flip_h: flipH,
      flip_v: flipV,
    });
  };

  return (
    <div className="interactive-editor-card card border-0 shadow-lg rounded-4 overflow-hidden bg-white mb-4">
      {/* Top Toolbar Controls */}
      <div className="card-header bg-light border-bottom p-3 d-flex align-items-center justify-content-between flex-wrap gap-2">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          {/* Aspect Ratio Presets */}
          <div className="btn-group btn-group-sm" role="group" title="Aspect Ratio Presets">
            <button
              className={`btn btn-outline-secondary ${aspectRatioPreset === 'free' ? 'active' : ''}`}
              onClick={() => applyAspectRatioPreset('free')}
            >
              Free
            </button>
            <button
              className={`btn btn-outline-secondary ${aspectRatioPreset === 'original' ? 'active' : ''}`}
              onClick={() => applyAspectRatioPreset('original')}
            >
              Original
            </button>
            <button
              className={`btn btn-outline-secondary ${aspectRatioPreset === '1:1' ? 'active' : ''}`}
              onClick={() => applyAspectRatioPreset('1:1')}
            >
              1:1
            </button>
            <button
              className={`btn btn-outline-secondary ${aspectRatioPreset === '4:3' ? 'active' : ''}`}
              onClick={() => applyAspectRatioPreset('4:3')}
            >
              4:3
            </button>
            <button
              className={`btn btn-outline-secondary ${aspectRatioPreset === '16:9' ? 'active' : ''}`}
              onClick={() => applyAspectRatioPreset('16:9')}
            >
              16:9
            </button>
            <button
              className={`btn btn-outline-secondary ${aspectRatioPreset === '3:2' ? 'active' : ''}`}
              onClick={() => applyAspectRatioPreset('3:2')}
            >
              3:2
            </button>
          </div>

          <div className="vr mx-1"></div>

          {/* Transformations: Rotate & Flip */}
          <button
            className="btn btn-sm btn-light border"
            onClick={() => setRotation((r) => (r - 90 + 360) % 360)}
            title="Rotate Left (-90°)"
          >
            <i className="bi bi-arrow-counterclockwise"></i>
          </button>
          <button
            className="btn btn-sm btn-light border"
            onClick={() => setRotation((r) => (r + 90) % 360)}
            title="Rotate Right (+90°)"
          >
            <i className="bi bi-arrow-clockwise"></i>
          </button>
          <button
            className={`btn btn-sm btn-light border ${flipH ? 'active text-primary' : ''}`}
            onClick={() => setFlipH(!flipH)}
            title="Flip Horizontal"
          >
            <i className="bi bi-border-left"></i>
          </button>
          <button
            className={`btn btn-sm btn-light border ${flipV ? 'active text-primary' : ''}`}
            onClick={() => setFlipV(!flipV)}
            title="Flip Vertical"
          >
            <i className="bi bi-border-top"></i>
          </button>

          <div className="vr mx-1"></div>

          {/* Zoom Controls */}
          <button
            className="btn btn-sm btn-light border"
            onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}
            title="Zoom Out"
          >
            <i className="bi bi-dash-lg"></i>
          </button>
          <span className="small fw-bold px-1">{Math.round(zoom * 100)}%</span>
          <button
            className="btn btn-sm btn-light border"
            onClick={() => setZoom((z) => Math.min(2.0, z + 0.1))}
            title="Zoom In"
          >
            <i className="bi bi-plus-lg"></i>
          </button>
        </div>

        {/* Reset Button */}
        <button
          className="btn btn-sm btn-outline-danger ms-auto rounded-pill px-3"
          onClick={() => {
            setCropBox({ left: 0, top: 0, width: 1, height: 1 });
            setRotation(0);
            setFlipH(false);
            setFlipV(false);
            setZoom(1.0);
            setAspectRatioPreset('free');
          }}
        >
          <i className="bi bi-arrow-counterclockwise me-1"></i> Reset
        </button>
      </div>

      {/* Main Canvas Canvas Editor Viewport */}
      <div
        ref={containerRef}
        className="card-body p-4 bg-dark text-center overflow-auto position-relative d-flex align-items-center justify-content-center"
        style={{ minHeight: '480px', maxHeight: '560px', userSelect: 'none', cursor: dragState ? 'grabbing' : 'crosshair' }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        <canvas ref={canvasRef} className="shadow-lg rounded" style={{ display: 'block' }} />
      </div>

      {/* Bottom Controls: Dimension Inputs & Process Button */}
      <div className="card-footer bg-light p-4 border-top">
        <div className="row g-3 align-items-center mb-3">
          <div className="col-12 col-md-4">
            <div className="input-group input-group-lg">
              <span className="input-group-text bg-white fw-bold text-muted" style={{ fontSize: '13px' }}>
                Width (px)
              </span>
              <input
                type="number"
                className="form-control fw-bold"
                value={targetWidth}
                onChange={(e) => setTargetWidth(e.target.value)}
              />
            </div>
          </div>

          <div className="col-12 col-md-4">
            <div className="input-group input-group-lg">
              <span className="input-group-text bg-white fw-bold text-muted" style={{ fontSize: '13px' }}>
                Height (px)
              </span>
              <input
                type="number"
                className="form-control fw-bold"
                value={targetHeight}
                onChange={(e) => setTargetHeight(e.target.value)}
              />
            </div>
          </div>

          <div className="col-12 col-md-4">
            <button
              onClick={handleConfirmProcess}
              disabled={processing}
              className="btn btn-primary btn-lg w-100 fw-bold rounded-pill shadow-sm"
              style={{ background: 'linear-gradient(135deg, #2563eb, #1d4ed8)' }}
            >
              {processing ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2"></span>
                  <span>{statusText || 'Processing...'}</span>
                </>
              ) : (
                <>
                  <i className="bi bi-crop me-2"></i> Resize & Download Image
                </>
              )}
            </button>
          </div>
        </div>

        {processing && (
          <div className="progress mt-3" style={{ height: '8px', borderRadius: '4px' }}>
            <div
              className="progress-bar progress-bar-striped progress-bar-animated bg-primary"
              role="progressbar"
              style={{ width: `${progressBarWidth}%` }}
            ></div>
          </div>
        )}
      </div>
    </div>
  );
}
