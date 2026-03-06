# Lifeline Custom Skills

This directory stores repo-native engineering skills that encode stable governance and operational rules for Lifeline.

Current implementation order:
1. skills
2. agents
3. teams
4. workflows

Current skills:
- [documentation-governance.md](documentation-governance.md)
- [cicd-governance.md](cicd-governance.md)

These skills are intentionally narrower than agents.

- Skills encode repo-specific judgment, safeguards, routing rules, and review heuristics.
- Agents execute domain workflows using those skills plus the instruction/prompt system.
