// @ts-check
import { defineConfig, devices } from '@playwright/test';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '.env') });

/**
 * baseURL = أصل الموقع مشتقّاً من BASE_URL (الذي يشير لصفحة الدخول).
 * يتيح استخدام مسارات نسبية في الاختبارات: page.goto('/products/index').
 */
const LOGIN_URL = (process.env.BASE_URL || 'https://smarterp.top/login').trim();
const APP_ORIGIN = new URL(LOGIN_URL).origin;

/** ملف جلسة دور owner — يُنتجه مشروع setup (tests/auth.setup.ts). */
const OWNER_STATE = '.auth/owner.json';

/**
 * @see https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests',

  /**
   * التشغيل تسلسلي عن قصد: البيئة المستهدفة إنتاجية خلف WAF حسّاس للمعدّل — التوازي
   * أطلق حجب IP فعلياً (2026-06). ليس بسبب تعارض الجلسة: ملف الجلسة للقراءة فقط
   * وتشاركه الـ workers بأمان.
   */
  fullyParallel: false,
  workers: 1,

  forbidOnly: !!process.env.CI,
  /** لا إعادة محاولة: تُخفي الهشاشة وتضاعف الطلبات ضدّ الـ WAF. */
  retries: 0,

  /** مهلة الاختبار: البيئة الحيّة بطيئة (طلبات DataTables تصل خلال 8-15 ثانية أحياناً). */
  timeout: 60_000,
  expect: { timeout: 10_000 },

  reporter: [
    ['list'],
    ['html', { open: 'never' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
  ],

  use: {
    baseURL: APP_ORIGIN,
    /** أدلّة تشخيص عند الفشل — تعمل محلياً أيضاً (retries=0 يُبطل on-first-retry). */
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 45_000,
  },

  projects: [
    /**
     * يجدّد .auth/owner.json تلقائياً (ويتخطّى الدخول إن كانت الجلسة صالحة).
     * يستخدم وصف Desktop Chrome كي يحمل الدخول user-agent متصفّح حقيقي؛ الافتراضي في
     * headless يعلن "HeadlessChrome" وهو ما يرصده الـ WAF عند الدخول (لا في بقية الصفحات
     * لأن مشروع chromium يستخدم الوصف نفسه أصلاً).
     */
    { name: 'setup', testMatch: /auth\.setup\.ts/, use: { ...devices['Desktop Chrome'] } },

    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: OWNER_STATE },
      dependencies: ['setup'],
      testIgnore: /auth\.setup\.ts/,
    },

    /**
     * firefox/webkit معطّلان مؤقتاً: تشغيل نفس المجموعة ثلاث مرات يضاعف الحمل على
     * الـ WAF بلا مكسب حالي. فعّليهما بعد الانتقال لمستأجر اختبار مُدرَج في allowlist.
     */
    // { name: 'firefox', use: { ...devices['Desktop Firefox'], storageState: OWNER_STATE },
    //   dependencies: ['setup'], testIgnore: /auth\.setup\.ts/ },
    // { name: 'webkit', use: { ...devices['Desktop Safari'], storageState: OWNER_STATE },
    //   dependencies: ['setup'], testIgnore: /auth\.setup\.ts/ },
  ],
});
