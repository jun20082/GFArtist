# Project Instructions

## Source Documents

Before implementing, read the relevant sections of:

- `MVP_요구사항_명세서.md`
- `MVP_개발명세서.md`
- `MVP_backlog.md`

The requirements specification defines product behavior and MVP scope. The
development specification defines implementation order, data rules, and
verification criteria.

If the documents conflict or leave an implementation-critical decision open,
do not guess. Ask one focused question. Do not treat recommended technologies
as final until they are explicitly confirmed.

## Scope

- Implement the MVP only.
- Do not add features listed as excluded unless the user explicitly requests them.
- Follow P0 validation and decision steps before P1 implementation unless the user explicitly directs otherwise.
- Preserve these data-flow rules: the respondent-provided fields in the source response Sheet are read-only, the server may add and maintain only the `_internal_response_id` system column, the database is the source of truth for operating status, and status synchronization is one-way to the operating-status tab in the source spreadsheet.

## Security

- Never commit secrets, OAuth tokens, credentials, or real personal data.
- Keep secrets in environment variables.
- Enforce authentication and allowed-account checks on the server.
- Do not store personal data in browser local storage.
- Perform operating-status tab writes through the server only.

## Changes and Verification

- Make the smallest change that satisfies the request.
- Do not refactor unrelated code or overwrite existing user changes.
- For behavior changes, add focused tests or another appropriate verification.
- Use the completion criteria and test cases in the specifications.
- Before finishing, run relevant checks and report the exact commands and results.
- Do not claim a feature works without verifying it.
