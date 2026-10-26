# Image Compressor

A client-side image compressor built with React, Vite, and browser canvas APIs. Image contents are processed in the browser and are not uploaded to a server.

## Requirements

- Node.js 22.12 or newer
- npm

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. To check the application before deployment:

```bash
npm test
npm run lint
npm run build
```

The production output is written to `dist/`. No deployment provider, domain, backend, or environment variables are configured by this project.

## Target-size landing pages

React Router serves the shared compressor at `/` and the SEO pages `/compress-image-to-50kb`, `/compress-image-to-100kb`, `/compress-image-to-200kb`, and `/compress-image-to-500kb`. The `/heic-to-jpg-converter` page selects JPG output, but HEIC decoding is not yet enabled; see the HEIC limitation below. Production hosting should be configured to serve the SPA entry point for these paths.

## Supported formats

- **Input that can be processed:** JPG/JPEG, PNG, and WebP, subject to the browser being able to decode the image.
- **Output:** JPG or WebP.
- **HEIC/HEIF:** File signatures are recognized, but decoding is currently blocked. The integration is isolated in `src/lib/heicAdapter.js`. The `heic-to` package is actively maintained and offers a browser worker entry point, but its declared license is LGPL-3.0. Its distribution and compliance requirements have not been reviewed for this project, so it is not installed. The older alternative `heic2any` is MIT-licensed but has not been released since 2023. Select and review an HEIC decoder before claiming HEIC processing is supported.

The app accepts files up to 25 MB and 10 files per batch. Decoding is sequential and images over 40 megapixels are rejected to limit browser memory pressure. Browser canvas export may remove metadata such as EXIF camera information and GPS location; metadata is not preserved.

## Compression behavior and limitations

Presets are 100 KB, 200 KB, and 500 KB; custom targets range from 10 KB to 25,600 KB. A target is a goal, not a guarantee. The compressor searches bounded quality settings and, when needed, reduces dimensions while preserving aspect ratio. If the target is not reached within those bounds, the best attempted output is returned with a visible warning.

WebP output retains transparency when the browser supports WebP encoding. JPG has no alpha channel, so the canvas is filled white before drawing. EXIF orientation is handled by the browser decoder where supported. Browser canvas encoders and memory limits differ, and very large or corrupted files may fail; remove the failed image or try a smaller copy.

## Privacy

Files are read, previewed, and encoded locally using browser APIs. No image upload, server processing, analytics, or tracking is configured. Temporary object URLs and decoded image resources are released when files are removed or the page is closed. As with any browser application, hosting infrastructure may independently collect ordinary web-request logs; this app itself does not send file data to a service.

## Suggested manual checks

1. Select and drop valid JPG, PNG, and WebP images; verify the original preview and output preview.
2. Try the presets and a valid/invalid custom target, and check actual output bytes and savings.
3. Use transparent PNG/WebP images with WebP and JPG output to verify alpha preservation and white flattening respectively.
4. Try corrupt bytes, a mismatched extension/MIME type, an empty file, files over 25 MB, and a batch over 10; ensure each produces a useful message without blocking valid files.
5. Remove individual files while others remain, download a result, change the output format, and repeat compression.
6. On physical iOS Safari and Android Chrome devices, test normal image selection and, after a decoder is approved and implemented, HEIC/HEIF orientation and high-resolution fixtures. HEIC/HEIF processing is currently unavailable.
