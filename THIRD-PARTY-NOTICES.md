# Third-party dependencies

The generated plugin bundles Workspace's own frontend modules and React DOM
19.3.0 (react-dom/index.js and react-dom/cjs/react-dom.development.js). Hermes
supplies the React singleton and its plugin SDK; no second React instance is
bundled. React DOM's copyright and full MIT permission notice follow below.

Python dependencies are resolved by Hermes PM, not copied into this package:

| Package | Exact version | Upstream licence |
| --- | --- | --- |
| pypdf | 6.21.4 | BSD-3-Clause |
| ReportLab | 5.1.0 | BSD |
| Pillow | 13.0.0 | HPND |
| charset-normalizer | 3.5.2 | MIT |

`requirements.lock` preserves artifact hashes from the pinned Hermes upstream
lock. Installed packages carry their own notices. esbuild, jsdom and related
Node dependencies in package-lock.json are development/test tools except the
React DOM source bundled as described above. There is no external React DOM
runtime import in the installed ESM. pdf2image, LibreOffice and Poppler were QA
tools, not shipped runtime dependencies. PDF CJK export uses reader-supported
standard CID fonts rather than redistributing font binaries.

Workspace's own publication licence has not been selected. This file records
dependency provenance and does not grant rights to Workspace source.


## Bundled React DOM 19.3.0

Source: https://github.com/facebook/react/tree/v19.3.0/packages/react-dom

The following licence applies to React DOM, not to Workspace-owned source:

```text
MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
