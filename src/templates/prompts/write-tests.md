---
title: Write Tests
description: Test-writing methodology for comprehensive coverage
author: drevon
tags: [testing, quality, tdd]
---

# Test Writing Methodology

## 1. Identify What to Test
- What is the public API / interface?
- What are the inputs and expected outputs?
- What side effects should occur?
- What error conditions exist?

## 2. Test Structure (Arrange-Act-Assert)
```
// Arrange — set up test data and dependencies
// Act — call the function under test
// Assert — verify the result
```

## 3. Happy Path First
- Test the most common, expected usage
- Verify correct output for valid input
- One assertion per behavior

## 4. Edge Cases
- Empty inputs (null, undefined, empty string, empty array)
- Boundary values (0, -1, MAX_INT, empty, single item)
- Invalid inputs (wrong type, malformed data)
- Concurrent or async edge cases

## 5. Error Paths
- What happens when dependencies fail?
- Are errors properly propagated?
- Are error messages helpful?

## 6. Test Organization
- Group related tests with `describe`
- Use descriptive test names: "should [expected behavior] when [condition]"
- Keep tests independent — no shared mutable state
- Use `beforeEach` for common setup

## 7. Avoid Common Mistakes
- Don't test implementation details — test behavior
- Don't write tests that always pass
- Don't ignore flaky tests — fix them immediately
- Don't mock everything — prefer integration where practical
