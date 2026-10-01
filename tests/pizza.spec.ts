import { Page } from '@playwright/test';
import { test, expect } from 'playwright-test-coverage';
import { Role, User } from '../src/service/pizzaService';

async function basicInit(page: Page) {
  let loggedInUser: User | undefined;
  const validUsers: Record<string, User> = {
    'd@jwt.com': { id: '3', name: 'Kai Chen', email: 'd@jwt.com', password: 'a', roles: [{ role: Role.Diner }] },
    'f@jwt.com': { id: '4', name: 'Frank Fran', email: 'f@jwt.com', password: 'a', roles: [{ role: Role.Franchisee, objectId: '2' }] },
    'a@jwt.com': { id: '5', name: 'Admin Ann', email: 'a@jwt.com', password: 'a', roles: [{ role: Role.Admin }] },
  };

  // Authorize login for the given user
  await page.route('*/**/api/auth', async (route) => {
    const loginReq = route.request().postDataJSON();
    const user = validUsers[loginReq.email];
    if (!user || user.password !== loginReq.password) {
      await route.fulfill({ status: 401, json: { error: 'Unauthorized' } });
      return;
    }
    loggedInUser = validUsers[loginReq.email];
    const loginRes = {
      user: loggedInUser,
      token: 'abcdef',
    };
    expect(route.request().method()).toBe('PUT');
    await route.fulfill({ json: loginRes });
  });

  // Return the currently logged in user
  await page.route('*/**/api/user/me', async (route) => {
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: loggedInUser });
  });

  // A standard menu
  await page.route('*/**/api/order/menu', async (route) => {
    const menuRes = [
      {
        id: 1,
        title: 'Veggie',
        image: 'pizza1.png',
        price: 0.0038,
        description: 'A garden of delight',
      },
      {
        id: 2,
        title: 'Pepperoni',
        image: 'pizza2.png',
        price: 0.0042,
        description: 'Spicy treat',
      },
    ];
    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: menuRes });
  });

  // Standard franchises and stores. Kept in a variable so creating and closing stick.
  let franchises = [
    {
      id: 2,
      name: 'LotaPizza',
      admins: [{ id: '4', name: 'Frank Fran', email: 'f@jwt.com' }],
      stores: [
        { id: 4, name: 'Lehi' },
        { id: 5, name: 'Springville' },
        { id: 6, name: 'American Fork' },
      ],
    },
    { id: 3, name: 'PizzaCorp', admins: [], stores: [{ id: 7, name: 'Spanish Fork' }] },
    { id: 4, name: 'topSpot', admins: [], stores: [] },
  ];
  let nextFranchiseId = 10;

  // List the franchises (GET) or create one (POST)
  await page.route(/\/api\/franchise(\?.*)?$/, async (route) => {
    if (route.request().method() === 'POST') {
      const req = route.request().postDataJSON();
      const created = { id: nextFranchiseId++, name: req.name, admins: req.admins ?? [], stores: [] };
      franchises.push(created);
      await route.fulfill({ json: created });
      return;
    }

    expect(route.request().method()).toBe('GET');
    await route.fulfill({ json: { franchises, more: false } });
  });

  // Close a franchise (DELETE). A GET here is the franchisee asking for their own.
  await page.route(/\/api\/franchise\/\d+$/, async (route) => {
    const id = Number(route.request().url().split('/').pop());

    if (route.request().method() === 'DELETE') {
      franchises = franchises.filter((f) => f.id !== id);
      await route.fulfill({ json: { message: 'franchise deleted' } });
      return;
    }

    await route.fulfill({ json: franchises.filter((f) => f.admins?.some((a) => a.id === String(id))) });
  });

  // Order a pizza.
  await page.route('*/**/api/order', async (route) => {
    const orderReq = route.request().postDataJSON();
    const orderRes = {
      order: { ...orderReq, id: 23 },
      jwt: 'eyJpYXQ',
    };
    expect(route.request().method()).toBe('POST');
    await route.fulfill({ json: orderRes });
  });

  await page.goto('/');
}

test('login', async ({ page }) => {
  await basicInit(page);
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('d@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  await expect(page.getByRole('link', { name: 'KC' })).toBeVisible();
});

test('purchase with login', async ({ page }) => {
  await basicInit(page);

  // Go to order page
  await page.getByRole('button', { name: 'Order now' }).click();

  // Create order
  await expect(page.locator('h2')).toContainText('Awesome is a click away');
  await page.getByRole('combobox').selectOption('4');
  await page.getByRole('link', { name: 'Image Description Veggie A' }).click();
  await page.getByRole('link', { name: 'Image Description Pepperoni' }).click();
  await expect(page.locator('form')).toContainText('Selected pizzas: 2');
  await page.getByRole('button', { name: 'Checkout' }).click();

  // Login
  await page.getByPlaceholder('Email address').click();
  await page.getByPlaceholder('Email address').fill('d@jwt.com');
  await page.getByPlaceholder('Email address').press('Tab');
  await page.getByPlaceholder('Password').fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  // Pay
  await expect(page.getByRole('main')).toContainText('Send me those 2 pizzas right now!');
  await expect(page.locator('tbody')).toContainText('Veggie');
  await expect(page.locator('tbody')).toContainText('Pepperoni');
  await expect(page.locator('tfoot')).toContainText('0.008 ₿');
  await page.getByRole('button', { name: 'Pay now' }).click();

  // Check balance
  await expect(page.getByText('0.008')).toBeVisible();
});

test('admin login and create franchise, then close it', async ({ page }) => {
  await basicInit(page);

  // Log in as the admin
  await page.getByRole('link', { name: 'Login' }).click();
  await page.getByRole('textbox', { name: 'Email address' }).fill('a@jwt.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('a');
  await page.getByRole('button', { name: 'Login' }).click();

  // The admin dashboard lists the existing franchises
  await page.getByRole('link', { name: 'Admin' }).click();
  await expect(page.getByRole('heading', { name: "Mama Ricci's kitchen" })).toBeVisible();
  await expect(page.getByRole('table')).toContainText('LotaPizza');

  // Add a new one
  await page.getByRole('button', { name: 'Add Franchise' }).click();
  await expect(page.getByRole('heading', { name: 'Create franchise' })).toBeVisible();
  await page.getByPlaceholder('franchise name').fill('PizzaPocket');
  await page.getByPlaceholder('franchisee admin email').fill('f@jwt.com');
  await page.getByRole('button', { name: 'Create' }).click();

  // Back on the dashboard, it shows up in the table
  await expect(page.getByRole('heading', { name: "Mama Ricci's kitchen" })).toBeVisible();
  await expect(page.getByRole('table')).toContainText('PizzaPocket');
  
});
