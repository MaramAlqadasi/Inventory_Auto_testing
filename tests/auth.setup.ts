import { test as setup, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { isProductsAjaxResponse } from '../pages/products.page';

/**
 * تجديد جلسة المصادقة تلقائياً قبل أي اختبار.
 *
 * يعمل كمشروع تابع (dependency) في playwright.config.js: كل مشروع اختبار يعتمد على
 * 'setup'، فيُشغَّل هذا الملف مرة واحدة ويُنتج .auth/owner.json الذي تستهلكه الاختبارات
 * عبر use.storageState. لا حاجة لتشغيل أي سكربت يدوي.
 *
 * إعادة الاستخدام: إذا كانت كوكي sess ما زالت صالحة (مع هامش 5 دقائق) نتخطّى الدخول
 * كلياً — يوفّر الوقت ويقلّل عدد طلبات الدخول ضدّ الـ WAF الحسّاس للمعدّل.
 *
 * ملاحظة WAF (مؤكَّدة 2026-06): الحجب يقع عند **الدخول** في الوضع headless. إن ظهر
 * "تنبيه أمني/تم حظرك" شغّلي مرة واحدة بـ: npx playwright test --project=setup --headed
 */

export const OWNER_STATE = path.join('.auth', 'owner.json');
/** بطاقة تعريف الجلسة: أيّ شركة/مستخدم أنشأها — كي لا تُعاد جلسة حساب قديم بعد تغيير .env. */
export const OWNER_META = path.join('.auth', 'owner.meta.json');

/** هامش الأمان قبل انتهاء الجلسة (ثوانٍ) — لا نبدأ جولة بجلسة على وشك الانتهاء. */
const EXPIRY_MARGIN_SECONDS = 300;

/** الحساب المطلوب حالياً من .env (الشركة + المستخدم). */
function currentIdentity() {
  return {
    company: process.env.ERP_COMPANY?.trim() ?? '',
    user: process.env.ERP_USER?.trim() ?? '',
  };
}

/**
 * هل ملف الجلسة موجود وكوكي sess فيه ما زالت صالحة **ولنفس الحساب** المعرَّف في .env؟
 * (2026-09-15) أُضيف شرط الحساب: تغيير ERP_USER (مثل m-admin → admin) كان يمرّ بصمت لأن
 * الجلسة القديمة ما زالت صالحة زمنياً، فتعمل الاختبارات على حساب غير المقصود.
 */
export function isStateFresh(file: string): boolean {
  if (!fs.existsSync(file)) return false;
  try {
    const state = JSON.parse(fs.readFileSync(file, 'utf-8'));
    const sess = (state.cookies ?? []).find((c: { name: string }) => c.name === 'sess');
    if (!sess) return false;
    if (sess.expires <= Date.now() / 1000 + EXPIRY_MARGIN_SECONDS) return false;

    const meta = JSON.parse(fs.readFileSync(OWNER_META, 'utf-8'));
    const cur = currentIdentity();
    return meta.company === cur.company && meta.user === cur.user;
  } catch {
    return false; // لا بطاقة تعريف (جلسة من نسخة أقدم) → أعد الدخول لتوثيق الحساب
  }
}

setup('authenticate owner', async ({ page }) => {
  setup.setTimeout(120_000); // الدخول على بيئة حيّة بطيء أحياناً

  if (isStateFresh(OWNER_STATE)) {
    const { company, user } = currentIdentity();
    setup.info().annotations.push({
      type: 'auth',
      description: `الجلسة صالحة للحساب ${company}/${user} — تخطّي الدخول`,
    });
    return;
  }

  const loginUrl = process.env.BASE_URL?.trim();
  const company = process.env.ERP_COMPANY?.trim();
  const user = process.env.ERP_USER?.trim();
  const password = process.env.ERP_PASSWORD?.trim();

  expect(
    Boolean(loginUrl && company && user && password),
    'بيانات الدخول ناقصة: عرّفي BASE_URL / ERP_COMPANY / ERP_USER / ERP_PASSWORD في .env (انظري .env.example)',
  ).toBeTruthy();

  await page.goto(loginUrl!, { waitUntil: 'domcontentloaded' });

  // حقل الشركة يظهر في الواجهة متعدّدة المستأجرين فقط.
  const companyField = page.locator('#this_company');
  if (await companyField.isVisible({ timeout: 5000 }).catch(() => false)) {
    await companyField.fill(company!);
  }
  await page.getByPlaceholder('Username').or(page.locator('#identity')).first().fill(user!);
  await page.getByPlaceholder('Password').or(page.locator('#password')).first().fill(password!);
  await page.getByRole('button', { name: /login/i }).click();

  // نجاح الدخول = مغادرة صفحة الدخول.
  await page.waitForURL((url) => !url.toString().includes('login'), { timeout: 30_000 });

  // نافذة "You are successfully logged in." (swal) تعترض النقرات لاحقاً — أغلقيها إن ظهرت.
  const ok = page.getByRole('button', { name: /^ok$|confirm/i });
  if (await ok.isVisible({ timeout: 3000 }).catch(() => false)) await ok.click();

  // تأكيد أن الجلسة تصلح فعلاً للصفحة قيد الاختبار (لا مجرد دخول شكلي):
  // ننتظر طلب DataTables الذي يغذّي جدول الأصناف (POST /products/index?ajax=1 منذ v1.1.3 —
  // المطابِق مشترك مع كائن الصفحة كي يُعدَّل في مكان واحد إن تغيّرت النقطة مجدداً).
  const [resp] = await Promise.all([
    page.waitForResponse(isProductsAjaxResponse, { timeout: 45_000 }),
    page.goto('/products/index', { waitUntil: 'domcontentloaded' }),
  ]);
  expect(resp.status(), 'الجلسة أُنشئت لكن طلب AJAX لجدول الأصناف لم يُرجِع 200').toBe(200);

  fs.mkdirSync(path.dirname(OWNER_STATE), { recursive: true });
  await page.context().storageState({ path: OWNER_STATE });
  // وثّقي صاحب الجلسة (بلا كلمة مرور) كي يُعاد الدخول تلقائياً عند تغيير الحساب في .env.
  fs.writeFileSync(
    OWNER_META,
    JSON.stringify({ ...currentIdentity(), createdAt: new Date().toISOString() }, null, 2),
  );
  setup.info().annotations.push({
    type: 'auth',
    description: `تم الدخول بالحساب ${company}/${user} وحُفظت الجلسة`,
  });

  expect(isStateFresh(OWNER_STATE), 'حُفظ ملف الجلسة لكن كوكي sess غير صالحة').toBeTruthy();
});
