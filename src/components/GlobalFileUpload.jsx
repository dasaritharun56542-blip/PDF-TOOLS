import React, { useRef, useState } from 'react';
import { getToolAcceptAttribute, getToolSupportedFormatsLabel } from '../utils/fileValidation';

function GlobalFileUpload({
  toolSlug,
  uploadedFiles = [],
  onFilesAdd,
  onFileRemove,
  onRemoveAll,
  disabled = false
}) {
  const fileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  const getFileIconClass = (file) => {
    const ext = file.name ? file.name.split('.').pop().toLowerCase() : '';
    if (['pdf'].includes(ext)) return 'bi-file-earmark-pdf-fill text-danger';
    if (['jpg', 'jpeg', 'png', 'webp', 'bmp', 'gif', 'tiff', 'svg'].includes(ext)) return 'bi-file-earmark-image-fill text-info';
    return 'bi-file-earmark-fill text-secondary';
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const totalSizeBytes = uploadedFiles.reduce((acc, f) => acc + (f.size || 0), 0);

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (disabled) return;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFilesAdd(e.dataTransfer.files);
    }
  };

  const triggerFileInput = () => {
    if (disabled) return;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  return (
    <div className="global-file-upload mb-5" data-aos="fade-up">
      {/* Hidden File Input for Native File Picker */}
      <input
        type="file"
        id="fileInput"
        multiple
        accept={getToolAcceptAttribute(toolSlug)}
        hidden
        ref={fileInputRef}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            onFilesAdd(e.target.files);
            e.target.value = '';
          }
        }}
      />

      {/* STATE 1: EMPTY QUEUE -> SHOW MAIN DROPZONE & "SELECT FILES" BUTTON */}
      {uploadedFiles.length === 0 ? (
        <div
          id="upload-zone"
          className={`upload-area text-center border-dashed rounded-4 p-5 bg-white transition-all shadow-sm ${
            isDragOver ? 'border-primary bg-light scale-101' : ''
          }`}
          style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={triggerFileInput}
        >
          <div className="upload-content py-4">
            <div className="mb-4">
              <i className="bi bi-cloud-arrow-up display-1 text-primary"></i>
            </div>
            <h3 className="fw-bold mb-3 text-dark">Choose files or drag and drop</h3>
            <p className="text-muted mb-4">Maximum file size: 500MB</p>
            
            {/* SELECT FILES BUTTON (Shown ONLY when uploadedFiles.length === 0) */}
            <button
              type="button"
              id="selectFilesBtn"
              className="btn btn-primary btn-lg rounded-pill px-5 fw-bold shadow-sm d-inline-flex align-items-center gap-2"
              disabled={disabled}
              onClick={(e) => {
                e.stopPropagation();
                triggerFileInput();
              }}
            >
              <i className="bi bi-folder2-open fs-5"></i>
              Select Files
            </button>

            <p className="mt-4 small text-muted mb-0">
              Supported formats: {getToolSupportedFormatsLabel(toolSlug)}
            </p>
          </div>
        </div>
      ) : (
        /* STATE 2: ONE OR MORE FILES -> HIDE "SELECT FILES", SHOW CONTROL PANEL & "ADD MORE FILES" BUTTON */
        <div
          className={`upload-active-panel card border-0 shadow-sm rounded-4 p-4 bg-white transition-all ${
            isDragOver ? 'border border-2 border-primary bg-light' : ''
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* Header Control Toolbar */}
          <div className="d-flex flex-wrap align-items-center justify-content-between pb-3 mb-4 border-bottom gap-3">
            {/* Summary Stats */}
            <div className="d-flex align-items-center gap-2 flex-wrap">
              <span className="badge bg-primary rounded-pill px-3 py-2 fs-6 fw-bold">
                <i className="bi bi-files me-1"></i> {uploadedFiles.length} File{uploadedFiles.length > 1 ? 's' : ''}
              </span>
              <span className="badge bg-light text-muted border rounded-pill px-3 py-2 fs-6 fw-semibold">
                <i className="bi bi-hdd me-1"></i> {formatFileSize(totalSizeBytes)}
              </span>
            </div>

            {/* Action Buttons: Add More Files & Clear All */}
            <div className="d-flex align-items-center gap-2">
              {/* ADD MORE FILES BUTTON (Replaces Select Files when files exist) */}
              <button
                type="button"
                id="addMoreFilesBtn"
                className="btn btn-primary rounded-pill px-4 py-2.5 fw-bold shadow-sm d-inline-flex align-items-center gap-2"
                disabled={disabled}
                onClick={triggerFileInput}
              >
                <i className="bi bi-plus-circle-fill fs-5"></i>
                Add More Files
              </button>

              <button
                type="button"
                id="clearAllFilesBtn"
                className="btn btn-outline-danger rounded-pill px-3 py-2.5 fw-semibold d-inline-flex align-items-center gap-1"
                disabled={disabled}
                onClick={onRemoveAll}
                title="Remove All Uploaded Files"
              >
                <i className="bi bi-trash3"></i>
                Clear All
              </button>
            </div>
          </div>

          {/* Drag & Drop Append Banner */}
          <div
            className="drop-append-banner border-dashed rounded-3 p-3 text-center mb-4 bg-light cursor-pointer transition-all"
            onClick={triggerFileInput}
          >
            <span className="small text-muted fw-semibold">
              <i className="bi bi-cloud-arrow-up me-1 text-primary fs-6"></i>
              Drag & drop more files here or click <strong className="text-primary cursor-pointer">Add More Files</strong> to append.
            </span>
          </div>

          {/* Uploaded File Queue List */}
          <div id="file-list" className="row g-3">
            {uploadedFiles.map((file, idx) => (
              <div key={`${file.name}_${file.size}_${idx}`} className="col-12">
                <div className="card p-3 border rounded-3 bg-white shadow-xs d-flex flex-row align-items-center justify-content-between transition-all hover-shadow">
                  <div className="d-flex align-items-center text-truncate me-3">
                    <i className={`bi ${getFileIconClass(file)} fs-2 me-3 flex-shrink-0`}></i>
                    <div className="text-truncate">
                      <div className="fw-bold text-dark text-truncate mb-1">{file.name}</div>
                      <div className="d-flex align-items-center gap-2">
                        <span className="small text-muted">{formatFileSize(file.size)}</span>
                        <span className="badge bg-success-subtle text-success border border-success-subtle rounded-pill px-2.5 py-0.5 small">
                          Ready
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm rounded-circle p-2 flex-shrink-0 d-flex align-items-center justify-content-center"
                    style={{ width: '36px', height: '36px' }}
                    onClick={() => onFileRemove(idx)}
                    title="Remove this file"
                  >
                    <i className="bi bi-trash3 fs-6"></i>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default React.memo(GlobalFileUpload);
