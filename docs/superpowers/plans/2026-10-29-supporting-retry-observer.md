# PROD-195: observe saves throughout supporting-work refresh

The browser recovery test removes its route before clicking Refresh, leaving its final write counter blind. Keep interception through retry, switch off only the synthetic GET failure, and check both one POST attempt and one persisted association before removing interception. Preserve the full existing user journey and cleanup.

Prove the observer with a temporary duplicate POST injection after retry: the old test misses it; the corrected test rejects it. Remove the temporary injection and verify desktop Chromium plus phone Chromium/WebKit. Obtain Claude and independent review, then CI/release checks. This is test-only; no application or schema behavior changes.
