# Torob hackathon plans

Strategy and implementation plans for the Torob in-person shopping assistant challenge, based on the supplied brief and a full audit of the v16 CSV dataset.

Start with the [Persian overview](START-HERE-fa.md).

For the current implementation, use the [score-prioritized continuation roadmap](ROADMAP-MAX-SCORE-fa.md), [execution backlog](EXECUTION-BACKLOG-fa.md), and [acceptance matrix](ACCEPTANCE-MAX-SCORE-fa.md). These incorporate the [implementation audit](../audits/2026-10-23/IMPLEMENTATION-AUDIT-fa.md), the confirmed 23 October 2026 21:00 Asia/Tehran deadline, Codex development with one human supervisor, and Liara hosting.

| File | Contents |
|---|---|
| [WINNING-PLAN.md](WINNING-PLAN.md) | Scope, judging criteria, architecture, schedule, release gates and demo script |
| [AGENT-PROMPTS.md](AGENT-PROMPTS.md) | Copy-ready coding-agent work packages |
| [DATA-FINDINGS.md](DATA-FINDINGS.md) | Measured dataset coverage, limitations and concrete demo candidates |
| [TRAINING-NOTES-DECISIONS.md](TRAINING-NOTES-DECISIONS.md) | Voice/image input, generative UI, CopilotKit/AG-UI and tool/access decisions |
| [dataset-audit.json](dataset-audit.json) | Machine-readable full-table audit |
| [demo-candidates.json](demo-candidates.json) | Actual product/offer records shortlisted for demo inspection |
| [profile_dataset.py](profile_dataset.py) | Standard-library audit script; input archive path currently points to the original local file |
| [sources](sources) | Supplied supplemental training notes and mega-tool slide |

The dataset ZIP is not included. To reproduce the audit, set `ARCHIVE` in `profile_dataset.py` to your local copy and run `python profile_dataset.py`. The script writes its JSON outputs beside itself.

The original documents describe the planning baseline, not current implementation status. Application code now exists; the audit distinguishes verified behavior from gaps. The continuation roadmap supersedes the original assumed 48-hour schedule. Seller contact simulations must stay explicitly labelled. No proposed task or acceptance case is a claim of completion.
