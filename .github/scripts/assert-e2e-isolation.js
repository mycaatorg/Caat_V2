const REQUIRED_ENV = [
  'E2E_SUPABASE_URL',
  'E2E_SUPABASE_ANON_KEY',
  'E2E_TEST_EMAIL',
  'E2E_TEST_PASSWORD',
  'PRODUCTION_SUPABASE_URL',
];

function validateIsolation(env = process.env) {
  const missing = REQUIRED_ENV.filter((name) => !env[name]);
  if (missing.length) {
    throw new Error(`Missing required Actions secrets: ${missing.join(', ')}`);
  }

  const hostname = (name) => {
    let url;
    try {
      url = new URL(env[name]);
    } catch {
      throw new Error(`${name} must be a valid HTTPS URL.`);
    }
    if (url.protocol !== 'https:') {
      throw new Error(`${name} must be a valid HTTPS URL.`);
    }
    return url.hostname.toLowerCase();
  };

  if (hostname('E2E_SUPABASE_URL') === hostname('PRODUCTION_SUPABASE_URL')) {
    throw new Error('The E2E Supabase project must differ from production.');
  }
}

if (require.main === module) {
  try {
    validateIsolation();
    console.log('Dedicated E2E database and test account are configured.');
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { validateIsolation };
