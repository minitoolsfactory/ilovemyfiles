# iLoveMyFiles

**iLoveMyFiles** is a free, privacy-first online suite of browser-based tools for working with PDFs, images, text, and data — right in your browser, no upload required.

Everything runs locally on your device. Your files never leave your computer, no server receives them, and no sign-up is required. Pick a tool, add your file or text, process it, and download the result.

## How it works

1. **Open a tool** from the home page or a tool category.
2. **Add your input** — drop a file, paste text, or type a value, depending on the tool.
3. **Configure options** — sizes, formats, ranges, quality levels, etc.
4. **Process** — the work happens in your browser using client-side libraries.
5. **Download** the result — individual files or a ZIP bundle where supported.

Because processing is local, large files may take longer depending on your device, but nothing is transmitted over the network (except the one-time download of the OCR engine on first use — see the OCR section).

## Supported tools

Tools are grouped into five categories:

- [Organize PDF](#organize-pdf)
- [Optimize PDF](#optimize-pdf)
- [Convert PDF](#convert-pdf)
- [Edit PDF](#edit-pdf)
- [Image tools](#image-tools)
- [Data & text](#data--text)

### Organize PDF

| Tool | What it does | Output |
| --- | --- | --- |
| **Merge PDFs** (`merge-pdf`) | Combine two or more PDFs into one document. Reorder files with up/down buttons or drag-and-drop before processing. | One combined PDF |
| **Split PDF** (`split-pdf`) | Extract pages into individual PDFs saved as a ZIP, or pull out a chosen page range into a single PDF. | ZIP of single-page PDFs, or one PDF |
| **Delete PDF pages** (`delete-pdf-pages`) | Remove specific pages or page ranges from a document. At least one page must remain. | Trimmed PDF |
| **Rotate PDF pages** (`rotate-pdf`) | Rotate all pages or selected pages by 90°, 180°, or 270°, clockwise or anticlockwise. | Rotated PDF |
| **Resize PDF pages** (`resize-pdf`) | Change page size to A4, A3, A2, A1, A0, A5, A6, B5, B4, US Letter, US Legal, Tabloid, US Executive, US Statement, or Folio. Content is scaled to fit and centred; nothing is cropped. | Resized PDF |
| **Organize PDF pages** (`organize-pdf-pages`) | Reorder pages by typing a new sequence (e.g. `3, 1, 2` or `1-3, 1`). Repeat a number to duplicate a page; omit one to remove it. | Reorganized PDF |

### Optimize PDF

| Tool | What it does | Output |
| --- | --- | --- |
| **Compress PDF** (`compress-pdf`) | Shrink file size with three levels: Extreme, Recommended, or Less. Pages are re-rendered as images, so text is no longer selectable afterwards. If compression would make the file larger, the original is kept. | Smaller PDF |
| **Remove PDF metadata** (`remove-pdf-metadata`) | Inspect document properties — title, author, subject, keywords, creator, producer, dates, language, and XMP — then select which to remove before downloading a cleaned copy. Page content, links, and annotations are untouched. | Cleaned PDF |

### Convert PDF

| Tool | What it does | Output |
| --- | --- | --- |
| **Images to PDF** (`image-to-pdf`) | Combine JPG, PNG, or WebP images into one PDF in the order shown (drag to reorder). Choose page size, orientation, margin, and EXIF orientation is applied automatically. | One PDF |
| **PDF to images** (`pdf-to-images`) | Render each PDF page as a PNG or JPG image. Choose resolution (36–400 DPI) and export all pages or a page range. Download individually or as a ZIP. | PNG/JPG images |

### Edit PDF

| Tool | What it does | Output |
| --- | --- | --- |
| **Add page numbers** (`add-page-numbers-pdf`) | Stamp sequential page numbers on every page. Choose position (top/bottom, left/centre/right), starting number, number format, font, size, and bold/italic/underline styling. | Numbered PDF |
| **Watermark PDF** (`watermark-pdf`) | Add a diagonal text watermark to every page — useful for drafts, confidential copies, or branding. Control text, size, opacity, colour, font, rotation angle, and styling. | Watermarked PDF |
| **Flatten PDF** (`flatten-pdf`) | Render each page to an image and rebuild the PDF so the original text layer is removed — text is no longer selectable, copyable, or searchable. Choose output resolution and JPEG quality or lossless PNG. **Note:** flattening does not make a document confidential; OCR can still read the page images. | Flattened PDF |
| **Make PDF searchable** (`make-pdf-searchable`) | Turn scanned or image-only PDFs into searchable PDFs. OCR recognises text on every page and overlays an invisible, selectable text layer while keeping the original page look. Choose language, render resolution, and output quality. | Searchable PDF |

### Image tools

| Tool | What it does | Output |
| --- | --- | --- |
| **Image Extension converter** (`image-converter`) | Convert between JPG, PNG, WebP, BMP, GIF, ICO, SVG, and TIFF. Batch-convert many images at once and download them as a ZIP. Optional margin padding. | Converted images |
| **Image compressor** (`compress-image`) | Reduce JPG/PNG/WebP file size with a quality slider (20–95%) or a target size in kilobytes (best-effort). Output as WebP or JPG. | Smaller images |
| **Image Size compressor** (`resize-image`) | Resize images to exact pixel dimensions (up to 20,000 px per side) with optional aspect-ratio locking. Add an optional margin. Output as PNG, JPG, WebP, BMP, GIF, ICO, SVG, or TIFF. | Resized images |
| **Crop image** (`crop-image`) | Drag a selection on a live preview to keep exactly the area you want. Lock aspect ratios (Free, 1:1, 4:3, 16:9, 3:4, 9:16) with live pixel dimensions. Optional margin and output format choice. | Cropped image |
| **Rotate & flip** (`rotate-image`) | Rotate images by 90° counter-clockwise, 90° clockwise, or 180°, and flip horizontally or vertically. Output as PNG, JPG, WebP, BMP, GIF, ICO, SVG, or TIFF. | Rotated/flipped image |
| **Watermark image** (`watermark-image`) | Stamp a text watermark onto images — copyright lines, branding, etc. Control text, colour, opacity, size, and one of nine positions (corners, edges, centre). Output as PNG, JPG, WebP, BMP, GIF, ICO, SVG, or TIFF. | Watermarked image |

### Data & text

| Tool | What it does | Output |
| --- | --- | --- |
| **JSON formatter** (`json-formatter`) | Pretty-print or minify JSON with adjustable indentation (0–8 spaces). Validates input and reports readable error positions. | Formatted JSON |
| **Base64 encoder** (`base64-encoder`) | Encode text to Base64 or decode Base64 back to readable text. UTF-8 safe, so accents and emoji survive the round trip. | Encoded/decoded text |
| **Hash generator** (`hash-generator`) | Create SHA-256, SHA-384, or SHA-512 hashes from pasted text or dropped files (one hash per file). Runs locally with the Web Crypto API — useful for checksums and verification. | Hash strings |
| **Word counter** (`word-counter`) | Count words, characters (with and without spaces), lines, sentences, and paragraphs, plus an estimated reading time (~200 words/minute). | Text statistics |
| **JSON ↔ CSV** (`json-to-csv`) | Convert a JSON array of objects to CSV, or a CSV table with a header row back to JSON. Values are quoted and escaped correctly, including commas inside values. | Converted table data |
| **Unit converter** (`unit-converter`) | Convert data size (bytes, 1024-based), length (metres), mass (grams), and time (seconds). Enter a value in the base unit and instantly see every other unit in the category. | Converted values |
| **OCR - image & PDF** (`ocr`) | Extract selectable text from an image or PDF using Tesseract.js running in your browser (WebAssembly). Choose from English, Spanish, French, German, Italian, Portuguese, Dutch, Russian, Arabic, Simplified Chinese, or Japanese. The engine and language data download once on first use and are cached. | Recognised text file |
| **QR code generator** (`qr-code-generator`) | Turn any link or text into a scannable QR code. Choose error-correction level (Low, Medium, Quartile, High) and pixel size. Download as PNG. | QR code PNG |
| **Barcode generator** (`barcode-generator`) | Generate 1D barcodes as PNG images. Supports Code 128, EAN-13, UPC-A, Code 39, and ITF-14 with adjustable bar width and height. | Barcode PNG |

## Key features across all tools

- **100% client-side processing** — files and text are handled entirely in your browser. Nothing is uploaded to a server.
- **No sign-up, no accounts** — open any tool and start using it immediately.
- **Free to use** — no subscriptions, no usage limits, no watermarks added by iLoveMyFiles.
- **Drag-and-drop file input** — most file-based tools accept drag-and-drop as well as the file picker.
- **Batch processing** — several tools accept multiple files at once (merge, split across multiple files, image converter, hash generator).
- **Download as ZIP** — split PDF and image converter let you download many results in a single ZIP archive.
- **Preview before processing** — several tools show page previews so you can select pages visually.
- **Dark mode** — the site supports a theme toggle for light and dark interfaces.

## Privacy and security

- Your files never leave your device. Processing happens locally in the browser.
- No file contents are sent to any server.
- The only network fetch is the one-time download of the OCR engine and language data (Tesseract.js via WebAssembly) when you first use an OCR tool; after that it is cached by your browser.
- iLoveMyFiles does not store your files, does not require an account, and does not track usage beyond standard web analytics.

**Caveats:**
- Compressing, flattening, or converting PDFs to images makes text no longer selectable or searchable.
- Flattening a PDF removes the selectable text layer but does **not** make a document confidential — OCR can still recover text from page images, and metadata or annotations may remain.
- SVG image output wraps the image in an SVG container; it does not trace the image into vector paths.

## Tech stack

- **Astro** — static site generator, server-rendered pages and components.
- **pdf-lib** — PDF creation and manipulation (merge, split, delete, rotate, resize, organize, page numbers, watermark, remove metadata).
- **pdfjs-dist** — PDF rendering and page previews.
- **Tesseract.js** — on-device OCR for images and PDFs.
- **jszip** — ZIP archives for split PDF and batch image downloads.
- **jsbarcode** — 1D barcode generation.
- **qrcode-generator** — QR code generation.
- **gifenc** — GIF encoding for image conversion.

## Getting started

### Development

```bash
npm run dev        # start the Astro dev server
npm run build      # build the static site into dist/
npm run preview    # preview the production build locally
npm run deploy     # build and deploy to Cloudflare Pages
```

The dev server can be started in background mode with `astro dev --background` and managed with `astro dev stop`, `astro dev status`, and `astro dev logs`.

### Project structure

```
src/
  pages/
    index.astro          # home page with all tools
    [slug].astro         # per-tool landing pages
  layouts/
    BaseLayout.astro     # shared page layout
  components/
    ToolLauncher.astro
    ToolOptions.astro
    PreviewWorkspace.astro
    MergeWorkspace.astro
    CropEditor.astro
    ...and more UI components
  components/client/     # browser-side interaction & file processing
    pdf-tools.astro
    image-tools.astro
    data-tools.astro
    ocr.astro
    font-picker.astro
    ...and more
  data/
    tools.json           # tool registry: titles, categories, SEO content
    tool-config.json     # per-tool input options and controls
public/                  # static assets
```

## Contributing

iLoveMyFiles is an Astro project. To add or modify a tool:

1. Add an entry to `src/data/tools.json` (category, card text, SEO content, keywords).
2. Add input options to `src/data/tool-config.json` keyed by the tool slug.
3. Implement or extend the browser-side logic in the relevant `src/components/client/*.astro` component.
4. Run `npm run build` to verify the static build, then `npm run preview` to test locally.

## License

Free to use. All processing happens locally in your browser — your files stay yours.
