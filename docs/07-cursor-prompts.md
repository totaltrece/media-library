# AI Development Prompts

Version: 1.0

---

# Purpose

This document contains reusable prompts for AI coding assistants working on
Media Library.

The prompts assume the repository already contains:

- AGENTS.md
- Project documentation
- Existing source code

Every prompt should produce small, testable and reviewable changes.

---

# General Rules

Every implementation prompt assumes the following:

- Read AGENTS.md before making changes.
- Read the relevant documentation under docs/.
- Preserve the hexagonal architecture.
- Never modify media files or TagSpaces metadata.
- Prefer extending existing packages over creating new ones.
- Add or update automated tests.
- Keep commits small and focused.
- Explain any architectural decision before implementing it.

---

# Prompt — Understand the Project

```
Read AGENTS.md and every document under docs/.

Summarize:

- the project vision
- the current architecture
- the current milestone
- any architectural constraints

Do not modify any code.
```

---

# Prompt — Implement Current Milestone

```
Read AGENTS.md.

Read every document under docs/.

Read docs/06-milestones.md.

Determine the first incomplete milestone.

Implement only that milestone.

Do not implement future milestones.

Reuse existing packages whenever possible.

Add automated tests.

Run the relevant checks.

Explain the changes before generating the commit.
```

---

# Prompt — Implement Specific Milestone

```
Read AGENTS.md.

Read every document under docs/.

Implement Milestone X from docs/06-milestones.md.

Only perform the work required for that milestone.

Do not anticipate future functionality.

Add tests.

Stop when the milestone is complete.
```

---

# Prompt — Bug Fix

```
Read AGENTS.md.

Understand the reported bug.

Identify the smallest possible fix.

Do not refactor unrelated code.

Add a regression test.

Explain the root cause.

Verify that all tests pass.
```

---

# Prompt — Refactoring

```
Read AGENTS.md.

Improve the implementation without changing behaviour.

Preserve public APIs.

Do not introduce unnecessary abstractions.

Run all affected tests.

Summarize the improvements.
```

---

# Prompt — Code Review

```
Review the current changes.

Look for:

- architectural violations
- duplicated code
- missing tests
- unnecessary dependencies
- naming issues
- readability improvements

Do not modify code.

Produce a review report.
```

---

# Prompt — Documentation Update

```
Review the current implementation.

Update only the documentation that has become outdated.

Do not modify documentation that is still correct.

Explain every documentation change.
```

---

# Prompt — Release Preparation

```
Review the repository.

Verify:

- documentation
- tests
- build
- project structure

Identify anything preventing a release.

Do not modify code unless explicitly requested.
```

---

# Prompt — Architecture Review

```
Review the repository from an architectural perspective.

Focus on:

- dependency direction
- hexagonal architecture
- package responsibilities
- unnecessary coupling
- future maintainability

Do not implement changes.

Produce recommendations only.
```

---

# Prompt — Dependency Review

```
Review every project dependency.

Determine whether each dependency is justified.

Suggest removals where appropriate.

Do not add new dependencies.

Produce a report only.
```

---

# Prompt — Test Review

```
Review the automated tests.

Identify:

- missing coverage
- duplicated tests
- brittle tests
- opportunities for simplification

Do not modify code.

Produce a report.
```

---

# Prompt — Performance Review

```
Review the implementation looking for unnecessary work.

Focus on:

- indexing
- searching
- allocations
- filesystem access

Do not optimize prematurely.

Produce recommendations only.
```

---

# Prompt — End of Session

```
Summarize the current state of the project.

Include:

- completed milestones
- current milestone
- pending work
- known issues
- suggested next task

Do not modify code.
```

---

# Working Philosophy

The preferred development cycle is:

1. Read documentation.
2. Understand the current milestone.
3. Implement one small feature.
4. Add tests.
5. Run checks.
6. Review the diff.
7. Commit.

Repeat.

Large refactorings should be avoided unless explicitly requested.

The project should remain in a working state after every commit.