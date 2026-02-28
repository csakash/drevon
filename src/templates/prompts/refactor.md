---
title: Refactor
description: Safe refactoring workflow with confidence checks
author: drevon
tags: [refactor, cleanup, improvement]
---

# Safe Refactoring Workflow

## 1. Identify
- What needs refactoring and why?
- Is the current code working correctly?
- What's the scope — single function, module, or cross-cutting?

## 2. Ensure Safety Net
- Verify existing tests pass: `npm test` (or equivalent)
- If test coverage is low, write tests FIRST for current behavior
- Commit the current state as a baseline

## 3. Plan Changes
- List specific refactoring steps
- Each step should be small and independently verifiable
- Prefer rename → extract → simplify order

## 4. Execute Incrementally
- One refactoring at a time
- Run tests after each change
- Commit after each successful step
- If tests fail, revert the last change and try a different approach

## 5. Common Refactors
- **Extract function** — pull repeated code into a named function
- **Rename** — improve clarity of variable/function names
- **Simplify conditionals** — reduce nesting, use early returns
- **Remove dead code** — delete unused functions and variables
- **Split large files** — break into focused modules

## 6. Verify
- Run the full test suite
- Check that behavior is unchanged
- Review the diff for unintended changes

## 7. Document
- Log the refactoring in `.drevon/memory/log.md`
- Update `.drevon/memory/patterns.md` if new patterns were established
