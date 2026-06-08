# Ignore Rules

Ignore rules suppress known noisy links so results, diffs, fix queues, and alerts stay actionable.

## Scope

- Site rules apply to one site.
- Global rules have no `site_id` and can apply across sites for the user.
- Disabled rules remain stored but are not applied.

## Rule Types

- `domain`: hostname match, including `*.example.com`.
- `path_prefix`: URL path starts with the pattern.
- `exact`: full normalized URL equals the pattern.
- `contains`: normalized URL contains the pattern.
- `regex`: JavaScript regular expression. Unsafe or invalid patterns are rejected on create and skipped on apply.
- `status_code`: HTTP status code match.
- `classification`: `ok`, `broken`, `blocked`, or `no_response`.

## Matching

Rules are sorted before matching:

1. `domain`
2. `path_prefix`
3. `exact`
4. `contains`
5. `regex`
6. `status_code`
7. `classification`

Ties are resolved by creation time, then id. The first matching rule wins.

## Defaults

- Ignored links are excluded from normal results, diff, fix queue, and alert calculations.
- Use Include ignored toggles to show suppressed rows during review.
- Ignore rules are reapplied to a run when result, diff, export, or alert paths need current ignore state.

## Reapply scope

- Creating, disabling, or deleting a rule does not rescan the site.
- Reapplying rules updates stored ignored state for existing scan rows.
