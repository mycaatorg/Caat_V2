// Monorepo-friendly project discovery for CI.
// Scans the repo for real application package.json files (excluding build artifacts)
// and emits a GitHub Actions matrix object describing each project and its scripts.

const fs = require('fs');
const path = require('path');

const repoRoot = process.cwd();

/** Directories that are not useful to scan for source package.json files. */
const IGNORED_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  '.turbo',
  'dist',
  'build',
  '.github', // CI/config only, not an app
]);

/**
 * Recursively walk the repository and collect metadata for each package.json
 * that corresponds to an actual project we want to run CI on.
 */
function discoverProjects(startDir) {
  const projects = [];

  function walk(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        walk(path.join(dir, entry.name));
        continue;
      }

      if (entry.isFile() && entry.name === 'package.json') {
        const fullPath = path.join(dir, entry.name);
        const relDir = path.relative(repoRoot, path.dirname(fullPath));

        // Ignore package.json files that live inside build artifacts (extra safety).
        if (relDir.split(path.sep).some((segment) => IGNORED_DIRS.has(segment))) {
          continue;
        }

        const raw = fs.readFileSync(fullPath, 'utf8');
        let pkg;
        try {
          pkg = JSON.parse(raw);
        } catch {
          // If package.json is invalid, skip it rather than breaking CI discovery.
          continue;
        }

        const scripts = pkg.scripts || {};

        projects.push({
          name: pkg.name || relDir || '.',
          path: relDir === '' ? '.' : relDir,
          scripts: {
            lint: Boolean(scripts.lint),
            test: Boolean(scripts.test),
            'test:unit': Boolean(scripts['test:unit']),
            typecheck: Boolean(scripts.typecheck),
            build: Boolean(scripts.build),
          },
        });
      }
    }
  }

  walk(startDir);
  return projects;
}

const projects = discoverProjects(repoRoot);

// GitHub Actions matrix expects an object with an "include" array.
const matrix = { include: projects };

// This JSON is consumed by the workflow via fromJSON(). Output is minified so
// it can be safely passed as a single-line GitHub Actions output.
console.log(JSON.stringify(matrix));

