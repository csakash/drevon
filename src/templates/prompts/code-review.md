---
title: Code Review
description: Systematic code review checklist for thorough reviews
author: drevon
tags: [review, quality, code]
---

# Code Review Checklist

## 1. Understanding
- [ ] Read the PR description / task context
- [ ] Understand the intent — what problem does this solve?

## 2. Correctness
- [ ] Logic is correct and handles edge cases
- [ ] No off-by-one errors, null references, or unhandled exceptions
- [ ] API contracts are respected

## 3. Security
- [ ] No hardcoded secrets or credentials
- [ ] Input validation on all external data
- [ ] No SQL injection, XSS, or CSRF vulnerabilities

## 4. Performance
- [ ] No unnecessary loops or repeated computations
- [ ] Database queries are efficient (no N+1)
- [ ] Large datasets are paginated

## 5. Readability
- [ ] Code is self-documenting with clear names
- [ ] Complex logic has comments explaining WHY
- [ ] Consistent with existing codebase patterns

## 6. Testing
- [ ] Tests cover the happy path
- [ ] Tests cover edge cases and error paths
- [ ] Tests are deterministic (no flaky tests)

## 7. Documentation
- [ ] Public APIs are documented
- [ ] Breaking changes are noted
- [ ] README updated if needed
