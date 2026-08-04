import React from 'react';

const ACTION_MAPPINGS = {
  'merge': { label: 'Merge PDF', processing: 'Merging PDF...', icon: 'bi-intersect' },
  'split': { label: 'Split PDF', processing: 'Splitting PDF...', icon: 'bi-scissors' },
  'compress': { label: 'Compress PDF', processing: 'Compressing PDF...', icon: 'bi-file-zip' },
  'rotate': { label: 'Rotate PDF', processing: 'Rotating PDF...', icon: 'bi-arrow-repeat' },
  'organize': { label: 'Organize PDF', processing: 'Organizing PDF...', icon: 'bi-grid-3x3-gap' },
  'edit-pdf': { label: 'Edit PDF', processing: 'Editing PDF...', icon: 'bi-pencil-square' },
  'repair': { label: 'Repair PDF', processing: 'Repairing PDF...', icon: 'bi-tools' },
  'unlock': { label: 'Unlock PDF', processing: 'Unlocking PDF...', icon: 'bi-unlock' },
  'protect': { label: 'Protect PDF', processing: 'Protecting PDF...', icon: 'bi-lock' },
  'redact': { label: 'Redact PDF', processing: 'Redacting PDF...', icon: 'bi-eye-slash' },
  'flatten': { label: 'Flatten PDF', processing: 'Flattening PDF...', icon: 'bi-layers-half' },
  'ocr-pdf': { label: 'OCR PDF', processing: 'Running OCR...', icon: 'bi-search' },
  'pdf-ocr': { label: 'OCR PDF', processing: 'Running OCR...', icon: 'bi-search' },
  'ocr-image': { label: 'Extract Text', processing: 'Extracting Text...', icon: 'bi-file-earmark-text' },
  'image-ocr': { label: 'Extract Text', processing: 'Extracting Text...', icon: 'bi-file-earmark-text' },
  'watermark': { label: 'Add Watermark', processing: 'Adding Watermark...', icon: 'bi-patch-check' },
  'page-numbers': { label: 'Add Page Numbers', processing: 'Adding Page Numbers...', icon: 'bi-list-ol' },
  'crop-pdf': { label: 'Crop PDF', processing: 'Cropping PDF...', icon: 'bi-crop' },
  'remove-blank-pages': { label: 'Remove Blank Pages', processing: 'Removing Blank Pages...', icon: 'bi-file-earmark-x' },
  'reverse-page-order': { label: 'Reverse Page Order', processing: 'Reversing Page Order...', icon: 'bi-arrow-down-up' },
  'duplicate-pages': { label: 'Duplicate Pages', processing: 'Duplicating Pages...', icon: 'bi-files' },
  'header-footer': { label: 'Header & Footer', processing: 'Applying Header & Footer...', icon: 'bi-layout-three-columns' },
  'extract-images': { label: 'Extract Images', processing: 'Extracting Images...', icon: 'bi-file-earmark-image-fill' },
  'pdf-to-png': { label: 'Convert to PNG', processing: 'Converting to PNG...', icon: 'bi-filetype-png' },
  'flatten-pdf': { label: 'Flatten PDF', processing: 'Flattening PDF...', icon: 'bi-layers-half' },
  'pdf-thumbnail-viewer': { label: 'Generate Thumbnails', processing: 'Generating Thumbnails...', icon: 'bi-grid-fill' },
  'pdf-to-jpg': { label: 'Convert to JPG', processing: 'Converting to JPG...', icon: 'bi-file-earmark-image' },
  'pdf-to-pdfa': { label: 'Convert to PDF/A', processing: 'Converting to PDF/A...', icon: 'bi-file-earmark-pdf' },
  'compress-image': { label: 'Compress Image', processing: 'Compressing Image...', icon: 'bi-file-zip-fill' },
  'resize-image': { label: 'Resize Image', processing: 'Resizing Image...', icon: 'bi-aspect-ratio' },
  'crop-image': { label: 'Crop Image', processing: 'Cropping Image...', icon: 'bi-crop' },
  'convert-image': { label: 'Convert Image', processing: 'Converting Image...', icon: 'bi-arrow-left-right' },
  'remove-bg': { label: 'Remove Background', processing: 'Removing Background...', icon: 'bi-eraser' },
  'image-watermark': { label: 'Add Watermark', processing: 'Adding Watermark...', icon: 'bi-patch-check-fill' },
  'upscale-image': { label: 'Upscale Image', processing: 'Upscaling Image...', icon: 'bi-zoom-in' },
  'rotate-image': { label: 'Rotate Image', processing: 'Rotating Image...', icon: 'bi-arrow-clockwise' },
  'delete-pages': { label: 'Delete Pages', processing: 'Deleting Pages...', icon: 'bi-trash' },
  'extract-pages': { label: 'Extract Pages', processing: 'Extracting Pages...', icon: 'bi-box-arrow-up' },
};

function DynamicActionButton({
  toolSlug,
  status = 'idle',
  statusText,
  disabled = false,
  onClick,
  className = '',
  id = 'processBtn'
}) {
  const config = ACTION_MAPPINGS[toolSlug] || {
    label: 'Process File',
    processing: 'Processing...',
    icon: 'bi-gear-fill'
  };

  const isProcessing = status === 'processing';
  const isCompleted = status === 'completed';

  const getLabel = () => {
    if (isProcessing) {
      return statusText || config.processing;
    }
    if (isCompleted) {
      return 'Completed Successfully';
    }
    return config.label;
  };

  return (
    <button
      type="button"
      id={id}
      onClick={onClick}
      disabled={disabled || isProcessing}
      className={`btn btn-primary btn-lg py-3 fw-bold rounded-pill shadow-sm transition-all d-inline-flex align-items-center justify-content-center gap-2 ${className}`}
      aria-label={getLabel()}
      aria-disabled={disabled || isProcessing}
      aria-live="polite"
    >
      {isProcessing ? (
        <>
          <span className="spinner-border spinner-border-sm text-light me-2" role="status" aria-hidden="true"></span>
          <span>{getLabel()}</span>
        </>
      ) : isCompleted ? (
        <>
          <i className="bi bi-check-circle-fill text-success fs-5 me-1"></i>
          <span>{getLabel()}</span>
        </>
      ) : (
        <>
          <i className={`bi ${config.icon} fs-5 me-1`}></i>
          <span>{getLabel()}</span>
        </>
      )}
    </button>
  );
}

export default React.memo(DynamicActionButton);
