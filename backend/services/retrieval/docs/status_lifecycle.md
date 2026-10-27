# Task Status Lifecycle

Tasks move through three statuses: pending, in_progress, and completed.

## Pending
Pending tasks (also called open, new, unstarted, waiting, or todo) have not been started. This is the default status for all new tasks. Any team member can pick up a pending task.

## In Progress
In progress tasks (also called active, ongoing, started, working, or WIP) are actively being worked on. Only one team member should be working on an in_progress task at a time. Move a task to in_progress when you start working on it so the team knows it is claimed.

## Completed
Completed tasks (also called done, finished, closed, or resolved) have been fully finished. No further action is needed. Completed tasks remain visible for audit purposes and should not be deleted unless explicitly archiving old work.

## Allowed Transitions
- pending → in_progress (start working on it)
- in_progress → completed (finish the work)
- completed → pending (reopen if work needs to be redone)
- pending → completed (for trivial tasks completed immediately)
- in_progress → pending (if you stop working on it and hand it back)

## Rules
- Never delete a completed task — mark it completed and leave it.
- Do not mark a task completed unless all acceptance criteria in the description are met.
- Tasks with no status updates for more than 3 days should be reviewed in standup.
