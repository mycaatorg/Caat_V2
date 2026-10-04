const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');

const repoRoot = path.resolve(__dirname, '../..');
const appRoot = path.join(repoRoot, 'caat-frontend/app');
const manifestPath = path.join(repoRoot, 'caat-frontend/tests/e2e/route-coverage.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const coverageSpec = {
  'public-content': 'caat-frontend/tests/e2e/public-smoke.spec.ts',
  'public-not-found': 'caat-frontend/tests/e2e/public-smoke.spec.ts',
  'public-detail': 'caat-frontend/tests/e2e/public-smoke.spec.ts',
  'authenticated-content': 'caat-frontend/tests/e2e/runtime-smoke.spec.ts',
  'auth-guard': 'caat-frontend/tests/e2e/route-guard.spec.ts',
  'isolated-detail': 'caat-frontend/tests/e2e/staging-journeys.spec.ts',
};

function findPages(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) return findPages(absolute);
    return entry.isFile() && entry.name === 'page.tsx' ? [absolute] : [];
  });
}

function routeForPage(file) {
  const relative = path.relative(appRoot, file);
  const parts = relative
    .split(path.sep)
    .slice(0, -1)
    .filter((part) => !(part.startsWith('(') && part.endsWith(')')));
  return parts.length ? `/${parts.join('/')}` : '/';
}

function expectedRoutes() {
  return findPages(appRoot).map(routeForPage).sort();
}

function middlewarePrefixes() {
  const source = fs.readFileSync(path.join(repoRoot, 'caat-frontend/middleware.ts'), 'utf8');
  const matcher = source.match(/matcher\s*:\s*\[([\s\S]*?)\]/);
  assert.ok(matcher, 'middleware.ts must expose an explicit route matcher');
  return [...matcher[1].matchAll(/["']([^"']+)["']/g)].map((match) =>
    match[1].replace(/\/:path\*$/, ''),
  );
}

function isProtected(route, prefixes) {
  return prefixes.some((prefix) => route === prefix || route.startsWith(`${prefix}/`));
}

test('route manifest covers every App Router page exactly once with truthful render/guard scope', () => {
  const listed = manifest.routes.map((entry) => entry.route);
  assert.equal(new Set(listed).size, listed.length, 'route manifest has duplicate paths');
  assert.deepEqual(listed.slice().sort(), expectedRoutes(), 'page.tsx inventory and route manifest differ');

  const prefixes = middlewarePrefixes();
  for (const entry of manifest.routes) {
    const dynamic = entry.route.includes('[');
    const classifiedAccess = isProtected(entry.route, prefixes) ? 'authenticated' : 'public';
    assert.equal(entry.kind, dynamic ? 'dynamic' : 'static', `${entry.route} kind`);
    assert.equal(entry.access, classifiedAccess, `${entry.route} access classification`);
    const expectedCoverage = {
      public: dynamic ? ['public-not-found', 'public-detail'] : ['public-content'],
      authenticated: dynamic ? ['auth-guard', 'isolated-detail'] : ['authenticated-content'],
    }[entry.access];
    assert.ok(expectedCoverage.includes(entry.coverage), `${entry.route} coverage classification`);

    if (entry.coverage === 'auth-guard' || (entry.coverage === 'public-not-found' && !entry.notFoundExpected)) {
      assert.ok(entry.limitation, `${entry.route} must state its fixture/content limitation`);
    } else {
      assert.ok(entry.expected, `${entry.route} needs a stable page-content assertion`);
    }
    if (entry.expectedRole) assert.ok(['heading', 'text', 'tab'].includes(entry.expectedRole), `${entry.route} has invalid expectedRole`);
    if (entry.coverage === 'public-detail') assert.ok(entry.notFoundExpected, `${entry.route} also needs a missing-slug assertion`);

    const spec = coverageSpec[entry.coverage];
    assert.ok(spec, `${entry.route} has an unknown coverage mode`);
    assert.ok(fs.existsSync(path.join(repoRoot, spec)), `${entry.route} references missing ${spec}`);
  }

  for (const [mode, spec] of Object.entries(coverageSpec)) {
    const source = fs.readFileSync(path.join(repoRoot, spec), 'utf8');
    assert.match(source, /route-coverage\.json/, `${spec} must consume the shared route manifest`);
    if (mode === 'auth-guard') {
      assert.match(source, /entry\.access\s*===\s*['"]authenticated['"]/, `${spec} must guard every authenticated manifest route`);
    } else if (mode === 'isolated-detail') {
      assert.match(source, /route-coverage\.json/, `${spec} must consume the route manifest`);
    } else if (mode === 'public-detail') {
      assert.match(source, /PUBLIC_DETAIL/, `${spec} must exercise the successful public detail route`);
      assert.match(source, /PUBLIC_NOT_FOUND/, `${spec} must retain the public missing-detail check`);
    } else if (mode === 'public-not-found') {
      assert.match(source, /PUBLIC_NOT_FOUND/, `${spec} must exercise the missing public detail route`);
    } else {
      assert.match(source, new RegExp(mode), `${spec} must select its declared coverage mode`);
    }
  }
});

test('write journey inventory labels isolated-only and uncovered flows instead of implying PR execution', () => {
  const journeys = manifest.writeJourneys;
  assert.ok(Array.isArray(journeys) && journeys.length > 0, 'write journeys must be inventoried');
  assert.equal(new Set(journeys.map((journey) => journey.id)).size, journeys.length, 'journey IDs must be unique');
  for (const journey of journeys) {
    assert.ok(journey.reason, `${journey.id} must explain its coverage boundary`);
    assert.ok(['isolated-ci', 'partial-isolated-ci', 'manual-isolated-only', 'not-covered'].includes(journey.coverage), `${journey.id} coverage state`);
    for (const spec of journey.specs) {
      assert.ok(fs.existsSync(path.join(repoRoot, 'caat-frontend', spec)), `${journey.id} references missing ${spec}`);
    }
    if (journey.coverage === 'manual-isolated-only') assert.ok(journey.specs.length > 0);
    if (['isolated-ci', 'partial-isolated-ci'].includes(journey.coverage)) {
      assert.ok(journey.specs.some((spec) => /^tests\/e2e\/staging-/.test(spec)), `${journey.id} must name an isolated PR journey spec`);
    }
  }

  const stagingSpec = fs.readFileSync(path.join(repoRoot, 'caat-frontend/tests/e2e/staging-journeys.spec.ts'), 'utf8');
  const communitySpec = fs.readFileSync(path.join(repoRoot, 'caat-frontend/tests/e2e/staging-community.spec.ts'), 'utf8');
  for (const source of [stagingSpec, communitySpec]) {
    assert.match(source, /CAAT_ISOLATED_E2E/, 'isolated write journeys must enforce their environment guard');
    assert.match(source, /NEXT_PUBLIC_SUPABASE_URL/, 'isolated write journeys must validate the database URL');
    assert.match(source, /PLAYWRIGHT_BASE_URL/, 'isolated write journeys must validate the browser URL');
  }
  assert.match(stagingSpec, /route-coverage\.json/, 'isolated route journeys must consume the route manifest');
  assert.match(communitySpec, /route-coverage\.json/, 'community route check must consume the shared route manifest');
  assert.match(communitySpec, /groupRoute!\.expected/, 'community journey must assert the manifest-defined group content');
  assert.match(communitySpec, /postUrl\.pathname/, 'community journey must inspect its generated post permalink');
  assert.match(communitySpec, /postUrl\.pathname\)[\s\S]{0,80}communities/, 'community journey must follow the generated community post detail route');

  const frontendPackage = JSON.parse(fs.readFileSync(path.join(repoRoot, 'caat-frontend/package.json'), 'utf8'));
  assert.match(frontendPackage.scripts['test:e2e:ci'], /staging-journeys\.spec\.ts/);
  assert.match(frontendPackage.scripts['test:e2e:ci'], /staging-community\.spec\.ts/);
  assert.match(frontendPackage.scripts['test:e2e:ci'], /staging-auth\.spec\.ts/);
  for (const spec of ['staging-journeys.spec.ts', 'staging-community.spec.ts', 'staging-auth.spec.ts']) {
    assert.match(frontendPackage.scripts['test:e2e:ci'], new RegExp(spec.replace('.', '\\.')));
  }
  assert.match(frontendPackage.scripts['test:e2e:ci'], /assert-isolated-e2e\.js/);
});
