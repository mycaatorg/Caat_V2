# PROD-204: restore isolated CI image pulls

Both ECR and GHCR throttled hosted runners; authenticated GHCR also failed on image blobs after successful login. Select Docker Hub, which the pinned CLI 2.90.0 explicitly supports with original image namespaces. Remove the ineffective authentication experiment entirely: no new token, permissions or credential files remain.

Verify workflow parsing, infrastructure contracts and official pinned image manifest, then require fresh full remote CI before merge. Actual startup plus browser tests are the gate; manifest access alone does not prove recovery. No services, migrations or test gates may be skipped.
