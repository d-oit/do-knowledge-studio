# Agent Browser Patterns

## Authentication, iframes, devices, security patterns.

## Authentication
- Fill login form refs, click submit
- Use `state save` to persist session state
- For OTP flows, wait for user input

## Iframes
- Navigate into iframe context first
- Snapshot returns refs within current frame

## Devices
- Use device emulation for mobile testing
- `device set iPhone` for mobile viewport

## Security
- Never store credentials in scripts
- Use environment variables for sensitive data
