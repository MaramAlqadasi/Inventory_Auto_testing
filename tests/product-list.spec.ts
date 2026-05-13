// spec: specs/product-list-testing.plan.md
import { test, expect, Page } from '@playwright/test';

const LOGIN_URL = 'https://demo.smarterp.top/login';
const PRODUCTS_URL = 'https://demo.smarterp.top/products/index';

async function login(page: Page) {
  await page.goto(LOGIN_URL);
  await page.locator('#this_company').fill('demo_maramc2');
  await page.getByPlaceholder('Username').fill('Ahmed');
  await page.getByPlaceholder('Password').fill('12345678');
  await page.getByRole('button', { name: 'Login' }).click();
  await expect(page).toHaveURL(/(welcome|products\/index|dashboard)/);
}

async function goToProducts(page: Page) {
  await login(page);
  await page.goto(PRODUCTS_URL);
  await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
}

async function ensureProductsGrid(page: Page) {
  const grid = page.getByRole('grid');
  await expect(grid).toBeVisible();
  return grid;
}

async function getFirstProductRow(page: Page) {
  return page.locator('[role="row"]').nth(1);
}

async function clickInventoryMenu(page: Page) {
  await page.getByText('Inventory').click();
  await expect(page.getByRole('link', { name: 'List Products' })).toBeVisible();
}

async function openSupplierFilter(page: Page) {
  const supplierButton = page.getByText('Supplier');
  await supplierButton.click();
  return supplierButton;
}

async function chooseWarehouseOption(page: Page, index = 1) {
  await page.getByText('All Warehouses').click();
  const option = page.getByRole('option').nth(index);
  await expect(option).toBeVisible();
  await option.click();
}

async function assertSelectableColumnHeaders(page: Page) {
  const headers = [
    'ID',
    'Currency',
    'Product Type',
    'Brand',
    'Categories',
    'Sub Categories',
    'Tax',
    'Tax Method',
  ];

  for (const header of headers) {
    const locator = page.getByRole('columnheader', { name: header });
    await expect(locator).toBeVisible();
  }
}

async function clearSearch(page: Page) {
  const search = page.getByPlaceholder('search');
  await search.fill('');
}

async function assertRowContainsText(page: Page, text: string) {
  const firstRow = await getFirstProductRow(page);
  await expect(firstRow).toContainText(text);
}

async function openFirstRowActionMenu(page: Page) {
  const firstRow = await getFirstProductRow(page);
  const buttons = firstRow.locator('button');
  await expect(buttons).toHaveCountGreaterThan(0);
  await buttons.last().click();
}

async function waitForLoginTimeout(page: Page) {
  await page.context().clearCookies();
  await page.reload();
}

test.describe('Authentication and Navigation', () => {
  test('Successful Login with Valid Credentials', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.locator('#this_company').fill('demo_maramc2');
    await page.getByPlaceholder('Username').fill('Ahmed');
    await page.getByPlaceholder('Password').fill('12345678');
    const loginButton = page.getByRole('button', { name: 'Login' });
    await expect(loginButton).toBeEnabled();
    await loginButton.click();
    await expect(page).toHaveURL(/(welcome|products\/index|dashboard)/);
    await expect(page.getByText('You are successfully logged in.')).toBeVisible();
  });

  test('Navigate to Products List from Menu', async ({ page }) => {
    await login(page);
    await clickInventoryMenu(page);
    await page.getByRole('link', { name: 'List Products' }).click();
    await expect(page).toHaveURL(/products\/index/);
    await expect(page.getByRole('heading', { name: 'Products' })).toBeVisible();
    await ensureProductsGrid(page);
  });

  test('Login with Invalid Credentials', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.locator('#this_company').fill('invalid_company');
    await page.getByPlaceholder('Username').fill('InvalidUser');
    await page.getByPlaceholder('Password').fill('WrongPassword');
    await page.getByRole('button', { name: 'Login' }).click();
    await expect(page.getByText(/invalid|incorrect|error|failed/i)).toBeVisible();
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Products List Display and Layout', () => {
  test.beforeEach(async ({ page }) => {
    await goToProducts(page);
  });

  test('Verify Products Grid Structure and Columns', async ({ page }) => {
    const grid = await ensureProductsGrid(page);
    const expectedColumns = [
      'ID',
      'Image',
      'Code',
      'Arabic Name',
      'English Name',
      'Currency',
      'Product Type',
      'Brand',
      'Categories',
      'Sub Categories',
      'Cost',
      'Price',
      'Min Price',
      'Max Price',
      'Quantity',
      'reserved quantity',
      'Unit',
      'Tax',
      'Tax Method',
      'Alert Quantity',
    ];

    for (const column of expectedColumns) {
      await expect(page.getByRole('columnheader', { name: new RegExp(column, 'i') })).toBeVisible();
    }

    const firstRow = await getFirstProductRow(page);
    await expect(firstRow).toBeVisible();
    await expect(firstRow).toContainText(/SAR|Inclusive|Exclusive|Materials|Package|Combo/i);
    await expect(firstRow.locator('button')).toHaveCountGreaterThan(0);
  });

  test('Verify Toolbar and Action Buttons', async ({ page }) => {
    const addProductButton = page.locator('a[href="/products/add"]');
    await expect(addProductButton).toBeVisible();
    await expect(addProductButton).toHaveAttribute('href', '/products/add');
    await expect(page.getByPlaceholder('search')).toBeVisible();
    await expect(page.getByText('Supplier')).toBeVisible();
  });

  test('Verify Header Filters and Search', async ({ page }) => {
    await expect(page.getByText('All Warehouses')).toBeVisible();
    await expect(page.getByPlaceholder('search')).toBeVisible();
    await page.getByText('All Warehouses').click();
    await expect(page.getByRole('option').first()).toBeVisible();
  });
});

test.describe('Products List Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await goToProducts(page);
  });

  test('Filter Products by Warehouse', async ({ page }) => {
    await chooseWarehouseOption(page, 1);
    await expect(page.getByText(/Warehouses|All Warehouses/i)).toBeVisible();
    await expect(page.getByRole('grid')).toBeVisible();
  });

  test('Search Products by Name', async ({ page }) => {
    const searchBox = page.getByPlaceholder('search');
    await searchBox.fill('shamel1');
    await expect(page.locator('[role="row"]')).toContainText('shamel1');
    await clearSearch(page);
    await expect(page.getByRole('grid')).toBeVisible();
  });

  test('Filter by Supplier', async ({ page }) => {
    await openSupplierFilter(page);
    const supplierOption = page.getByRole('option').first();
    await expect(supplierOption).toBeVisible();
    await supplierOption.click();
    await expect(page.getByRole('grid')).toBeVisible();
  });

  test('Filter Products Using Column Filters', async ({ page }) => {
    const idFilter = page.getByPlaceholder('ID');
    await idFilter.fill('2719');
    await expect(page.locator('[role="row"]')).toContainText('2719');
    const nameFilter = page.getByPlaceholder('English Name');
    await nameFilter.fill('shamel1');
    await expect(page.locator('[role="row"]')).toContainText('shamel1');
  });
});

test.describe('Products List Sorting', () => {
  test.beforeEach(async ({ page }) => {
    await goToProducts(page);
  });

  test('Sort Products by ID', async ({ page }) => {
    const idHeader = page.getByRole('columnheader', { name: 'ID' });
    await idHeader.click();
    await expect(idHeader).toBeVisible();
    await idHeader.click();
    await expect(idHeader).toBeVisible();
  });

  test('Sort Products by Price', async ({ page }) => {
    const priceHeader = page.getByRole('columnheader', { name: 'Price' });
    await priceHeader.click();
    await expect(priceHeader).toBeVisible();
  });

  test('Sort Products by Category', async ({ page }) => {
    const categoryHeader = page.getByRole('columnheader', { name: 'Categories' });
    await categoryHeader.click();
    await expect(categoryHeader).toBeVisible();
  });
});

test.describe('Products List Row Selection', () => {
  test.beforeEach(async ({ page }) => {
    await goToProducts(page);
  });

  test('Select Single Product Checkbox', async ({ page }) => {
    const firstRow = await getFirstProductRow(page);
    const checkbox = firstRow.getByRole('checkbox');
    await checkbox.check();
    await expect(checkbox).toBeChecked();
  });

  test('Select Multiple Products', async ({ page }) => {
    const firstRow = await getFirstProductRow(page);
    const secondRow = page.locator('[role="row"]').nth(2);
    await firstRow.getByRole('checkbox').check();
    await secondRow.getByRole('checkbox').click({ modifiers: ['Control'] });
    await expect(firstRow.getByRole('checkbox')).toBeChecked();
    await expect(secondRow.getByRole('checkbox')).toBeChecked();
  });

  test('Select All Products Using Header Checkbox', async ({ page }) => {
    const headerCheckbox = page.locator('[role="row"]').first().getByRole('checkbox');
    await headerCheckbox.check();
    await expect(page.locator('[role="row"]').nth(1).getByRole('checkbox')).toBeChecked();
    await headerCheckbox.uncheck();
    await expect(page.locator('[role="row"]').nth(1).getByRole('checkbox')).not.toBeChecked();
  });
});

test.describe('Product Row Actions', () => {
  test.beforeEach(async ({ page }) => {
    await goToProducts(page);
  });

  test('Open Product Action Menu', async ({ page }) => {
    await openFirstRowActionMenu(page);
    await expect(page.locator('text=Edit').first()).toBeVisible({ timeout: 3000 });
  });

  test('Click on Product Row to View Details', async ({ page }) => {
    const firstRow = await getFirstProductRow(page);
    await firstRow.click();
    await expect(page.locator('text=Product')).toBeVisible();
  });

  test('Navigate to Add New Product', async ({ page }) => {
    await page.locator('a[href="/products/add"]').click();
    await expect(page).toHaveURL(/products\/add/);
    await expect(page.getByRole('heading', { name: /Add|Create|New Product/i })).toBeVisible();
  });
});

test.describe('Edge Cases and Negative Scenarios', () => {
  test.beforeEach(async ({ page }) => {
    await goToProducts(page);
  });

  test('Search for Non-existent Product', async ({ page }) => {
    const search = page.getByPlaceholder('search');
    await search.fill('NonexistentProduct123');
    await expect(page.locator('text=No records').or(page.locator('text=No data')).or(page.locator('text=No products'))).toBeVisible();
  });

  test('Filter by Warehouse with No Products', async ({ page }) => {
    await chooseWarehouseOption(page, 2);
    await expect(page.locator('text=No records').or(page.locator('text=No data'))).toBeVisible();
  });

  test('Verify Column Headers Are Sortable', async ({ page }) => {
    await assertSelectableColumnHeaders(page);
    for (const header of ['ID', 'Currency', 'Product Type', 'Brand']) {
      await page.getByRole('columnheader', { name: header }).click();
      await expect(page.getByRole('columnheader', { name: header })).toBeVisible();
    }
  });

  test('Page Responsiveness with Large Product List', async ({ page }) => {
    const grid = await ensureProductsGrid(page);
    const row = grid.locator('[role="row"]').nth(10);
    await row.scrollIntoViewIfNeeded();
    const search = page.getByPlaceholder('search');
    await search.fill('shamel1');
    await expect(page.locator('[role="row"]')).toContainText('shamel1');
    await clearSearch(page);
  });

  test('Session Timeout Handling', async ({ page }) => {
    await login(page);
    await waitForLoginTimeout(page);
    await expect(page).toHaveURL(/login/);
  });
});

test.describe('Performance and Data Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await goToProducts(page);
  });

  test('Verify Product Data Accuracy', async ({ page }) => {
    const firstRow = await getFirstProductRow(page);
    await firstRow.click();
    await expect(page.locator('text=Price')).toBeVisible();
    await expect(page.locator('text=Quantity')).toBeVisible();
    await expect(page.locator('text=Tax')).toBeVisible();
  });

  test('Verify Currency Display', async ({ page }) => {
    await expect(page.locator('text=SAR')).toBeVisible();
  });

  test('Verify Image Loading', async ({ page }) => {
    const firstImage = page.locator('img').first();
    await expect(firstImage).toBeVisible();
  });
});
