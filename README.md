# iLoveMyFiles

**iLoveMyFiles** is a free, privacy-first suite of 29 browser-based tools for PDFs, images, text, and data, plus one India-only analytics tool for CBSE result gazettes. Files are processed locally on your device - the tools do not upload your documents or text to an iLoveMyFiles server, and no account or sign-up is required.

Pick a tool, add a file or paste text, adjust the options, run it, and download the result. Everything runs in the browser using JavaScript, WebAssembly, Canvas, and Web Crypto.

## Highlights

- **29 tools** across PDF organization, PDF optimization, PDF conversion, PDF editing, images, and data/text.
- **Local processing** - files, text, and generated results stay in your browser.
- **No account, no subscription, no usage limits.**
- **Batch workflows** - multiple files, per-file settings, individual downloads, or ZIP bundles where supported.
- **Live previews** - PDF page thumbnails, page selection, zoom, fit-to-page/fit-to-width, and full-screen preview.
- **Session restore** - files and settings can be restored after a reload, with an explicit Restore or Discard choice.
- **Recently used tools** - the last six tools you opened are remembered in your browser.
- **Dark mode** - follows your system preference on first visit and remembers your choice.
- **Keyboard and accessibility support** - semantic markup, visible focus styles, ARIA labels/live regions, dialog focus trapping, reduced-motion handling, and WCAG 2.2 AA-oriented colour contrast.
- **CBSE result analytics** - the India-only CBSE Result Analyzer reads a result gazette (PDF or TXT) in the browser and turns it into subject-wise marks, a pass percentage with a stated denominator, grade distributions, compartment statistics and downloadable reports.
- **No external font requests** - the interface uses a system font stack.

## How it works

1. Open a tool from the home page, a category, the Popular tools strip, or your Recently used list.
2. Add input by dragging files onto the drop zone, using the file picker, pasting an image, or typing text.
3. Adjust the available options - page size, orientation, margins, quality, format, page ranges, fonts, positions, and more.
4. Run the tool. Processing happens locally in your browser.
5. Preview the result where supported, then download individual files or a ZIP bundle.

Large files can take longer depending on your device and available memory. Nothing is transmitted to a server for processing; see [Privacy, storage, and network activity](#privacy-storage-and-network-activity) for the few network requests the site does make.

## Complete tool list

The 29 tools are grouped into six categories:

- [Organize PDF](#organize-pdf) - 6 tools
- [Optimize PDF](#optimize-pdf) - 2 tools
- [Convert PDF](#convert-pdf) - 2 tools
- [Edit PDF](#edit-pdf) - 4 tools
- [Image tools](#image-tools) - 6 tools
- [Data & text](#data--text) - 9 tools

### Organize PDF

| Tool | Features | Output |
| --- | --- | --- |
| **Merge PDFs** (`merge-pdf`) | Combine two or more PDFs. Add, remove, and reorder files or individual pages with drag-and-drop, move controls, or keyboard controls. Live merged-page preview. Optional page size, orientation, margin, and output quality; original page size is kept by default. | One merged PDF |
| **Split PDF** (`split-pdf`) | Split every page into its own PDF and download a ZIP, or extract selected pages/ranges into one PDF. Accepts multiple PDFs and splits each one separately. | ZIP of single-page PDFs or one extracted PDF |
| **Delete PDF pages** (`delete-pdf-pages`) | Click pages in the preview to mark them for deletion, or type page numbers/ranges. At least one page must remain. | Trimmed PDF |
| **Rotate PDF pages** (`rotate-pdf`) | Select a page in the preview and rotate it 90° counter-clockwise, 90° clockwise, or 180°. Each page keeps its own rotation; reset the current page when needed. | Rotated PDF |
| **Resize PDF pages** (`resize-pdf`) | Change page size to A0–A6, B4, B5, US Letter, US Legal, Tabloid, US Executive, US Statement, or Folio. Choose portrait, landscape, or match each page, plus a margin. Content is scaled to fit and centred without cropping. | Resized PDF |
| **Organize PDF pages** (`organize-pdf-pages`) | Type a new page order such as `3, 1, 2` or `1-3, 1`. Repeat a page number to duplicate it, use ranges, or omit pages to remove them. Live page preview. | Reorganized PDF |

### Optimize PDF

| Tool | Features | Output |
| --- | --- | --- |
| **Remove PDF metadata** (`remove-pdf-metadata`) | Inspect title, author, subject, keywords, creator application, PDF producer, creation/modification dates, document language, and XMP metadata before changing anything. Select individual properties, select all, or clear the selection, then confirm removal. Page content, links, annotations, and forms are preserved where supported. | Cleaned PDF |
| **Compress PDF** (`compress-pdf`) | Three levels: Extreme, Recommended, and Less compression. Pages are re-rendered as images, trading text selectability for smaller size. If the result would be larger, the original file is kept. | Smaller PDF |

### Convert PDF

| Tool | Features | Output |
| --- | --- | --- |
| **Images to PDF** (`image-to-pdf`) | Combine JPG, PNG, or WebP images into one PDF in the order shown. Reorder images, choose page size (Fit image, A3, A4, A5, B5, Letter, Legal, Tabloid, Executive), orientation, and margin. EXIF orientation is applied automatically. | One PDF |
| **PDF to images** (`pdf-to-images`) | Render PDF pages as PNG or JPG at 36–400 DPI. Export every page or select pages/ranges in the preview. Download individually or as a ZIP. | PNG/JPG images or ZIP |

### Edit PDF

| Tool | Features | Output |
| --- | --- | --- |
| **Add page numbers** (`add-page-numbers-pdf`) | Add numbers to every page. Choose top/bottom and left/centre/right, starting number, format (`Page 1`, `Pg 1`, `- 1 -`, `1`, or custom text), font, size, and bold/italic/underline styling. | Numbered PDF |
| **Watermark PDF** (`watermark-pdf`) | Add diagonal text to every page. Control the text, font, size, opacity, colour, bold/italic/underline styling, and rotation angle. | Watermarked PDF |
| **Flatten PDF** (`flatten-pdf`) | Render each page to an image and rebuild the PDF, removing the selectable text layer. Choose 110/150/200/300 DPI and JPEG quality (60%, 80%, 92%) or lossless PNG. Useful for flattening forms and annotations, but it does not make a document confidential. | Flattened PDF |
| **Make PDF searchable** (`make-pdf-searchable`) | Add an invisible, selectable OCR text layer to scanned/image-only PDFs while preserving the page appearance. Choose English, Spanish, French, German, Italian, Portuguese, Dutch, Swedish, Danish, Norwegian, or Finnish; choose 110–300 DPI and JPEG/PNG output quality. | Searchable PDF |

### Image tools

All image tools support common browser-readable images and output to JPG, JPEG, PNG, WebP, BMP, GIF, ICO, SVG, and TIFF unless noted.

| Tool | Features | Output |
| --- | --- | --- |
| **Image format converter** (`image-converter`) | Batch-convert images between JPG/JPEG, PNG, WebP, BMP, GIF, ICO, SVG, and TIFF. Optional margin padding. Download results individually or as a ZIP. | Converted images |
| **Image compressor** (`compress-image`) | Reduce file size using a quality slider (20–95%) or a target size in KB (5–50,000 KB, best-effort). Quality mode applies to JPG/WebP; target-size mode works with the supported output formats. | Smaller images |
| **Image resizer** (`resize-image`) | Set exact width and height up to 20,000 px per side, with optional aspect-ratio locking and margin padding. Per-image settings can be edited individually, applied to all images, or reset. | Resized images |
| **Crop image** (`crop-image`) | Drag directly on the live preview to select the crop area. Free, 1:1, 4:3, 16:9, 3:4, and 9:16 aspect ratios, live pixel dimensions, optional margin, and output format choice. | Cropped image |
| **Rotate & flip images** (`rotate-image`) | Rotate 90° counter-clockwise, 90° clockwise, or 180°, and flip horizontally or vertically. Live rotation readout, reset control, and output format choice. | Rotated/flipped image |
| **Watermark image** (`watermark-image`) | Add a text watermark with selectable position (top-left, top-right, bottom-left, bottom-right, or centre), colour, opacity, size as a percentage of the image, and output format. | Watermarked image |

### Data & text

| Tool | Features | Output |
| --- | --- | --- |
| **JSON formatter** (`json-formatter`) | Pretty-print or minify JSON with indentation from 0–8 spaces. Validates input and reports readable error positions. | Formatted or minified JSON |
| **Base64 encoder** (`base64-encoder`) | Encode UTF-8 text to Base64 or decode Base64 back to text. Accents and emoji survive the round trip. | Encoded or decoded text |
| **Hash generator** (`hash-generator`) | Create SHA-256, SHA-384, or SHA-512 hashes from pasted text or dropped files. Multiple files produce one hash per file. Uses the Web Crypto API locally. | Hash strings |
| **Word counter** (`word-counter`) | Count words, characters (with and without spaces), lines, sentences, and paragraphs, plus estimated reading time at roughly 200 words/minute. | Text statistics |
| **JSON ↔ CSV** (`json-to-csv`) | Convert a JSON array of objects to CSV, or a CSV table with a header row to JSON. Handles quoted values, commas, and escaping. | Converted data |
| **Unit converter** (`unit-converter`) | Convert data size (bytes, KB, MB, GB, TB; 1024-based), length (metres), mass (grams), and time (seconds) into every unit in the selected category. | Converted values |
| **OCR - image & PDF** (`ocr`) | Extract text from an image or PDF with Tesseract.js. Languages: English, Spanish, French, German, Italian, Portuguese, Dutch, Russian, Arabic, Simplified Chinese, and Japanese. The engine/language data download once on first use and are cached. | Recognised text |
| **QR code generator** (`qr-code-generator`) | Turn text or a URL into a QR code. Choose error-correction level (L, M, Q, H) and pixel size. Download as PNG. | QR code PNG |
| **Barcode generator** (`barcode-generator`) | Generate 1D barcodes as PNG. Supports Code 128, EAN-13, UPC-A, Code 39, and ITF-14 with adjustable bar width and height. | Barcode PNG |

### India only

| Tool | Features | Output |
| --- | --- | --- |
| **CBSE Result Analyzer** (`cbse-result-analyzer`) | Reads a CBSE school or roll-number-wise result gazette (text-based PDF, scanned PDF with on-device OCR, or TXT) and turns it into subject-wise marks, a pass percentage with an explicit denominator, grade distributions, compartment statistics, a data-quality review and a dashboard of ten interactive charts. Filters cover year, class, school, region, subject, result status, grade and score range. Exports: PDF summary report, CSV tables, Excel workbook and PNG chart images. Offered to visitors in India only. | Interactive dashboard and reports |

- Route: `/tools/cbse-result-analyzer/`
- Parsing schema: [docs/cbse-gazette-schema.md](docs/cbse-gazette-schema.md)
- Supported formats and limitations: [docs/cbse-supported-formats.md](docs/cbse-supported-formats.md)

## Shared features

### Home page and discovery

- **Popular tools** strip for quick access to frequently used tools.
- **Recently used tools** - the six most recently opened tools, stored locally in your browser and clearable from the home page.
- **Live search** across tool names, descriptions, and keywords.
- **Category filters** with tool counts, `aria-pressed` state, keyboard Arrow/Home/End navigation, and an announced result count.
- **No-results message** and accessible status updates when the filtered list changes.
- **India-only entry points** - the CBSE Result Analyzer card and its navigation link are revealed only after the server has confirmed the visitor's country. The country comes from the hosting provider's trusted geo data (`CF-IPCountry` on Cloudflare), never from a header the browser can set, and the check fails closed when the country cannot be determined. The public landing page, its guide and its sample output stay open to everyone, including search crawlers, and no student data is ever published on it.
- **Country gate and authorisation are separate** - being in India unlocks the tool, not anybody's private records. The student tables and the exports show the name and roll number printed in your own file, and nothing ever leaves the browser.

### File input and processing

- Drag-and-drop, file-picker, and keyboard activation of the drop zone.
- Paste an image directly with ⌘/Ctrl + V where supported.
- Multi-file input for tools that support batches.
- Replace the current file or clear all files and start over.
- Per-file settings for image resize, with Apply to all and Reset actions.
- Progress reporting with an accessible progress bar and status messages.
- Results region with labelled download controls.
- Individual downloads or ZIP bundles where supported.

### Preview workspace

- PDF page thumbnails and a file strip for multi-file tools.
- Click pages to select them for page-based operations.
- Previous/next page and previous/next document navigation.
- Zoom in/out, fit width, fit page, and full-screen preview.
- Page and document counters with live-region announcements.
- Replace/clear file controls without leaving the workspace.

### Sessions and persistence

- The current tool's files and settings are saved locally in IndexedDB shortly after changes.
- Returning to a tool shows a **Previous session found** banner with **Restore session** and **Discard** options.
- Session restoration includes files, page selections, per-page rotations, image settings, merge order, text input, and generated output where applicable.
- PDF preview thumbnails are cached locally, up to 24 previews per tool.
- Session saving is best-effort and may be unavailable in private browsing, when storage is blocked, or when the browser's storage quota is exceeded.

### Appearance and accessibility

- Light and dark themes, initialised from the system preference and saved locally.
- Reduced-motion support disables transitions and animations when requested.
- Keyboard-operable tabs, dialogs, tiles, filters, and preview controls.
- Dialog focus trapping and focus return.
- Visible focus indicators and minimum target sizes for small controls.
- Semantic headings, lists, landmarks, and live regions.
- No external font downloads.

## Privacy, storage, and network activity

### Local processing

- File contents and pasted text are processed in your browser.
- Files are not uploaded to an iLoveMyFiles server for processing.
- Generated results are created as browser blobs for download.

### What is stored in your browser

- **IndexedDB** (`ilovemyfiles-sessions`): saved session metadata, file blobs, and cached PDF previews for session restore.
- **localStorage**: theme choice (`ilovemyfiles-theme`), recently used tools (`ilovemyfiles-recent-tools`), and recently used fonts.
- Saved sessions and files remain in your browser until you discard the session, clear site data, or the browser removes them. Use **Discard** and clear site data on shared devices.

### Third-party requests

- **Google AdSense** loads an advertising script (`adsbygoogle.js`) on pages. Google and its advertising partners may use cookies or device data as described in their own policies. File contents and pasted text are not sent to the ad network by these tools.
- **OCR** downloads the Tesseract.js engine and language data from a CDN on first use; the browser caches them.
- **PDF rendering** uses a bundled PDF.js worker served from the same site.
- The site does not include a first-party analytics script.

### Security headers

`public/_headers` configures:

- a Content Security Policy restricting scripts, frames, images, and connections to the required origins;
- `Strict-Transport-Security` with `includeSubDomains` and `preload`;
- `X-Content-Type-Options: nosniff`;
- `X-Frame-Options: DENY`;
- `Cross-Origin-Opener-Policy: same-origin`;
- `Referrer-Policy: no-referrer`.

## Caveats and limitations

- **Browser memory is the limit.** Very large PDFs or images may be slow, fail, or need a desktop browser with more memory. Metadata inspection and PDF text-layer conversion work best under 250 MB.
- **Compression, flattening, and PDF-to-image conversion rasterise pages.** Existing text becomes unselectable and unsearchable.
- **Flattening is not redaction.** OCR can still read rendered page images, and metadata or annotations may remain.
- **Compressing may increase size.** If compression would make a PDF larger, the original is kept.
- **OCR accuracy varies** with scan quality, resolution, language, and page layout.
- **SVG output wraps the rendered image in an SVG container.** It does not convert the image into traced vector paths.
- **Session restore depends on browser storage.** Private windows, blocked storage, and quota limits can prevent persistence.
- **Ads may be blocked.** Ad blockers can prevent AdSense from loading; this does not affect the tools.

## Tech stack

- **Astro 5** with the **Cloudflare adapter** - static page generation, routing, and deployment.
- **pdf-lib** - PDF creation and manipulation: merge, split, delete, rotate, resize, organize, page numbers, watermarks, metadata removal, searchable text layers.
- **pdfjs-dist** - PDF rendering, thumbnails, previews, and text extraction.
- **Tesseract.js** - on-device OCR for images and PDFs.
- **jszip** - ZIP archives for split PDFs and batch image downloads.
- **jsbarcode** - 1D barcode generation.
- **qrcode-generator** - QR code generation.
- **gifenc** - GIF encoding for image conversion.
- **Canvas, Web Crypto, IndexedDB, and localStorage** - image processing, hashing, session restore, and preferences.
- **axe-core and Puppeteer** (dev dependencies) - accessibility and browser automation audits.
- **Node.js built-in test runner** - the parsing, statistics, validation, export and country-policy tests run with `npm test`, with no test framework to install.
- **Node.js 22.22+** for development and builds.

## Getting started

```bash
npm install
npm run dev        # start the Astro dev server
npm run build      # build the static site into dist/
npm run preview    # build, then run the Cloudflare/Wrangler preview
npm run deploy     # build and deploy to Cloudflare Pages
npm test           # run the unit, regression and policy tests
```

The dev server can be started in background mode with `astro dev --background` and managed with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Project structure

```
src/
  pages/
    index.astro          # home page, search, categories, popular/recent tools
    [slug].astro         # generated per-tool landing pages
    tools/
      cbse-result-analyzer.astro  # India-only CBSE gazette analyzer (server rendered)
    api/
      geo.json.ts        # country policy endpoint used by the gated entry points
  layouts/
    BaseLayout.astro     # shared shell, header, footer, theme, ads
  components/
    ToolWorkspace.astro  # tool page shell, drop zone, session banner, results
    ToolOptions.astro    # renders per-tool controls
    ToolSeoContent.astro # tool page headings, breadcrumbs, SEO content
    PreviewWorkspace.astro
    MergeWorkspace.astro
    CropEditor.astro
    HomeToolFilters.astro
    ThemeToggle.astro
    GlobalStyles.astro
    client/              # browser-side logic, loaded on tool pages
      ClientRuntime.astro
      tool-dialog.astro
      pdf-tools.astro
      image-tools.astro
      metadata-tools.astro
      data-tools.astro
      ocr.astro
      generator-tools.astro
      preview-workspace.astro
      merge-workspace.astro
      crop-editor.astro
      session-store.astro
      font-picker.astro
      dialog-focus-trap.astro
      ...and supporting modules
  components/
    CbseAnalyzer.astro   # CBSE analyzer workspace: upload, review, dashboard
    CbseStyles.astro     # CBSE analyzer styles
  data/
    tools.json           # tool registry: IDs, categories, card/SEO copy, icons
    tool-config.json     # per-tool descriptions, accepted files, and option markup
    cbse-tool.json       # the India-only tool entry, kept out of the public registry
    cbse-subjects.json   # CBSE subject code knowledge base (Class X and Class XII)
  lib/
    geo.js               # country resolution and the India-only feature policy
    cbse/
      subjects.js        # verified subject codes, status vocabulary, grade bounds
      parse-gazette.js   # gazette text -> dataset
      analytics.js       # dataset -> statistics, filters, score bands
      validate.js        # dataset -> data quality checks
      exporters.js       # dataset -> CSV, XLSX and PDF reports
  middleware.js          # resolves the country once per request
public/                  # favicon, headers, robots.txt, sitemap, llms.txt
docs/
  cbse-gazette-schema.md      # the parsing schema and the denominator definitions
  cbse-supported-formats.md   # supported gazette formats and known limitations
tests/                   # unit, regression and country-policy tests (node --test)
  fixtures/              # the anonymised 2025 gazette and its variants
```

## Contributing

To add or modify a tool:

1. Add an entry to `src/data/tools.json` (ID, slug, category, card text, SEO content, keywords, icon).
2. Add the tool's input options to `src/data/tool-config.json`, keyed by the **tool ID** used in `tools.json`.
3. Implement or extend the browser-side logic in the relevant `src/components/client/*.astro` module.
4. Reuse the shared preview, session, download, and progress helpers where possible.
5. Run `npm run build` to verify the static build, then `npm run preview` to test locally.

## License

Free to use. All processing happens locally in your browser - your files stay yours.
