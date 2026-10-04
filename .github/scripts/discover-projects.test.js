const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const discoverScript = path.join(__dirname, 'discover-projects.js');

function discover(packageJson) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'caat-project-discovery-'));
  try {
    fs.writeFileSync(path.join(directory, 'package.json'), JSON.stringify(packageJson));
    const result = spawnSync(process.execPath, [discoverScript], {
      cwd: directory,
      encoding: 'utf8',
    });
    assert.equal(result.status, 0, result.stderr);
    return JSON.parse(result.stdout);
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
}

test('project discovery reports the scripts CI uses to choose checks', () => {
  const matrix = discover({
    name: 'frontend',
    scripts: {
      lint: 'eslint',
      test: 'vitest run',
      'test:unit': 'vitest run tests/unit',
      'test:coverage': 'vitest run --coverage',
      typecheck: 'tsc --noEmit',
      build: 'next build',
    },
  });

  assert.deepEqual(matrix.include, [{
    name: 'frontend',
    path: '.',
    scripts: {
      lint: true,
      test: true,
      'test:unit': true,
      'test:coverage': true,
      typecheck: true,
      build: true,
    },
  }]);
});

test('project discovery marks absent scripts false', () => {
  const matrix = discover({ name: 'docs-only' });
  assert.deepEqual(matrix.include[0].scripts, {
    lint: false,
    test: false,
    'test:unit': false,
    'test:coverage': false,
    typecheck: false,
    build: false,
  });
});
