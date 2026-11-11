# Workspace 0.1.2: author-tested production snapshot

Source tracking: [issue 13](https://github.com/kaosjammo/hermes-workspace/issues/13). This is a new catalogue review candidate, not the withdrawn 0.1.1 submission.

## Current evidence

- The author reports the corrected plugin passed the intended behaviour test and explicitly authorised this fresh validation and new PR.
- Release metadata: 0.1.2; catalogue install subdirectory: `dist/workspace`. All 22 packaged files are accounted for. Full editable source and tests remain at repository root.
- Desktop bundle SHA-256: `c29344c557e53df72f6eff176d0f84d72759ad8de97abe6e618f2201527cd9af`. Desktop and backend executable files are copied byte-for-byte from the tested installed package. Only release metadata, README and required third-party notices differ from the installation. No feature was removed for validation.
- Addressed feedback highlights its replacement paragraph. Merged/overlapping passages preserve independent comment identities, saved replies and resolution state. Display recovery does not enable an unproven independent revert.
- Fresh official `hermes plugins validate --install-deps --json` on the exact final 22-file package: exit 0, **16/16 checks passed**, package bytes unchanged. Released isolated Hermes v0.23.0 host, commit `2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19`. See [all check results and warnings](VALIDATION-0.1.2.json).
- Fresh isolated Python suite: **303 tests passed**, exit 0. Fresh canonical UI/component aggregate: **208 tests across 38 suites passed**, exit 0, no failures. Legacy fixture directories/interpreter invocation and fresh per-run state are prerequisites; earlier setup failures are retained privately, not described as passing.
- The author's updated paragraph-behaviour regression tests accompany the fix. Legacy changed-word-only expectations were reconciled to the new paragraph display contract, while immutable anchors, detached/ambiguous refusal, independent discussions and revert guards remain checked.
- Bounded Gitleaks scan: exit 0, no leaks found. Private user data, credentials, manuscripts and runtime evidence are not included.

## Qualification boundaries

The included bundle is the exact tested installed artifact, including the author's narrow paragraph-function transplant. A fresh source build reproducing those exact hand-transplanted bytes is **not claimed** for 0.1.2; the two-build identity receipt for 0.1.1 is historical and is not reused as new build proof.

Three validator warning groups remain: undocumented native core imports, private database attribute access and SDK-selector cautions. Maintainer adjudication is required before admission. Provider-positive saved editing, active-provider cancellation, independent native Electron qualification, complete lifecycle and macOS/Windows execution are not established by these automated checks. Author-reported acceptance is separate evidence, not a substitute for those independent cells. Local sharing/executor primitives are retained but not a completed default UX.

Workspace's own reuse licence remains unselected. Required bundled React DOM MIT notices remain included. Existing gallery media is an earlier synthetic demonstration, not current native acceptance. Catalogue publication requests review; it is not maintainer approval or permission to merge. No production files, profiles or conversations were changed by this publication work.
