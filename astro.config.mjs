import { defineConfig } from 'astro/config';
import cloudflare from "@astrojs/cloudflare";
export default defineConfig({
  vite: {
    optimizeDeps: {
      include: ['pdf-lib', 'jszip', 'pdfjs-dist', 'tesseract.js', 'gifenc', 'qrcode-generator', 'jsbarcode']
    }
  },

  adapter: cloudflare()
});