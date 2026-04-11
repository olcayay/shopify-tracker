Create a high-quality Linear issue under project `shopify-app-tracker-0c73ee47f3c9`.

You are acting as a product-minded senior engineer.

Your goal:
Analyze the need deeply and create an implementation-ready Linear ticket with correct priority, labels, dependencies, and detailed description.

----------------------------------------
ANALYSIS (THINK BEFORE CREATING)
----------------------------------------

Before creating the ticket, analyze:

- What is the actual problem or need?
- Why does it matter?
- What kind of task is this (bug, feature, improvement, refactor, tech debt)?
- What is the expected solution direction?
- What parts of the system are affected?
- What could break or be impacted?
- How should this be tested?
- Are there related or dependent tasks?

Also:
- Read BOTH description and comments of related issues
- Detect similar tasks
- Detect dependencies (ordering, blocking)

----------------------------------------
TASK GROUPING & LABELS
----------------------------------------

- Always add: `auto-generated`
- Add relevant custom labels based on domain and purpose (bug, feature, api, ui, backend, tracking, shopify, etc.)
- Prefer existing labels
- Use labels to group related tasks that should be implemented together

----------------------------------------
PRIORITY RULES
----------------------------------------

Set priority based on:
- impact
- urgency
- risk
- whether it blocks other work

Use:
- Urgent / High / Medium / Low

Also prefix title with:
[URGENT], [HIGH], [MEDIUM], or [LOW]

----------------------------------------
DEPENDENCIES
----------------------------------------

- If task depends on another → mark as `blocked by`
- If task unblocks others → mark as `blocking`
- Also mention dependencies in description
- Prefer explicit relations over implicit assumptions

----------------------------------------
TITLE FORMAT
----------------------------------------

[PRIORITY] Clear, specific, implementation-oriented title

----------------------------------------
DESCRIPTION FORMAT
----------------------------------------

## Summary
Short, clear summary.

## Problem / Need
What is the issue and why it matters.

## Proposed Change
What should be implemented and how (high-level but concrete).

## Expected Impact
User, system, and risk impact.

## Dependencies / Related Work
Blocked by / blocking / related tasks.

## Labels / Grouping Rationale
Why these labels were chosen and which group this belongs to.

## Testing Strategy
How this should be tested (manual + automated + edge cases).

## Acceptance Criteria
- [ ] Clear, verifiable outcomes

## Notes
Assumptions, constraints, extra context.

----------------------------------------
STATE RULES
----------------------------------------

- Default state: Backlog (unless explicitly told otherwise)

----------------------------------------
ISSUE LIMIT HANDLING
----------------------------------------

If issue creation fails due to limit:

1. Delete oldest issues in "Done"
2. If still needed, delete oldest in "In Review"
3. Delete minimum required amount
4. Then create the new issue

----------------------------------------
QUALITY RULES
----------------------------------------

- Do not create vague tickets
- Do not skip analysis
- Do not skip testing strategy
- Do not skip dependencies
- Prefer actionable, implementation-ready tickets

----------------------------------------
OUTPUT
----------------------------------------

After creation, return:

- title
- priority
- labels
- state
- project
- dependencies created
- short summary of the ticket
