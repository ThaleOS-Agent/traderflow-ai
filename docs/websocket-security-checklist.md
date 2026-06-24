# WebSocket Security Checklist

## Secret handling

- Do not expose API keys
- Do not expose API secrets
- Do not expose auth tokens
- Do not expose signatures
- Do not expose listen keys
- Do not expose private account identifiers unless required server-side

## Permissions

- Read-account and read-order permissions are acceptable
- Trading permission should stay off by default
- Withdrawal permission must be disabled
- Block setup if withdrawal permission is detected or suspected

## Network controls

- Recommend IP allowlisting
- Use explicit heartbeat management instead of relying on TCP keep-alive alone
- Track reconnect storms and rate-limit pressure

## Runtime controls

- Default to paper mode
- Keep `ENABLE_LIVE_TRADING=false` until explicitly enabled
- Pause trading on reconciliation mismatch
- Pause trading on stale private account state

## Audit requirements

- Persist connection sessions
- Persist reconciliation logs
- Persist private-stream audit logs
- Persist rate-limit events
- Persist order and fill events
