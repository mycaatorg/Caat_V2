// Basic smoke tests for the caat-frontend project.
// These are intentionally lightweight and framework-free so they can run with
// just Node.js. They only verify that key files and folders exist, without
// importing TypeScript modules (no build step or extra tooling required).

const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function expectFile(relativePath) {
  const fullPath = path.join(__dirname, '..', relativePath);
  assert(fs.existsSync(fullPath), `Expected file or directory to exist: ${relativePath}`);
}

function main() {
  // Structural checks: core Next.js app files/folders that should always exist.
  expectFile('tsconfig.json');
  expectFile('app');
  expectFile('app/layout.tsx');
  expectFile('app/page.tsx');

  console.log('caat-frontend smoke tests passed.');
}

try {
  main();
} catch (err) {
  console.error('❌ caat-frontend smoke tests failed:');
  console.error(err && err.stack ? err.stack : err);
  process.exit(1);
}

