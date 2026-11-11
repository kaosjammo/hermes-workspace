# Production-derived replacement status

Development preview for catalogue review. Source tracking: [issue 13](https://github.com/kaosjammo/hermes-workspace/issues/13).

- Release metadata: 0.1.1. Runtime code is preserved from Mike's designated production installation, not substituted from an older submitted branch.
- Desktop bundle SHA-256: `dce73634c6ec36ce5258ed212d99da7d519ec14dce66cc42e5c6a021834cd0e9`.
- Full editable source and tests are retained at the repository root. The catalogue installation subdirectory is `dist/workspace`, generated through the existing 22-file package selection.
- Two independent builds reproduced the exact production bundle using the original dependency-relative layout. A different layout changes generated CommonJS labels; this is not a universal path-independent build claim.
- Metadata/documentation-only runtime differences: version fields, refreshed README/repository links and corrected bundled React DOM disclosure/full MIT notice. No functionality was removed to pass validation.
- Independent source/privacy review and a complete feature inventory were performed. Bounded Gitleaks scanning of the original 222-file frozen source found no secrets. This is not a universal privacy guarantee.
- Earlier broad test attempts lacked required task-owned evidence directories and interpreter aliases. Those setup failures are preserved, not represented as product failures or green suites. Corrected focused workflow tests passed 31/31; the corrected HTTP fixture test passed 1/1. Full settled-candidate suite results are reported separately on the catalogue PR, not inferred from these focused passes.
- The final 22-file runtime package passed the official `hermes plugins validate --install-deps --json` command: all 16 checks passed, exit 0. The source/package bytes were unchanged by validation. Raw public check results and 3 warning groups are in [VALIDATION-0.1.1.json](VALIDATION-0.1.1.json). The isolated validator host was the released Hermes v0.23.0 commit `2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19`.

## Gates not waived by automated validation

Private same-process native owner/admission/terminal/database interfaces still require maintainer adjudication. Workspace-scoped SDK-component selectors produce cautions requiring review. Provider-positive saved editing, active-provider cancellation, native Electron visual acceptance, complete restart/compaction/approval lifecycle and macOS/Windows execution are not established by this preparation. Source-present local sharing and per-page executor primitives are not composed into a completed default UX.

Workspace's own reuse licence remains unselected; no open-source grant is asserted. React DOM's required MIT notice is included in THIRD-PARTY-NOTICES.md. The existing screenshot is synthetic earlier-build media, not current native acceptance. Catalogue publication is a request for review, not permission to merge or a claim of maintainer approval.
