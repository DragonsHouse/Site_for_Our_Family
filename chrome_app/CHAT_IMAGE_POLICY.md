# Chat image policy (token control)

Goal: reduce token usage during debugging and fixes.

## Hard rule
- Do not attach or paste images from folder `картинки` into chat.
- Do not auto-include screenshots from `картинки` in prompts or summaries.

## Allowed alternatives
- Provide text description of the issue.
- Provide file path only (without embedding image).
- If visual proof is required, send one compressed image only after explicit request.

## Scope
- Applies to all future chats for this project unless user explicitly overrides it.

