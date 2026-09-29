---
name: prepare-pr
description: Prepare, create, or update a pull request with reviewer-facing context, logical change sets, and evidence from verification actually performed. Use when asked to prepare a PR or make a branch ready for review.
---

# Prepare Pull Request

Write the pull request for a reviewer who was not part of the implementation conversation.
The diff already shows what code changed. The PR should explain why the changes exist, what problem they solve, and any decisions that are not obvious from the code.

## Understand the change

Before writing the PR:

- Review the complete diff that will merge.
- Use the task context and relevant commits to recover the original problem, symptoms, constraints, and decisions.
- Inspect enough surrounding code to understand why each substantial change exists.
- Identify the meaningful verification that was actually performed.

Do not treat commit messages or a file-by-file diff summary as the PR narrative.
Describe the final net change, not the sequence of attempts used to reach it.

## Separate logical change sets

Group changes by motivation, not by file.
For each substantial change, understand:

- what problem or limitation existed,
- why it needed to change,
- what approach was taken,
- and what behavior is different now.

If the branch contains changes with different motivations, explain them separately.
Do not combine unrelated work into a generic list of modifications.
If the changes appear independent enough that they may belong in separate PRs, mention this before creating the PR. Do not split the work unless asked.

## Title

Describe the primary outcome or behavior change.
Prefer:

> Fix session teardown after interview completion

over:

> Update session handling files

## PR body

Use only the sections that add useful information.

### Why

Explain the problem, undesirable behavior, limitation, or goal that caused this work to be necessary.
Lead with this context before implementation details.

### What changed

Explain the resulting solution at the behavioral or architectural level.
If multiple logical change sets exist, give each a short subsection and explain its motivation and resulting change separately.
Mention specific files or functions only when they help the reviewer understand the implementation.
Explain important design decisions or trade-offs when they are not obvious from the diff.

### Verification

Summarize meaningful verification that was actually performed.
This section reports validation. It does not need to rerun checks already handled by repository automation.

### Follow-ups

Include only when known work was intentionally left outside this PR.
Do not add empty sections.
Do not sign the PR. Leave out AI attribution footers such as "🤖 Generated with Claude Code", even when a tool or harness default asks for one.

## Final check

The PR should let a reviewer understand:

- why the change was necessary,
- what changed and why this approach was chosen,
- which changes have separate motivations,
- and how the resulting behavior was verified.

Describe the final result, not the implementation process.
Then create or update the pull request when authorized by the user. Preparing a PR does not authorize merging it.
