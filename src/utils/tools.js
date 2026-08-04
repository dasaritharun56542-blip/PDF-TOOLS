export const CATEGORIES = {
  all: 'All Tools',
  edit: 'Edit PDF',
  convert_to: 'Convert to PDF',
  convert_from: 'Convert from PDF',
  optimize: 'Optimize',
  security: 'Security'
};

export const TOOLS = {
  'merge': { name: 'Merge PDF', icon: 'bi-intersect', desc: 'Combine multiple PDFs into one document.', cat: 'edit' },
  'split': { name: 'Split PDF', icon: 'bi-scissors', desc: 'Extract specific pages or ranges.', cat: 'edit' },
  'compress': { name: 'Compress PDF', icon: 'bi-file-zip', desc: 'Optimize and reduce file size.', cat: 'optimize' },
  'pdf-to-jpg': { name: 'PDF to JPG', icon: 'bi-file-earmark-image', desc: 'Extract all PDF pages as JPG.', cat: 'convert_from' },
  'rotate': { name: 'Rotate PDF', icon: 'bi-arrow-repeat', desc: 'Rotate pages 90, 180 or 270.', cat: 'edit' },
  'watermark': { name: 'Add Watermark', icon: 'bi-patch-check', desc: 'Stamp an image or text on PDF.', cat: 'edit', premium: true },
  'page-numbers': { name: 'Page Numbers', icon: 'bi-list-ol', desc: 'Add page numbers with style.', cat: 'edit' },
  'repair': { name: 'Repair PDF', icon: 'bi-tools', desc: 'Fix damaged or corrupted PDFs.', cat: 'optimize' },
  'protect': { name: 'Protect PDF', icon: 'bi-lock', desc: 'Encrypt your PDF with password.', cat: 'security' },
  'organize': { name: 'Organize PDF', icon: 'bi-grid-3x3-gap', desc: 'Sort, add or delete PDF pages.', cat: 'edit', premium: true },
  'delete-pages': { name: 'Delete Pages', icon: 'bi-trash', desc: 'Remove specific pages from PDF.', cat: 'edit' },
  'extract-pages': { name: 'Extract Pages', icon: 'bi-box-arrow-up', desc: 'Get specific pages as new file.', cat: 'edit' },
  'sign-pdf': { name: 'Sign PDF', icon: 'bi-pencil-fill', desc: 'Electronically sign your documents.', cat: 'security', premium: true },
  'pdf-to-pdfa': { name: 'PDF to PDF/A', icon: 'bi-file-earmark-pdf', desc: 'Convert PDF to PDF/A archival format.', cat: 'convert_from' },
  'ocr-pdf': { name: 'OCR PDF', icon: 'bi-card-text', desc: 'Perform OCR on scanned PDFs to produce searchable text.', cat: 'optimize' },
  'crop-pdf': { name: 'Crop PDF', icon: 'bi-crop', desc: 'Trim page margins and adjust visible area.', cat: 'edit' },
  'remove-blank-pages': { name: 'Remove Blank Pages', icon: 'bi-file-earmark-x', desc: 'Automatically detect and remove blank pages.', cat: 'edit' },
  'reverse-page-order': { name: 'Reverse Page Order', icon: 'bi-arrow-down-up', desc: 'Invert the order of PDF pages instantly.', cat: 'edit' },
  'duplicate-pages': { name: 'Duplicate Pages', icon: 'bi-files', desc: 'Clone and duplicate specific pages.', cat: 'edit' },
  'header-footer': { name: 'Header & Footer', icon: 'bi-layout-three-columns', desc: 'Add custom headers and footers to PDF.', cat: 'edit' },
  'extract-images': { name: 'Extract Images', icon: 'bi-file-earmark-image-fill', desc: 'Extract all embedded images from PDF.', cat: 'convert_from' },
  'pdf-to-png': { name: 'PDF to PNG', icon: 'bi-filetype-png', desc: 'Convert PDF pages into high quality PNGs.', cat: 'convert_from' },
  'flatten-pdf': { name: 'Flatten PDF', icon: 'bi-layers-half', desc: 'Flatten form fields and layers into static PDF.', cat: 'optimize' },
  'pdf-thumbnail-viewer': { name: 'PDF Thumbnail Viewer', icon: 'bi-grid-fill', desc: 'View and export thumbnail grid of PDF pages.', cat: 'optimize' },
};

// Group tools by category for the mega menu
export const GROUPED_TOOLS = {};
for (const [catSlug, catName] of Object.entries(CATEGORIES)) {
  if (catSlug === 'all') continue;
  GROUPED_TOOLS[catSlug] = {
    name: catName,
    tools: Object.entries(TOOLS)
      .filter(([_, data]) => data.cat === catSlug)
      .map(([slug, data]) => ({ slug, ...data }))
  };
}
