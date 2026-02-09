# Optical Exam System

A **client-side only** optical mark recognition (OMR) app for scanning and grading paper answer sheets. No backend, no database—everything runs in the browser and data is stored in `localStorage`. Works offline and is suitable for mobile camera scanning.

## Features

- **No server or database** — All data lives in the browser (`localStorage`)
- **Offline capable** — Use without an internet connection after first load
- **Mobile friendly** — Scan answer sheets with device camera (phone/tablet)
- **Easy to host** — Static files only; works on GitHub Pages, Netlify, Vercel, or any static host
- **No build step** — Vanilla JavaScript, no frameworks or bundlers
- **OMR engine** — OpenCV.js for image processing, marker detection, and bubble reading

## How it works

1. **Create an exam** — Set name, number of questions, options per question, and booklet types (e.g. A, B).
2. **Enter answer keys** — Define correct answers per booklet.
3. **Scan** — Use the device camera to capture a filled answer sheet; the app detects the form and reads marked bubbles.
4. **Results** — View scores (correct, wrong, empty, net, percentage) and export as CSV or JSON.

Optional: **Generate Form** — Print or export a blank answer sheet (PNG/PDF) matching the exam layout.

## Tech stack

| Layer        | Technology |
|-------------|------------|
| Frontend    | HTML5, CSS3, Vanilla JavaScript |
| OMR         | [OpenCV.js](https://docs.opencv.org/4.9.0/opencv.js) (v4.9.0) |
| Icons       | [Font Awesome](https://fontawesome.com/) |
| Export      | [html2canvas](https://html2canvas.hertzen.com/) (for form images) |
| Storage     | Browser `localStorage` |

## Project structure

```
optik/
├── index.html        # Single-page app shell and navigation
├── app.js            # UI logic, navigation, scan flow, modals
├── omr-processor.js  # OpenCV-based OMR (markers, perspective, bubbles)
├── form-template.js  # Answer sheet layout and ROI definitions
├── storage.js        # DataStore class (exams, answer keys, results)
├── style.css         # Styles
└── README.md
```

## Getting started

### Run locally

Open `index.html` in a browser, or serve the folder with a simple HTTP server (required for camera and some CORS behavior):

```bash
# Python
python -m http.server 8000

# Node (npx)
npx serve .

# PHP
php -S localhost:8000
```

Then open `http://localhost:8000` (or the port shown).

### Deploy

- **GitHub Pages:** Push to a repo → Settings → Pages → source: main branch (root or `/docs` if you put files there).
- **Netlify / Vercel:** Drag the folder or connect the repo; no build command needed.

Ensure your host allows:
- Scripts from `cdnjs.cloudflare.com`, `docs.opencv.org`
- Camera access (e.g. `Permissions-Policy: camera=(self)` on HTTPS)

## Data and export

- **Storage keys:** `optik_sinav_exams`, `optik_sinav_answerkeys`, `optik_sinav_results`, `optik_sinav_settings`
- **Export:** Results can be downloaded as CSV from the Results page; full data can be exported as JSON from the Data page (or via console: `exportAllData()`).
- **Import:** Use the Data page to import a previously exported JSON backup.

Data is per-browser/device; there is no sync or cloud backup.

## Limitations

- **Single device** — No cloud sync or multi-user collaboration
- **localStorage** — Typically 5–10 MB; large result sets may require periodic export/cleanup
- **OpenCV.js** — Loaded from CDN; scanning requires OpenCV to load successfully (first load needs network unless you self-host `opencv.js`)
- **Camera** — Needs HTTPS (or localhost) and user permission

## License

This project is licensed under the **MIT License**. See [LICENSE](LICENSE) for the full text.
