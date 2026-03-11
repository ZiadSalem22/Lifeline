# Subtask Behavior

## Purpose

This document describes the user-facing subtask capability in Lifeline, including how subtasks are created, identified, and managed.

## Overview

Subtasks break a task into smaller actionable items. Each task can have up to 50 subtasks, each with its own title, completion state, and stable unique identifier.

## Creating subtasks

Subtasks can be added:

- At task creation time, as part of the initial task metadata
- After creation, through the MCP agent using `add_subtask`

Each subtask requires a non-empty title (max 500 characters).

## Subtask identity

Every subtask receives a stable UUID identifier (`subtaskId`) that persists across edits. This enables agent conversations to reference specific subtasks reliably, even after reordering or sibling changes.

Position is a 1-based sequential number that reflects the current ordering. Positions are automatically re-sequenced when subtasks are added or removed.

## Completion tracking

Each subtask has an independent `isCompleted` state. When viewed through the MCP agent, the task preview shows a completion summary (e.g., "2/5 done") and individual checkbox indicators.

The parent task's own completion state is independent of subtask completion — completing all subtasks does not automatically complete the parent.

## Subtask operations available through MCP

| Operation | Description |
| --- | --- |
| `add_subtask` | Add a new subtask to a task |
| `complete_subtask` | Mark a subtask as done |
| `uncomplete_subtask` | Reopen a completed subtask |
| `update_subtask` | Change a subtask's title |
| `remove_subtask` | Delete a subtask from the task |

All operations require the parent task to be active (not archived). Attempting to modify subtasks on an archived task returns an error instructing the user to restore the task first.

## Related canonical documents

- [task-lifecycle.md](task-lifecycle.md)
- [../backend/subtask-operations.md](../backend/subtask-operations.md)
- [../data-model/subtask-contract.md](../data-model/subtask-contract.md)
