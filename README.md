# Loupe

A browser extension that validates [IIIF](https://iiif.io) **Presentation API** manifests — a linter for the people who author and hand-craft them, not a pass/fail gate.

Loupe turns a raw manifest (pasted, fetched from a URL, or opened from a file) into a readable, layered validation report. Everything runs **client-side**: nothing you load is ever sent to a server, which matters when you're working with unpublished collection data.

> Status: **early and in active development.** Layers 1 and 2 (below) are working today; the richer authoring experience (code view, outline, link checking) is on the roadmap.

## Why

Validators already exist (the official IIIF validators, for one). Loupe's aim isn't the check — it's the **authoring experience**:

- **Readable errors** — plain language and the JSON path, not raw schema internals.
- **Client-side and private** — no backend; collection data never leaves your browser.
- **An extension, not a web app** — so it can make cross-origin requests a page can't (the basis for link checking).

## The layered validation model

Every finding is tagged with the layer it came from, because a 404 and a missing property are different kinds of problem.

| Layer | Question | Status |
|---|---|---|
| 1. Well-formedness | Is it parseable JSON? | ✅ |
| 2. Spec conformance | Does it match the Presentation API 3.0 structure? | ✅ |
| 3. Linking | Do referenced URLs resolve? | planned |
| 4. Best-practice lint | Valid, but ill-advised? | planned |

Validation produces a list of findings with a consistent shape (`{ severity, layer, message }`); the UI is purely a rendering of that list.

## Install (from source)

Loupe isn't in the extension stores yet. To run it:

```sh
npm install
npm run build      # builds the extension into dist/
```

Then load `dist/` as an unpacked extension:

- **Chrome:** `chrome://extensions` → enable Developer mode → *Load unpacked* → select `dist/`.
- **Firefox:** `about:debugging` → This Firefox → *Load Temporary Add-on* → select a file in `dist/`.

Click the toolbar icon to open the workbench in a full tab.

## Develop

```sh
npm run dev        # watch + auto-reload in a dev browser
```

Tech: **Manifest V3**, **Vite** (`vite-plugin-web-extension`), and **Ajv** for JSON Schema validation. Because MV3's content-security policy forbids `eval`, the IIIF schema is **precompiled to a standalone, eval-free validator at build time** (`scripts/build-validator.js`) rather than compiled in the browser.

## License

ISC. See [LICENSE](./LICENSE).
