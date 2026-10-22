# Torob hackathon plans

Strategy and implementation plans for the Torob in-person shopping assistant challenge, based on the supplied brief and a full audit of the v16 CSV dataset.

Start with the [Persian overview](START-HERE-fa.md).

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

These are planning artifacts. Application implementation, deployment, acceptance tests and submission remain future work. Seller contact simulations must stay explicitly labelled. The schedule assumes 48 hours; the actual deadline/team size were not supplied.
