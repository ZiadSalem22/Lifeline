# Lifeline Agents

This directory stores repo-native agents that build on Lifeline's skills, instructions, prompts, and templates.

## Build order

1. skills
2. agents
3. teams
4. workflows

## Current governance agents

- [documentation-governance-agent.md](documentation-governance-agent.md)
- [cicd-governance-agent.md](cicd-governance-agent.md)

These are governance agents, not execution workflows.

- They depend on repo-native skills.
- They make routing, risk, and update decisions.
- They prepare the system for later team and workflow layers.

Teams come after agents and coordinate grouped responsibilities above the agent layer.

## Existing domain agent scaffolding

Other agent files in this directory remain as domain scaffolding from the earlier system setup.

This pass intentionally implements only the two governance agents.
