# How to Write a Good Task Title

A good task title is specific, actionable, and self-contained. Anyone reading it should immediately understand what needs to be done without reading the description.

## Rules
1. Start with an action verb: Fix, Add, Update, Review, Refactor, Investigate, Deploy, Remove, Write.
2. Be specific about the area: mention the component, page, API, or feature affected.
3. Keep it under 60 characters so it is fully visible in the task list.
4. Avoid vague verbs like "Handle", "Deal with", or "Look into" unless followed by specific details.
5. Do not put urgency in the title (no "URGENT" or "!!!" ) — use the priority field instead.
6. Do not put the assignee name in the title — that belongs in the description.

## Good Examples
- Fix login button not responding on mobile Safari
- Add pagination to the task list API
- Update README with local setup instructions
- Investigate memory leak in the WebSocket handler
- Refactor authentication middleware to remove duplicate logic
- Deploy staging environment for QA testing

## Bad Examples
- Bug fix (not specific enough)
- Update (no context)
- URGENT: the thing John mentioned (urgency in title, not self-contained)
- Fix stuff (vague)
- Look into the issue (no specifics)

## Title vs Description
The title answers WHAT needs to be done. The description answers WHY it needs to be done, HOW to do it, and what the acceptance criteria are. Keep technical details, reproduction steps, and success criteria in the description.
