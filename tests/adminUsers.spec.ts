import { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';

const allUsers: User[] = [
  { id: '1', name: 'Dan', email: 'd@jwt.com', roles: [{ role: Role.Diner }] },
  { id: '2', name: 'Frank', email: 'f@jwt.com', roles: [{ role: Role.Franchisee, objectId: '2' }] },
  { id: '3', name: 'Ann', email: 'a@jwt.com', roles: [{ role: Role.Admin }] },
];

async function adminInit(page: Page) {
  let loggedInUser: User | undefined;
  // Per-test copy: the delete test mutates this, and the module-level
  // fixture is shared by every test in the file.
  let users: User[] = allUsers.map((u) => ({ ...u }));
  const admin: User = { id: '3', name: 'Ann', email: 'a@jwt.com', password: 'a', roles: [{ role: Role.Admin }] };

  await page.route('*/**/api/auth', async (route) => {
    expect(route.request().method()).toBe('PUT');
    loggedInUser = admin;
    await route.fulfill({ json: { user: admin, token: 'abcdef' } });
  });

  await page.route('*/**/api/user/me', async (route) => {
    await route.fulfill({ json: loggedInUser });
  });

  // The admin dashboard also loads franchises. keep that out of the way
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    await route.fulfill({ json: { franchises: [], more: false } });
  });

  // GET - the list endpoint, not /api/user/me
  await page.route(/\/api\/user(\?.*)?$/, async (route) => {
    expect(route.request().method()).toBe('GET');
    const url = new URL(route.request().url());

    const nameFilter = (url.searchParams.get('name') ?? '*').replace(/\*/g, '');
    const limit = Number(url.searchParams.get('limit')) || 10;
    const page = Number(url.searchParams.get('page')) || 1;

    const matched = users.filter((u) => u.name!.toLowerCase().includes(nameFilter.toLowerCase()));
    const offset = (page - 1) * limit;
    await route.fulfill({ json: { users: matched.slice(offset, offset + limit), more: matched.length > offset + limit } });
  });

  // DELETE /api/user/:id -- digits only, so it never catches /api/user/me
  await page.route(/\/api\/user\/\d+$/, async (route) => {
    expect(route.request().method()).toBe('DELETE');
    const id = route.request().url().split('/').pop();
    users = users.filter((u) => u.id !== id);
    await route.fulfill({ json: { message: 'user deleted' } });
  });

  await page.goto('/');
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();
  await page.getByRole('link', { name: 'Admin' }).click();
}

test('admin sees the list of users', async ({ page }) => {
  await adminInit(page);

  await expect(page.getByRole('heading', { name: 'Users' })).toBeVisible();

  const danRow = page.getByRole('row').filter({ hasText: 'Dan' });
  await expect(danRow).toContainText('d@jwt.com');
  await expect(danRow).toContainText('diner');

  await expect(page.getByRole('row').filter({ hasText: 'Frank' })).toContainText('franchisee');
});

test('admin can filter the user list by name', async ({ page }) => {
  await adminInit(page);

  await expect(page.getByRole('row').filter({ hasText: 'Dan' })).toBeVisible();

  await page.getByPlaceholder('Filter users').fill('Frank');
  
  await page.getByRole('button', { name: 'Find users' }).click();

  await expect(page.getByRole('row').filter({ hasText: 'Frank' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'Dan' })).toHaveCount(0);
});

test('admin can delete a user', async ({ page }) => {
  await adminInit(page);

  const danRow = page.getByRole('row').filter({ hasText: 'Dan' });
  await expect(danRow).toBeVisible();

  await danRow.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('row').filter({ hasText: 'Dan' })).toHaveCount(0);
  await expect(page.getByRole('row').filter({ hasText: 'Frank' })).toBeVisible();
});

test('a diner cannot reach the admin dashboard', async ({ page }) => {
  await page.route('*/**/api/auth', async (route) => {
    await route.fulfill({ json: { user: { id: '1', name: 'Dan', email: 'd@jwt.com', roles: [{ role: Role.Diner }] }, token: 'abcdef' } });
  });

  await page.goto('/admin-dashboard');

  await expect(page.getByRole('heading', { name: 'Oops' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Users' })).toHaveCount(0);
});
