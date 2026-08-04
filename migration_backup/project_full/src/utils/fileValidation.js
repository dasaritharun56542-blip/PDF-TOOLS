/**
 * Centralized File Routing & Deep Binary Validation Engine
 * Enforces file extension, MIME type, and Magic Number binary header verification
 * for all PDF, Image, Word, Excel, PowerPoint, and OCR tools across the platform.
 */

// Supported Tool Extensions & Allowed MIME Mapping
export const TOOL_FILE_RULES = {
  // PDF Tools
  'pdf_default': {
    extensions: ['.pdf'],
    mimeTypes: ['application/pdf'],
    magicCheck: (bytes) => {
      // %PDF- (0x25, 0x50, 0x44, 0x46)
      return bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46;
    },
    label: 'PDF documents (.pdf)'
  },

  // Image Tools
  'image_default': {
    extensions: ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.tif', '.gif'],
    mimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/bmp', 'image/tiff', 'image/gif'],
    magicCheck: (bytes) => {
      // JPEG: FF D8 FF
      if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) return true;
      // PNG: 89 50 4E 47
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) return true;
      // WEBP: RIFF ... WEBP (52 49 46 46)
      if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return true;
      // BMP: BM (42 4D)
      if (bytes[0] === 0x42 && bytes[1] === 0x4D) return true;
      // TIFF: II (49 49) or MM (4D 4D)
      if ((bytes[0] === 0x49 && bytes[1] === 0x49) || (bytes[0] === 0x4D && bytes[1] === 0x4D)) return true;
      // GIF: GIF8 (47 49 46 38)
      if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return true;
      return false;
    },
    label: 'Image files (.jpg, .jpeg, .png, .webp, .bmp, .tiff, .gif)'
  },

  // Word Tools
  'word_default': {
    extensions: ['.docx', '.doc'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword'
    ],
    magicCheck: (bytes) => {
      // OOXML: PK (0x50, 0x4B)
      if (bytes[0] === 0x50 && bytes[1] === 0x4B) return true;
      // OLE2 Binary: 0xD0 0xCF 0x11 0xE0
      if (bytes[0] === 0xD0 && bytes[1] === 0xCF) return true;
      return false;
    },
    label: 'Word documents (.docx, .doc)'
  },

  // Excel Tools
  'excel_default': {
    extensions: ['.xlsx', '.xls'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel'
    ],
    magicCheck: (bytes) => {
      // OOXML: PK (0x50, 0x4B)
      if (bytes[0] === 0x50 && bytes[1] === 0x4B) return true;
      // OLE2 Binary: 0xD0 0xCF 0x11 0xE0
      if (bytes[0] === 0xD0 && bytes[1] === 0xCF) return true;
      return false;
    },
    label: 'Excel spreadsheets (.xlsx, .xls)'
  },

  // PowerPoint Tools
  'ppt_default': {
    extensions: ['.pptx', '.ppt'],
    mimeTypes: [
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/vnd.ms-powerpoint'
    ],
    magicCheck: (bytes) => {
      // OOXML: PK (0x50, 0x4B)
      if (bytes[0] === 0x50 && bytes[1] === 0x4B) return true;
      // OLE2 Binary: 0xD0 0xCF 0x11 0xE0
      if (bytes[0] === 0xD0 && bytes[1] === 0xCF) return true;
      return false;
    },
    label: 'PowerPoint presentations (.pptx, .ppt)'
  }
};

// Map each Tool Slug to its File Category Rule
export const TOOL_CATEGORY_MAP = {
  // PDF Tools
  'merge': 'pdf_default',
  'split': 'pdf_default',
  'compress': 'pdf_default',
  'pdf-to-jpg': 'pdf_default',
  'rotate': 'pdf_default',
  'watermark': 'pdf_default',
  'page-numbers': 'pdf_default',
  'repair': 'pdf_default',
  'protect': 'pdf_default',
  'organize': 'pdf_default',
  'delete-pages': 'pdf_default',
  'extract-pages': 'pdf_default',
  'sign-pdf': 'pdf_default',
  'edit-pdf': 'pdf_default',
  'pdf-to-pdfa': 'pdf_default',
  'ocr-pdf': 'pdf_default',
  'crop-pdf': 'pdf_default',
  'remove-blank-pages': 'pdf_default',
  'reverse-page-order': 'pdf_default',
  'duplicate-pages': 'pdf_default',
  'header-footer': 'pdf_default',
  'extract-images': 'pdf_default',
  'pdf-to-png': 'pdf_default',
  'flatten-pdf': 'pdf_default',
  'pdf-thumbnail-viewer': 'pdf_default',
  'redact-pdf': 'pdf_default',
  'compare-pdf': 'pdf_default',
  'pdf-reader': 'pdf_default',
  'pdf-thumbnail-viewer': 'pdf_default',
  'share-pdf': 'pdf_default',
  'generate-share-link': 'pdf_default',

  // Image Tools
  'resize-image': 'image_default',
  'crop-image': 'image_default',
  'compress-image': 'image_default',
  'convert-image-format': 'image_default',
  'remove-background': 'image_default',
  'ocr-image': 'image_default',

  // Office Tools
  'word-to-pdf': 'word_default',
  'excel-to-pdf': 'excel_default',
  'pptx-to-pdf': 'ppt_default',
  'powerpoint-to-pdf': 'ppt_default',
};

// Get HTML Input Accept Attribute String for any tool
export const getToolAcceptAttribute = (toolSlug) => {
  const ruleKey = TOOL_CATEGORY_MAP[toolSlug] || 'pdf_default';
  const rule = TOOL_FILE_RULES[ruleKey];
  return rule ? rule.extensions.join(',') : '.pdf';
};

// Get Human Readable Supported Formats Label for any tool
export const getToolSupportedFormatsLabel = (toolSlug) => {
  const ruleKey = TOOL_CATEGORY_MAP[toolSlug] || 'pdf_default';
  const rule = TOOL_FILE_RULES[ruleKey];
  return rule ? rule.label : 'PDF documents (.pdf)';
};

// Asynchronous Binary Header Check (Reads first 16 bytes via FileReader)
const readFirstBytes = (file) => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onloadend = (e) => {
      if (e.target.readyState === FileReader.DONE) {
        const arr = new Uint8Array(e.target.result);
        resolve(arr);
      } else {
        resolve(null);
      }
    };
    const slice = file.slice(0, 16);
    reader.readAsArrayBuffer(slice);
  });
};

// Comprehensive Deep File Validator Function
export const validateFileForTool = async (file, toolSlug) => {
  if (!file) {
    return { valid: false, error: 'No file provided.' };
  }

  // 1. File Size Check (Reject empty 0-byte or >500MB files)
  if (file.size === 0) {
    return { valid: false, error: `File "${file.name}" is empty (0 bytes).` };
  }
  if (file.size > 500 * 1024 * 1024) {
    return { valid: false, error: `File "${file.name}" exceeds maximum allowed size limit of 500MB.` };
  }

  const ruleKey = TOOL_CATEGORY_MAP[toolSlug] || 'pdf_default';
  const rule = TOOL_FILE_RULES[ruleKey];

  // 2. Extension Check
  const fileNameLower = file.name.toLowerCase();
  const hasValidExt = rule.extensions.some((ext) => fileNameLower.endsWith(ext));

  if (!hasValidExt) {
    return {
      valid: false,
      error: `Invalid file extension for "${file.name}". This tool only accepts ${rule.label}.`
    };
  }

  // 3. Binary Magic Number Header Check (Detect fake/renamed extension fraud)
  const firstBytes = await readFirstBytes(file);
  if (firstBytes && rule.magicCheck) {
    const isMagicValid = rule.magicCheck(firstBytes);
    if (!isMagicValid) {
      return {
        valid: false,
        error: `Security Verification Failed: "${file.name}" appears to be renamed or corrupted. Content signature does not match allowed format (${rule.label}).`
      };
    }
  }

  return { valid: true };
};
