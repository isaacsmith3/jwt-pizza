import { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';

// Mocks the slice of the service this test drivers using "register", "login", "logout", as the 'database' in a sense

async function userInit(page: Page) {
  const registered: Record<string, User> = {};
  let loggedInUser: User | undefined;
  let nextId = 9;

  await page.route('*/**/api/auth', async (route) => {
    const method = route.request().method();

    if (method === 'DELETE') {
      loggedInUser = undefined;
      await route.fulfill({ json: { message: 'logout successful' } });
      return;
    }

    const req = route.request().postDataJSON();

    if (method === 'POST') {
      const user: User = { id: String(nextId++), name: req.name, email: req.email, password: req.password, roles: [{ role: Role.Diner }] };
      registered[req.email] = user;
      loggedInUser = user;
      await route.fulfill({ json: { user, token: 'abcdef' } });
      return;
    }

    expect(method).toBe('PUT');
    const user = registered[req.email];
    if (!user || user.password !== req.password) {
      await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      return;
    }
    loggedInUser = user;
    await route.fulfill({ json: { user, token: 'abcdef' } });
  });

  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: loggedInUser });
  });

  // PUT /api/user/:id
  await page.route(/\/api\/user\/\d+$/, async (route) => {
    expect(route.request().method()).toBe('PUT');
    const req = route.request().postDataJSON();
    const user = registered[loggedInUser!.email!];

    // The dialog only sends a password when the field was filled in
    const updated: User = { ...user, name: req.name, email: req.email, password: req.password || user.password };
    delete registered[user.email!];

    registered[updated.email!] = updated;
    loggedInUser = updated;

    await route.fulfill({ json: { user: updated, token: 'abcdef' } });
  });

  // The diner dashboard loads order history on mount.
  await page.route('*/**/api/order', async (route) => {
    
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: { dinerId: loggedInUser?.id, orders: [], page: 1 } });
  });
}

test('updateUser', async ({ page }) => {
  await userInit(page);

  const email = `user${Math.floor(Math.random() * 10000)}@jwt.com`;
  await page.goto('/');
  await page.getByRole('link', { name: 'Register' }).click();
  await page.getByRole('textbox', { name: 'Full name' }).fill('pizza diner');
  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('diner');
  await page.getByRole('button', { name: 'Register' }).click();

  await page.getByRole('link', { name: 'pd' }).click();

  await expect(page.getByRole('main')).toContainText('pizza diner');

  await page.getByRole('button', { name: 'Edit' }).click();
  await expect(page.locator('h3')).toContainText('Edit user');
  await page.getByRole('textbox').first().fill('pizza dinerx');
  await page.getByRole('button', { name: 'Update' }).click();

  await page.waitForSelector('[role="dialog"].hidden', { state: 'attached' });

  await expect(page.getByRole('main')).toContainText('pizza dinerx');

  await page.getByRole('link', { name: 'Logout' }).click();
  await page.getByRole('link', { name: 'Login' }).click();

  await page.getByRole('textbox', { name: 'Email address' }).fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill('diner');
  await page.getByRole('button', { name: 'Login' }).click();

  await page.getByRole('link', { name: 'pd' }).click();

  await expect(page.getByRole('main')).toContainText('pizza dinerx');
});
