# Distinguish scholarship choice links (PROD-239)

Claude review of PROD-238 found identical names in a screen-reader links list.
Keep the visible title and existing layout. Add screen-reader text containing
provider, formatted award, recorded deadline and listing position, so even
otherwise identical records remain distinguishable without exposing IDs. Give
repeated official-source links listing context too. No URL or data changes.

## Task 1

Write failing accessible-name tests for different providers, identical public
facts, absent facts and official-source links. Add server-rendered sr-only text.
Update the existing three-device journey to select by the meaningful name.
Run focused/full units, types, lint, build and desktop/Android/iPhone journeys.

## Review and release

Actual Claude and independent whole-branch review. Focus: visible title is
preserved in the accessible name, same-title/provider records remain distinct,
missing facts do not leak IDs or malformed text, unchanged exact selection,
keyboard/mobile behavior. Release only after CI; verify production choice links.
