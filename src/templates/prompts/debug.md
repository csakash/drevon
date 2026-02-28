---
title: Debug
description: Structured debugging workflow for systematic problem-solving
author: drevon
tags: [debug, troubleshoot, fix]
---

# Structured Debugging Workflow

## 1. Reproduce
- Reproduce the bug reliably
- Note exact steps, inputs, and environment
- Get the exact error message / unexpected behavior

## 2. Isolate
- Narrow down to the smallest reproducing case
- Check: is it environment-specific? Data-specific? Timing-specific?
- Use binary search on recent changes if applicable

## 3. Understand
- Read the relevant code carefully
- Trace the execution path from input to error
- Check logs, stack traces, and error messages

## 4. Hypothesize
- Form a theory about the root cause
- List possible causes ranked by likelihood
- Design a test to confirm or reject each hypothesis

## 5. Fix
- Make the minimal change that fixes the root cause
- Don't fix symptoms — fix the cause
- Consider: could this bug exist elsewhere?

## 6. Verify
- Confirm the fix resolves the original issue
- Run the full test suite
- Check for regressions

## 7. Document
- Update `.drevon/memory/log.md` with the bug and fix
- If a pattern, add to `.drevon/memory/patterns.md`
- Add a test to prevent regression
