import { test, expect } from '@playwright/test';

/**
 * اختبارات تدفّق تسجيل الدخول نفسه.
 *
 * هذا الملف الوحيد الذي يبدأ **بدون جلسة**: بقيّة الاختبارات ترث الجلسة من
 * use.storageState (مشروع setup)، ولو ورثها هذا الملف لَما اختُبر الدخول أصلاً.
 * (كان سابقاً tests/smartERP.spec.js — أُعيدت تسميته ليطابق ما يختبره فعلاً.)
 */
test.use({ storageState: { cookies: [], origins: [] } });

const LOGIN_URL = process.env.BASE_URL;
const ERP_COMPANY = process.env.ERP_COMPANY;
const ERP_USER = process.env.ERP_USER;
const ERP_PASSWORD = process.env.ERP_PASSWORD;

test.describe('تسجيل الدخول', () => {
  test('TC-L-01 صفحة الدخول تُحمَّل ويظهر نموذجها', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await expect(page.locator('#this_company')).toBeVisible();
    await expect(page.getByPlaceholder('Username')).toBeVisible();
    await expect(page.getByRole('button', { name: /login/i })).toBeVisible();
  });

  test('TC-L-02 دخول ببيانات صحيحة يفتح التطبيق ويُظهر قائمة الأصناف', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.locator('#this_company').fill(ERP_COMPANY);
    await page.getByPlaceholder('Username').fill(ERP_USER);
    await page.getByPlaceholder('Password').fill(ERP_PASSWORD);
    await page.getByRole('button', { name: /login/i }).click();

    await expect(page).not.toHaveURL(/login/);

    // نافذة "You are successfully logged in." تعترض النقرات — أغلقيها أولاً.
    const ok = page.getByRole('button', { name: /^ok$/i });
    if (await ok.isVisible({ timeout: 5000 }).catch(() => false)) await ok.click();

    // "Products" ليست رابطاً مباشراً — تقع داخل قائمة "Inventory" المطويّة.
    await page.getByText('Inventory').first().click();
    await expect(page.getByRole('link', { name: 'List Products' })).toBeVisible();
  });

  test('TC-L-03 دخول بكلمة مرور خاطئة يُرفَض ولا يفتح التطبيق', async ({ page }) => {
    await page.goto(LOGIN_URL);
    await page.locator('#this_company').fill(ERP_COMPANY);
    await page.getByPlaceholder('Username').fill(ERP_USER);
    await page.getByPlaceholder('Password').fill('WRONG_PASSWORD_' + Date.now());
    await page.getByRole('button', { name: /login/i }).click();

    // يجب البقاء على صفحة الدخول (أو العودة إليها) دون الوصول للتطبيق.
    await expect(page).toHaveURL(/login/, { timeout: 15_000 });
    await expect(page.locator('#this_company')).toBeVisible();
  });
});
