# Third-party dependencies

The generated plugin bundles Workspace's own frontend modules. Hermes supplies
React and its plugin SDK at runtime; no second React instance is bundled.

Python dependencies are resolved by Hermes PM, not copied into this package:

| Package | Exact version | Upstream licence |
| --- | --- | --- |
| pypdf | 6.21.4 | BSD-3-Clause |
| ReportLab | 5.1.0 | BSD |
| Pillow | 13.0.0 | HPND |
| charset-normalizer | 3.5.2 | MIT |

`requirements.lock` preserves artifact hashes from the pinned Hermes upstream
lock. Installed packages carry their own notices. esbuild, jsdom and related
Node dependencies in package-lock.json are development/test tools; they are not
runtime imports in the installed ESM. pdf2image, LibreOffice and Poppler were QA
tools, not shipped runtime dependencies. PDF CJK export uses reader-supported
standard CID fonts rather than redistributing font binaries.

Workspace's own publication licence has not been selected. This file records
dependency provenance and does not grant rights to Workspace source.
