# Public smoke record identity (PROD-241)

Production smoke failed after the valid award query was added to card links:
it compared pathname alone with the entire href. The page returned200. Isolated
CI used a different bare fixture path and did not exercise the link.

Use the actual directory card in both environments; retain the expected title,
200 status, scholarship path validation and compare pathname plus query. Verify
RED production evidence, corrected live49-test suite and isolated navigation.
No product code changes. Review focus: no weakened record identity assertion,
no production writes, deterministic synthetic catalogue and query preservation.
Actual Claude and independent review plus CI gate merge.
