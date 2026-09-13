# Confirmations

The browser has final authority over tool execution.

## When confirmation runs

- Tools with `consequentialHint: true` always require confirmation.
- Tools without `readOnlyHint: true` require confirmation by default.
- Names are not a safety classification.
- `requiresConfirmation` on the bridge can require extra checks. It cannot skip a consequential tool.

## Prompt

The prompt names the tool and the `name` argument when that argument is a string. Delete actions use a Delete button and the warning "This action cannot be undone." Other tools use Confirm. Cancel denies the call with `CONFIRMATION_DENIED`.

## Stale approval

Approval is bound to the tool list revision at prompt time. If tools change before the user confirms, execution returns `STALE_TOOLS`. The handler does not run. Ask again after refresh.

## Escape

Escape on the widget denies a visible confirmation. If no confirmation is open, Escape closes the panel.
