# Security Policy

## Reporting

If you discover a security issue, do not open a public issue with exploit details. Instead, report it privately to the maintainers using the contact path that will be published in the project profile before the first public release.

Until that contact path exists, treat the repository as pre-release and coordinate directly with the current maintainers.

## Scope

Security-sensitive areas for Runroot include:

- tool execution boundaries
- approval and operator actions
- credential handling
- persistence and event storage
- API surface and webhook handling

Security reviews should favor least privilege, explicit allowlists, and auditable behavior.
