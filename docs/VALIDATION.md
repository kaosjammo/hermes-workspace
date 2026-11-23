> **Historical initial-submission document.** For this production-derived replacement, use [current release status](RELEASE-STATUS.md), the [current README](../README.md) and [production feature audit](PRODUCTION-FEATURES.md). Old source identities, backlog labels and check totals below are preserved history, not qualification of the new pin.

# Catalog validation and compatibility

## Recorded probe

Initial public source commit `847b0b99478fb3cc23364db04ee1b6b96b439e78` was validated in an isolated clean Hermes checkout at public upstream commit `2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19`.

```bash
hermes plugins validate /path/to/frozen/plugin --install-deps --json
```

The actual CLI returned **exit 0, 16/16 passing checks**, with three unsuppressed warning groups. Dependency preparation independently completed successfully; all four declared versions were checked in private PM dependency storage. The [unaltered JSON probe output](validation-847b.json) records the checks and exact warnings. No live Hermes installation, profile or dependency state was used for this test.

## Warnings are not waived

- **Private core imports:** native execution, completion provenance and owner/profile enforcement depend on currently undocumented host interfaces. This is a real public-contract concern under catalog rule 9, not something a passing registration probe resolves.
- **Private DB read contexts:** native observation uses `db._read_ctx`. A supported query/receipt/authority contract or explicit maintainer adjudication is needed. Replacing trusted owner proof with serialized client fields is not an equivalent fix.
- **Desktop selector review:** the flagged `data-slot` selectors are within Workspace-owned surfaces. This is a review request, not evidence of a document-wide core-UI rewrite. Maintainer interpretation of the SDK styling contract remains required.

These warnings are retained. No core override, authentication bypass, approval bypass or feature-disabling workaround has been applied to obtain exit 0. A draft catalog PR is review material, not catalog approval.

## Scoped repair and remaining evidence

The build previously embedded task-relative source-comment paths and produced different bundle bytes when invoked from another directory. A regression first reproduced that failure. Setting esbuild's working directory to the repository root then produced identical bundles from both working directories. This changes build provenance/comments, not runtime feature code.

The optional UI suite initially stopped before tests because the standalone checkout lacks the local upstream native-component fixture tree. That attempt is not a test pass. Provider-positive saved editing and native Electron visual acceptance remain unqualified. An earlier-build screenshot illustrates the interface, not same-candidate acceptance.

Final source pins, fresh exact-commit validation and hosted-check status are recorded in [publication issue #1](https://github.com/kaosjammo/hermes-workspace/issues/1). The historical report above is never relabelled as evidence for a different commit.
