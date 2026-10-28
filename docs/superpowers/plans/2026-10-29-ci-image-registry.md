# PROD-204: authenticated CI image pulls

GHCR anonymous pulls repeatedly failed before tests. The first alternative, the pinned CLI's public.ecr.aws default, also failed on a fresh runner with a data-transfer limit. Authenticate GHCR pulls with the job-scoped ephemeral GITHUB_TOKEN and contents:read/packages:read permissions. Use an isolated temporary DOCKER_CONFIG deleted on shell exit; no personal secret or persistent Docker login. Keep CLI/actions pinned and all services/test gates unchanged.

Verify workflow parsing and bootstrap contracts, review token scope/config cleanup and pinned CLI Docker-auth loading, then require fresh full remote CI before merge. Registry success is only confirmed by actual runner bootstrap and tests, not manifest availability.
