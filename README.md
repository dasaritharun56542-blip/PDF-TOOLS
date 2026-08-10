---
title: PDF PowerHouse
emoji: ⚡
colorFrom: indigo
colorTo: blue
sdk: docker
app_port: 7860
pinned: false
---

# PDF PowerHouse ⚡

A comprehensive suite of 36+ high-performance PDF manipulation, conversion, optimization, and security tools powered by Python (PyMuPDF, ReportLab, Pillow) and a React SPA frontend.

## Features
- **PDF Manipulation**: Merge, Split, Rotate, Organize, Delete Pages, Extract Pages, Duplicate Pages, Reverse Page Order, Remove Blank Pages, Crop PDF.
- **Conversion**: PDF to Word, Excel, PowerPoint, JPG, PNG, PDF/A, HTML, TXT, RTF.
- **Image Tools**: Image to PDF, Resize, Crop, Compress, Format Conversion.
- **Security & Protection**: Protect PDF, Unlock, Redact, Sign, Watermark, Flatten.
- **Performance**: Asynchronous parallel processing, sub-millisecond local caching, and optional Supabase cloud storage synchronization.

## Architecture
- **Frontend**: React 19 + Vite SPA with Glassmorphic modern dark design.
- **Backend**: Python 3.12 + Django REST APIs with Gunicorn on port 7860.
- **Container**: Multi-stage Docker build combining React assets and Django engine into a single unified service.
