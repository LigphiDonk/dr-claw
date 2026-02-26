import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import jwt from 'jsonwebtoken';
import os from 'os';
import path from 'path';

/**
 * Bug verification: "Can't customize the folder for the new workspace" (Qin Ye)
 *
 * Root cause: commit 389da8d changed WORKSPACES_ROOT from os.homedir() to
 * path.join(os.homedir(), 'vibelab'), restricting all workspace operations
 * to ~/vibelab only.
 *
 * Fix: revert WORKSPACES_ROOT default back to os.homedir().
 */

const JWT_SECRET = process.env.JWT_SECRET || 'claude-ui-dev-secret-change-in-production';
const MAX_USER_ID_SCAN = Number(process.env.PLAYWRIGHT_MAX_USER_ID_SCAN || 10);
const LOGIN_USERNAME = process.env.PLAYWRIGHT_USERNAME;
const LOGIN_PASSWORD = process.env.PLAYWRIGHT_PASSWORD;

// --- Auth helpers ---

async function findValidTokenForExistingUser(request: APIRequestContext): Promise<string | null> {
  for (let userId = 1; userId <= MAX_USER_ID_SCAN; userId += 1) {
    const candidateToken = jwt.sign(
      { userId, username: `playwright-e2e-${userId}` },
      JWT_SECRET,
    );
    const response = await request.get('/api/auth/user', {
      headers: { Authorization: `Bearer ${candidateToken}` },
    });
    if (response.ok()) return candidateToken;
  }
  return null;
}

async function getAuthToken(request: APIRequestContext): Promise<string> {
  const authStatusResponse = await request.get('/api/auth/status');
  expect(authStatusResponse.ok()).toBeTruthy();
  const authStatus = await authStatusResponse.json();

  if (authStatus.needsSetup) {
    const registerResponse = await request.post('/api/auth/register', {
      data: {
        username: process.env.PLAYWRIGHT_SETUP_USERNAME || `playwright-${Date.now()}`,
        password: process.env.PLAYWRIGHT_SETUP_PASSWORD || 'playwright-password-123',
      },
    });
    expect(registerResponse.ok()).toBeTruthy();
    return (await registerResponse.json()).token;
  }

  if (LOGIN_USERNAME && LOGIN_PASSWORD) {
    const loginResponse = await request.post('/api/auth/login', {
      data: { username: LOGIN_USERNAME, password: LOGIN_PASSWORD },
    });
    expect(loginResponse.ok()).toBeTruthy();
    return (await loginResponse.json()).token;
  }

  const discoveredToken = await findValidTokenForExistingUser(request);
  if (discoveredToken) return discoveredToken;

  throw new Error('Authentication required.');
}

// --- Tests ---

test.describe('Workspace Path Customization', () => {
  test.describe.configure({ mode: 'serial' });

  test('API accepts workspace creation under ~/Documents (outside ~/vibelab)', async ({ request }) => {
    const token = await getAuthToken(request);
    const customPath = path.join(os.homedir(), 'Documents', `vibelab-test-${Date.now()}`);

    const response = await request.post('/api/projects/create-workspace', {
      headers: { Authorization: `Bearer ${token}` },
      data: { workspaceType: 'new', path: customPath },
    });

    const body = await response.json();
    console.log(`Status: ${response.status()}, path: ${customPath}`);
    console.log(`Response: ${JSON.stringify(body)}`);

    expect(response.ok()).toBe(true);
    expect(body.success).toBe(true);

    // Cleanup
    const fs = await import('fs');
    fs.rmSync(customPath, { recursive: true, force: true });
  });

  test('API accepts workspace creation under ~/vibelab (still works)', async ({ request }) => {
    const token = await getAuthToken(request);
    const validPath = path.join(os.homedir(), 'vibelab', `pw-test-${Date.now()}`);

    const response = await request.post('/api/projects/create-workspace', {
      headers: { Authorization: `Bearer ${token}` },
      data: { workspaceType: 'new', path: validPath },
    });

    const body = await response.json();
    expect(response.ok()).toBe(true);
    expect(body.success).toBe(true);

    // Cleanup
    const fs = await import('fs');
    fs.rmSync(validPath, { recursive: true, force: true });
  });

  test('browse-filesystem ~ resolves to actual home directory', async ({ request }) => {
    const token = await getAuthToken(request);

    const response = await request.get('/api/browse-filesystem?path=~', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    const actualHome = os.homedir();

    console.log(`~ resolves to: ${body.path}`);
    console.log(`Actual home dir: ${actualHome}`);

    // After fix: ~ should map to the real home directory
    expect(body.path.toLowerCase()).toBe(actualHome.toLowerCase());
  });

  test('API still rejects forbidden system paths', async ({ request }) => {
    const token = await getAuthToken(request);

    const response = await request.post('/api/projects/create-workspace', {
      headers: { Authorization: `Bearer ${token}` },
      data: { workspaceType: 'new', path: '/etc/vibelab-test' },
    });

    expect(response.ok()).toBe(false);
    const body = await response.json();
    expect(body.details || body.error).toMatch(/system directory/i);
  });
});
