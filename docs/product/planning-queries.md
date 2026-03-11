# Planning Queries

## Purpose

This document describes the time-based planning queries available through the MCP agent interface, enabling users to ask natural-language questions about their schedule.

## Window queries

Window queries let users ask about tasks within a time period. The MCP agent resolves natural-language timeframe references into date windows.

### Supported windows

| User intent | Window token | Resolution |
| --- | --- | --- |
| "What do I have this week?" | `this_week` | Current calendar week (Sunday–Saturday by default, or respects user week-start preference) |
| "What's coming next week?" | `next_week` | Following calendar week |
| "Show me this month" | `this_month` | First to last day of the current month |
| "What about next month?" | `next_month` | First to last day of the next month |
| "What's overdue?" | `overdue` | All tasks with due dates before today |
| "Show me March 2026" | `2026-03` | First to last day of the specified month |

### Date-range recurrence awareness

Window queries understand `dateRange` recurrence. A task spanning March 10–March 20 will appear in a window query for any overlapping period, not just the due date alone.

### Completion filtering

By default, window queries return only incomplete tasks. The agent can include completed tasks when the user asks for a complete picture.

## Similarity search

The MCP agent can check for similar existing tasks before creating a new one, using `find_similar_tasks`.

This helps prevent accidental duplicates by surfacing tasks with similar titles, scored by PostgreSQL trigram matching.

The agent can ask: "Before I create that, you already have these similar tasks — should I still create it?"

## Day and upcoming queries

In addition to window queries, existing planning surfaces include:

- **Day queries**: Tasks for a specific date (today, tomorrow, or any YYYY-MM-DD)
- **Upcoming queries**: Tasks due in the near future, sorted by due date

## Related canonical documents

- [task-lifecycle.md](task-lifecycle.md)
- [subtask-behavior.md](subtask-behavior.md)
- [../api/internal-mcp-task-endpoints.md](../api/internal-mcp-task-endpoints.md)
- [../backend/similarity-search.md](../backend/similarity-search.md)
