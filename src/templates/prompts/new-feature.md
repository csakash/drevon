---
title: New Feature
description: Feature implementation workflow from spec to completion
author: drevon
tags: [feature, implementation, workflow]
---

# New Feature Implementation

## 1. Understand Requirements
- What problem does this feature solve?
- Who is the user? What's their workflow?
- What are the acceptance criteria?
- Are there edge cases or constraints?

## 2. Design
- How does this fit into the existing architecture?
- What components need to change?
- Are there any new dependencies needed?
- Draw the data flow if complex

## 3. Plan
- Break the feature into small, testable increments
- Identify the order of implementation
- Estimate complexity of each step

## 4. Implement
- Start with the data model / types
- Build from the bottom up (utils → core → UI)
- Write tests alongside implementation
- Commit at each logical milestone

## 5. Test
- Unit tests for new functions
- Integration tests for the feature flow
- Manual testing of the user-facing workflow
- Edge case testing

## 6. Review
- Self-review: read the diff as if reviewing someone else's code
- Check for: naming, error handling, performance, security
- Run the full test suite

## 7. Document
- Update relevant documentation
- Log the feature in `.drevon/memory/log.md`
- Record any architectural decisions in `.drevon/memory/decisions.md`
