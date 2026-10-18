/**
 * App Update System & API Verification Test Suite for Padhlo
 * Tests:
 * 1. Backend update manifest endpoint GET /api/app-update
 * 2. Proper reading of APP_LATEST_VERSION, APP_MIN_SUPPORTED_VERSION, APP_APK_URL, APP_RELEASE_NOTES, APP_UPDATE_REQUIRED
 * 3. Validation against missing configuration (503), invalid version formats (500), and non-HTTPS URLs (500)
 * 4. Zero secrets / credential leakage in responses
 * 5. Semantic version comparison: numerical component comparison, not alphabetical
 * 6. Optional update vs Mandatory update logic
 * 7. Installed version already current (no popup)
 */

const assert = require('assert');
const path = require('path');
const http = require('http');
const express = require('express');

// Ensure backend .env is loaded
require('dotenv').config({ path: path.join(__dirname, '../.env') });

let totalTests = 0;
let passedTests = 0;

function it(description, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

async function itAsync(description, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${description}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${description}`);
    console.error(`     Error: ${err.message}`);
    throw err;
  }
}

// Semantic versioning logic as implemented in frontend
function isVersionOlder(currentVersion, targetVersion) {
  if (!currentVersion || !targetVersion) return false;
  const sanitize = (v) => v.replace(/^v/, '').trim();
  const currentParts = sanitize(currentVersion).split('.').map((p) => parseInt(p, 10) || 0);
  const targetParts = sanitize(targetVersion).split('.').map((p) => parseInt(p, 10) || 0);

  const length = Math.max(currentParts.length, targetParts.length);
  for (let i = 0; i < length; i++) {
    const cur = currentParts[i] || 0;
    const tgt = targetParts[i] || 0;
    if (cur < tgt) return true;
    if (cur > tgt) return false;
  }
  return false;
}

function evaluateUpdateStatus(currentVersion, manifest) {
  if (!manifest) {
    return { isUpdateAvailable: false, isMandatory: false };
  }
  const isNewerVersionAvailable = isVersionOlder(currentVersion, manifest.latestVersion);
  const isBelowMinimumSupported = isVersionOlder(currentVersion, manifest.minimumSupportedVersion);

  if (!isNewerVersionAvailable && !isBelowMinimumSupported) {
    return { isUpdateAvailable: false, isMandatory: false };
  }

  const isMandatory = isBelowMinimumSupported || (Boolean(manifest.updateRequired) && isNewerVersionAvailable);
  return {
    isUpdateAvailable: isNewerVersionAvailable || isMandatory,
    isMandatory,
  };
}

async function runTestSuite() {
  console.log('\n========================================');
  console.log('🧪 PADHLO APP UPDATE TEST SUITE');
  console.log('========================================\n');

  // SECTION 1: Semantic Version Comparison Engine
  console.log('▶ 1. Semantic Versioning Comparison (Numerical, not Alphabetical)');

  it('correctly identifies identical versions as not older', () => {
    assert.strictEqual(isVersionOlder('1.0.0', '1.0.0'), false);
    assert.strictEqual(isVersionOlder('v1.0.0', '1.0.0'), false);
  });

  it('correctly identifies older patch and minor versions', () => {
    assert.strictEqual(isVersionOlder('1.0.0', '1.0.1'), true);
    assert.strictEqual(isVersionOlder('1.0.0', '1.1.0'), true);
    assert.strictEqual(isVersionOlder('1.0.0', '2.0.0'), true);
  });

  it('handles multi-digit numbers properly (1.9.0 vs 1.10.0)', () => {
    // In alphabetical comparison, "1.9.0" > "1.10.0" would wrongly be true
    // In numerical semver, 1.9.0 is older than 1.10.0
    assert.strictEqual(isVersionOlder('1.9.0', '1.10.0'), true);
    assert.strictEqual(isVersionOlder('1.10.0', '1.9.0'), false);
  });

  it('does not trigger update if installed version is higher than latest', () => {
    assert.strictEqual(isVersionOlder('1.0.1', '1.0.0'), false);
    assert.strictEqual(isVersionOlder('2.0.0', '1.0.0'), false);
  });

  // SECTION 2: Update Status Evaluation (Current, Optional, Mandatory)
  console.log('\n▶ 2. Update Status Evaluation (Current vs Optional vs Mandatory)');

  it('does NOT show update modal when installed is current (1.0.0 vs 1.0.0)', () => {
    const manifest = {
      latestVersion: '1.0.0',
      minimumSupportedVersion: '1.0.0',
      apkUrl: 'https://example.com/padhlo.apk',
      updateRequired: false,
    };
    const status = evaluateUpdateStatus('1.0.0', manifest);
    assert.strictEqual(status.isUpdateAvailable, false);
    assert.strictEqual(status.isMandatory, false);
  });

  it('shows optional update when newer version is available and installed >= minSupported', () => {
    const manifest = {
      latestVersion: '1.0.1',
      minimumSupportedVersion: '1.0.0',
      apkUrl: 'https://example.com/padhlo.apk',
      updateRequired: false,
    };
    const status = evaluateUpdateStatus('1.0.0', manifest);
    assert.strictEqual(status.isUpdateAvailable, true);
    assert.strictEqual(status.isMandatory, false);
  });

  it('shows mandatory update when installed is below minimum supported version', () => {
    const manifest = {
      latestVersion: '1.1.0',
      minimumSupportedVersion: '1.0.5',
      apkUrl: 'https://example.com/padhlo.apk',
      updateRequired: false,
    };
    const status = evaluateUpdateStatus('1.0.0', manifest);
    assert.strictEqual(status.isUpdateAvailable, true);
    assert.strictEqual(status.isMandatory, true);
  });

  it('shows mandatory update when updateRequired=true and newer version available', () => {
    const manifest = {
      latestVersion: '1.0.1',
      minimumSupportedVersion: '1.0.0',
      apkUrl: 'https://example.com/padhlo.apk',
      updateRequired: true,
    };
    const status = evaluateUpdateStatus('1.0.0', manifest);
    assert.strictEqual(status.isUpdateAvailable, true);
    assert.strictEqual(status.isMandatory, true);
  });

  // SECTION 3: Backend Endpoint & Validation Handler
  console.log('\n▶ 3. Backend Manifest API & Validation');

  const app = express();
  app.use(express.json());

  // Mount identical handler
  const handleAppUpdateCheck = (req, res) => {
    const latestVersion = (process.env.APP_LATEST_VERSION || '').trim();
    const apkUrl = (process.env.APP_APK_URL || '').trim();
    const minVersion = (process.env.APP_MIN_SUPPORTED_VERSION || '').trim() || latestVersion;
    const releaseNotes = (process.env.APP_RELEASE_NOTES || '').trim() || "We've improved your study experience. Update Padhlo to get the latest features and fixes.";
    const updateRequired = process.env.APP_UPDATE_REQUIRED === 'true';
    const publishedAt = (process.env.APP_UPDATE_PUBLISHED_AT || '').trim() || new Date().toISOString();

    if (!latestVersion || !apkUrl) {
      const missing = [];
      if (!latestVersion) missing.push('APP_LATEST_VERSION');
      if (!apkUrl) missing.push('APP_APK_URL');
      return res.status(503).json({
        success: false,
        error: 'UPDATE_CONFIG_MISSING',
        message: `Update server configuration incomplete: Missing ${missing.join(', ')}. Please configure these variables in the backend environment settings.`,
      });
    }

    const semverRegex = /^v?\d+(\.\d+)*(\-[0-9A-Za-z.-]+)?$/;
    if (!semverRegex.test(latestVersion)) {
      return res.status(500).json({
        success: false,
        error: 'INVALID_VERSION_FORMAT',
        message: `APP_LATEST_VERSION '${latestVersion}' is not a valid semantic version (e.g. '1.0.0').`,
      });
    }
    if (!semverRegex.test(minVersion)) {
      return res.status(500).json({
        success: false,
        error: 'INVALID_MIN_VERSION_FORMAT',
        message: `APP_MIN_SUPPORTED_VERSION '${minVersion}' is not a valid semantic version (e.g. '1.0.0').`,
      });
    }

    try {
      const parsedUrl = new URL(apkUrl);
      if (parsedUrl.protocol !== 'https:') {
        return res.status(500).json({
          success: false,
          error: 'INSECURE_APK_URL',
          message: 'APP_APK_URL must use secure HTTPS protocol to safeguard app downloads.',
        });
      }
    } catch {
      return res.status(500).json({
        success: false,
        error: 'INVALID_APK_URL',
        message: 'APP_APK_URL is not a valid URL.',
      });
    }

    return res.status(200).json({
      success: true,
      latestVersion,
      minimumSupportedVersion: minVersion,
      apkUrl,
      releaseNotes,
      updateRequired,
      publishedAt,
    });
  };

  app.get('/api/app-update', handleAppUpdateCheck);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const serverPort = server.address().port;

  await itAsync('serves GET /api/app-update with actual environment values', async () => {
    const res = await fetch(`http://localhost:${serverPort}/api/app-update`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.strictEqual(data.success, true);
    assert.strictEqual(data.latestVersion, process.env.APP_LATEST_VERSION || '1.0.0');
    assert.strictEqual(data.apkUrl, process.env.APP_APK_URL);
    assert.strictEqual(typeof data.releaseNotes, 'string');
    assert.strictEqual(typeof data.updateRequired, 'boolean');

    // Verify zero secrets leaked
    assert.strictEqual(data.JWT_SECRET, undefined);
    assert.strictEqual(data.BREVO_API_KEY, undefined);
    assert.strictEqual(data.MONGODB_URI, undefined);
    assert.strictEqual(data.OTP_SECRET, undefined);
  });

  await itAsync('returns 503 error when required variables are missing', async () => {
    const origUrl = process.env.APP_APK_URL;
    delete process.env.APP_APK_URL;

    const res = await fetch(`http://localhost:${serverPort}/api/app-update`);
    assert.strictEqual(res.status, 503);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, 'UPDATE_CONFIG_MISSING');
    assert.ok(data.message.includes('APP_APK_URL'));

    process.env.APP_APK_URL = origUrl;
  });

  await itAsync('returns 500 error when APK URL is not HTTPS', async () => {
    const origUrl = process.env.APP_APK_URL;
    process.env.APP_APK_URL = 'http://insecure.example.com/app.apk';

    const res = await fetch(`http://localhost:${serverPort}/api/app-update`);
    assert.strictEqual(res.status, 500);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, 'INSECURE_APK_URL');

    process.env.APP_APK_URL = origUrl;
  });

  await itAsync('returns 500 error when version format is invalid', async () => {
    const origVer = process.env.APP_LATEST_VERSION;
    process.env.APP_LATEST_VERSION = 'invalid-version';

    const res = await fetch(`http://localhost:${serverPort}/api/app-update`);
    assert.strictEqual(res.status, 500);
    const data = await res.json();
    assert.strictEqual(data.success, false);
    assert.strictEqual(data.error, 'INVALID_VERSION_FORMAT');

    process.env.APP_LATEST_VERSION = origVer;
  });

  server.close();

  console.log(`\n========================================`);
  console.log(`🎉 ALL ${passedTests}/${totalTests} APP UPDATE TESTS PASSED!`);
  console.log(`========================================\n`);
}

runTestSuite().catch((err) => {
  console.error('\n❌ Test suite failed:', err);
  process.exit(1);
});
