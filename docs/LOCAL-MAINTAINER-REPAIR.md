# Local maintainer-feedback candidate (unpublished)

Local repair authority 1570216879409078316 continues the uncommitted candidate at
HEAD `3eeb9986101a3d75c4f9cddc26bb5a3e31bcb9f5`. No staging, commits, publication,
source/catalog pin or version changes, installation, restart, live configuration
changes, core patches or licence decision are authorised. Parent owns independent
final acceptance. The original published snapshot and historical evidence remain
unchanged. This candidate is **under qualification, not declared PR-ready**.

## Implemented contracts

| Feedback | Local implementation | Qualification boundary |
| --- | --- | --- |
| Private native gateway admission/mutation/Stop coupling | Removed `native_owner.py`. Actual root registers public pre/post LLM, pre-tool and on-session-end hooks. Exact session/task/turn plus prepared prompt bind a plugin-owned run. Pre-tool hook injects a scoped one-use nonce; ordinary handler independently refuses missing, used-with-changed-payload, foreign, stale or revoked authority. Plugin Store is the single atomic ordering point for call consumption, edits, receipts and revocation. | Real released 0.23 loader, outer executor and PluginHost IPC execute with synthetic state. Natural provider-free conversations deliver lifecycle hooks without manual delivery, save outcomes and support repeat runs/Restore. Real provider and native Electron acceptance remain separate. |
| Raw SQL/private SessionDB access | Public SessionDB read-only connection with get_session/get_compression_lineage. No native admission/transcript/runtime tables or private DB handles. SQL remains solely in plugin-owned stores. | 26 focused public-contract checks pass using exact 0.23 host source; full native lifecycle is separate. |
| Private dashboard token import | Removed. Hermes authenticates admitted plugin routes; test-only standalone router composition supplies its own explicit outer gate. Review actor and canonical executor identity derive from server-selected home. | Synthetic HTTP and real released-host authentication/profile/IPC boundaries have dedicated tests. Their fresh outcomes and input identities are recorded locally; no live account is a fixture. |
| Other undocumented imports | Removed private owner, persisted-row, dashboard identity and profile-metadata dependencies. Friendly title is bounded inert text from documented profiles.list on the captured Desktop route; server canonical profile/source and agent origin are independent and captured once per run. Invalid/missing title falls back to canonical profile. Existing saved names are retained. | Official scanner reports zero private imports/attributes on the generated package; the final refreshed package is scanned again. Release canonical-home helper and public SessionDB calls are source/runtime checked. |
| Owned popup scope | Retained Workspace-owned SDK popup state and portal markers, nested confirmation behavior, retained drafts, focus return and outside collapse. No unrelated app-role scan. | Fresh deterministic component checks pass; native Electron visual campaign is unrun. |
| Maintained paragraph source and normal build | Retained approved replacement-paragraph highlights, independent comment IDs/outcomes/resolution and guarded revert provenance. Bundle is generated only by npm run build. | Two fresh normal builds match; source/dist/archive parity must bind to the final frozen candidate. |
| Optional PDF environment | Explicit minimal child environment drops credentials/provider/proxy/startup settings, retains package/home/temp/platform behavior. | Focused environment and actual synthetic PDF/DOCX checks pass. Not an OS sandbox. |
| Licence | Owner decision, unchanged. | Nonblocking local engineering item; no licence invented. |

## Safety and behavior

Address stays explicit and follows UI save flushing and scoped review. It uses a
persistent native chosen thread, full current-page context, every unresolved
comment including previously answered comments, and only explicitly authorised
related targets. Agent tools cannot resolve comments or change ownership/binding.
Direct validated saves are supported; this is not manual-proposal-only operation.

Workspace Stop commits local revocation before requesting exact-admission native
cancel, then finalizes the local cancelled run and unlocks. This also works for a
queued prompt that never produces a turn-end callback. A late submission ACK
still receives exact native cancellation; neither local completion nor that ACK
claims provider cancellation. A save accepted before revocation can remain as recoverable partial work;
progress/outcomes say so. No global native-owner lock or physical-click-time Stop
linearisation is claimed. Unknown completion is never success. Explicit Recover
revokes/unlocks locally without proving provider cancellation. Pre-run Restore,
read-only active items and usability of other unlocked pages remain.

Released 0.23 can return a truncation/partial result before its ordinary terminal
hook. That path remains running with native outcome UNKNOWN until the user uses
Stop or explicit Recover. Accepted partial work and pre-run Restore survive;
neither a missing callback nor a partial response is treated as success. The
provider-free normal lifecycle regression exercises this real host boundary.

Run journals, review tokens, scope checks, one-use call consumption, effects and
receipts use the **same Store SQLite connection/transaction**, including rollback
on journal failure. No separate Workflow/Store transaction is called atomic.

Public compression continuity retains the admitted turn identity for call tickets
after checking the live compression lineage, exact task and exact turn. Explicit
forks and stale turns do not inherit authority. A baseline run whose journal was
in the older workflow database is recognised only for explicit recovery: no old
grant, review or native cancellation address is imported. Recovery preserves
accepted partial edits, history and pre-run Restore, revokes locally and unlocks
with native outcome UNKNOWN. Late legacy callbacks cannot acquire save authority.

The mounted document publishes the actual prepared state before waiting for the
submission ACK. Stop and Recover have their own pending control state and remain
usable while that ACK is outstanding. Late ACK cancellation never regrants local
writes; unrelated unlocked pages remain editable.

## Sources and evidence

Official [plugins](https://hermes-agent.nousresearch.com/docs/developer-guide/plugins),
[Desktop SDK](https://hermes-agent.nousresearch.com/docs/developer-guide/desktop-plugin-sdk),
and [hooks](https://hermes-agent.nousresearch.com/docs/user-guide/features/hooks)
were checked alongside current source `90d6b98fd86d20981ee06ddd5b7d93e4320f26a4`
and the clean isolated released source `2bd378ed1b8d6bf2192cb26e0a55ff3091e6bd19`
(reporting 0.23.0). No live profile, credentials or installed package is a fixture.

Fresh exact argv, exits, logs, SHA-256 receipts and checkpoint are under
`.local/pr-ready-1570216879409078316/`, by named phase. Historical pass1 and Select
packets are preserved. Expected REDs and failed setup/diagnostic attempts remain
included. Private-mechanism tests were consolidated into the public-contract suites with
explicit retirement/replacement records under phase-04-integration. Canonical
execution is recorded by exact command, source manifest and true exit, including
earlier failures. Phase-08 repairs qualify the previously held HTTP/IPC/normal-turn
lanes through scoped per-command grants, without rerouting a refused command.
Parent must commission fresh independent SPEC/QUALITY review of the final freeze.

Historical permission denials, async stalls and setup failures remain preserved.
They are not rewritten as product failures or retroactive passes. Fresh canonical
suite, normal-build and package parity results bind to the final local phase-08
manifest. The validator's app-selector review warning is retained, not suppressed.
No native Electron, real-provider, cross-platform or maintainer acceptance is
claimed. Fresh independent final review remains the parent's gate.
