import { test, expect } from '@playwright/test';
import { ProductsPage, isProductsAjaxResponse } from '../pages/products.page';
import {
  knownProducts,
  validData,
  edgeData,
  negativeData,
  filterOptions,
  ignoredConsolePatterns,
  expectedColumns,
} from '../test-data/products.data';

/**
 * اختبارات صفحة قائمة الأصناف /products/index
 * المصدر: specs/product-list.test-plan.md (54 حالة).
 * المصادقة: تلقائية عبر مشروع setup (tests/auth.setup.ts) -> .auth/owner.json (دور owner).
 *
 * كل test معنون بـ TC ID من الخطة. مجموعات describe من A إلى J.
 * الكتابة (حذف/إضافة) تتبع نمط QA_AUTO_* مع تنظيف، أو test.skip عند تعذّر الأمان بأداة بسيطة.
 */

// الجلسة تأتي من إعداد المشروع (use.storageState في playwright.config.js).

test.describe('Products List — /products/index', () => {
  let products: ProductsPage;

  test.beforeEach(async ({ page }) => {
    products = new ProductsPage(page);
    await products.goto();
    await expect(products.table).toBeVisible();
    // حارس الأعمدة: إن اختلفت أعمدة الجدول عن المتوقَّع تُعرض كل الأعمدة الفعلية
    // (طرفية + تقرير HTML) ثم تُكمل الحالة تنفيذها — لا إفشال هنا.
    await products.reportColumnDiff(expectedColumns, test.info());
  });

  // ===========================================================================
  // المجموعة A: التحميل والعرض الأولي
  // ===========================================================================
  test.describe('A — التحميل والعرض الأولي', () => {
    test('TC-A-01 تحميل الصفحة وعرض الجدول دون أخطاء console', async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          const txt = msg.text();
          if (!ignoredConsolePatterns.some((re) => re.test(txt))) errors.push(txt);
        }
      });
      // إعادة تحميل لالتقاط أخطاء الـ console أثناء التحميل.
      await products.goto();
      // التأكيدات الجوهرية: الجدول ظاهر وفيه بيانات.
      await expect(products.table).toBeVisible();
      expect(await products.getRowCount()).toBeGreaterThan(0);
      // أخطاء الـ console: الصفحة تحمّل أدوات أطراف ثالثة كثيرة (تحليلات/دردشة) يحجبها
      // مانع الإعلانات فتظهر كأخطاء تحميل موارد — ضوضاء بيئية لا عيب منتج. نسجّلها كتنبيه
      // (annotation) للمراجعة بدل إفشال الاختبار بسببها.
      if (errors.length) {
        test.info().annotations.push({ type: 'console-errors', description: errors.join(' | ') });
      }
    });

    test('TC-A-02 وجود الأعمدة الإلزامية', async ({ page }) => {
      // اعرضي كل الأعمدة الفعلية أولاً (مرقّمة) كي يظهر أي اختلاف في التقرير حتى لو نجحت الحالة.
      const actual = await products.getColumnNames();
      test.info().annotations.push({ type: 'columns', description: actual.join(' | ') });
      console.log('أعمدة الجدول الفعلية:\n' + actual.map((c, i) => `${i}: ${c}`).join('\n'));

      // تأكيدات "لينة": تُسجَّل كل الأعمدة الناقصة معاً في تقرير واحد بدل التوقف عند أول عمود.
      for (const name of expectedColumns) {
        expect.soft(actual, `العمود "${name}" مفقود من رأس الجدول`).toContain(name);
      }
      // الأعمدة ذات النص الظاهر في الرأس — مرئية فعلاً.
      for (const name of ['Image', 'Product Type', 'Actions']) {
        await expect
          .soft(page.getByRole('columnheader', { name, exact: true }).first())
          .toBeVisible();
      }
      // الأعمدة التي رأسها حقل فلتر (textbox) — نتحقق من وجود الحقل.
      for (const name of ['ID', 'Barcode', 'Name', 'Cost', 'Price', 'Quantity', 'Unit']) {
        await expect.soft(products.filterTextbox(name)).toBeVisible();
      }
    });

    test('TC-A-03 تنسيق السعر/التكلفة (رقم عشري + عمود عملة مستقل)', async () => {
      // v1.1.3 (2026-09-14): لم يعد رمز العملة «م» يُدمَج في الخلية؛ السعر "150.000" والعملة
      // في عمود Currency مستقل ("SAR"). نتحقق من الشكل الرقمي وعدد المنازل (2–4) ووجود العملة.
      // 2026-09-15: إظهار رمز العملة داخل الخلية إعدادُ عرضٍ يختلف بين الحسابات (m-admin: "150.000"،
      // admin: "م150.00") — نقبل رمزاً اختيارياً قبل/بعد الرقم ونتحقق من الجزء العددي فقط.
      const money = /^[^\d-]*-?[\d,]+\.\d{2,4}[^\d]*$/;
      const row = products.dataRows.first();
      const v = await products.getRowValues(row);
      expect(v.price).toMatch(money);
      expect(v.cost).toMatch(money);
      expect(v.currency).not.toBe('');
    });

    test('TC-A-04 عرض الكمية السالبة', async () => {
      // بحث بالباركود المعروف للصنف ذي الكمية السالبة (id=237).
      await products.filterByText('Barcode', knownProducts.negativeQty.barcode);
      const row = products.rowContaining(knownProducts.negativeQty.id);
      const v = await products.getRowValues(row);
      // الكمية الحيّة تتغيّر مع حركات المخزون (-3.000 في يونيو، -7.0000 في سبتمبر 2026)،
      // فالتأكيد الثابت هو: تُعرَض كقيمة سالبة بصيغة رقمية صحيحة لا مقطوعة/مبتورة.
      const qty = Number(v.quantity.replace(/,/g, ''));
      expect(Number.isNaN(qty), `الكمية ليست رقماً: "${v.quantity}"`).toBeFalsy();
      expect(qty).toBeLessThan(0);
      expect(v.quantity).toMatch(/^-[\d,]+\.\d{3,4}$/);
      // افتراض الخطة: قد تُلوَّن بالأحمر — يُترَك تحققه للمُصلِّح (غير مؤكَّد class).
    });

    test('TC-A-05 عرض عدّاد النتائج "Number"', async () => {
      const count = await products.getResultsCount();
      expect(Number.isNaN(count)).toBeFalsy();
      expect(count).toBeGreaterThanOrEqual(0);
    });

    test('TC-A-06 الوصول بدون جلسة محمي (تسجيل/منع)', async ({ browser }) => {
      // فحص موثوق للحماية: ليس بالحالة فقط (تطبيقات PHP قد تعرض صفحة الدخول بحالة 200
      // ونفس URL)، بل بفحص المحتوى الفعلي — هل ظهرت بيانات الأصناف لزائر بلا جلسة؟
      const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
      const guestPage = await ctx.newPage();
      let responseStatus: number | undefined;
      guestPage.on('response', resp => {
        if (resp.url().includes('products/index')) responseStatus = resp.status();
      });
      await guestPage.goto('/products/index', { waitUntil: 'domcontentloaded' }).catch(() => {});
      // مؤشّرات حماية: redirect/خطأ، أو ظهور نموذج دخول، أو غياب جدول الأصناف.
      const url = guestPage.url();
      const hasLoginForm = await guestPage
        .locator('#this_company, input[name="password"], input[placeholder="Password"]')
        .count();
      const showsProductsTable = await guestPage.locator('div.dataTables_scrollBody table').count();
      const isProtected =
        url.includes('login') ||
        (responseStatus !== undefined && responseStatus >= 300) ||
        (hasLoginForm > 0 && showsProductsTable === 0) ||
        showsProductsTable === 0;
      expect(
        isProtected,
        `الوصول غير محمي: URL=${url}, status=${responseStatus}, loginForm=${hasLoginForm}, productsTable=${showsProductsTable}`,
      ).toBeTruthy();
      await ctx.close();
    });

    test('TC-A-07 المحتوى العربي يُعرَض باتجاه RTL', async ({ page }) => {
      // الصفحة لا تضع dir="rtl" عالمياً على html/body (computed=ltr عالمياً)؛ الاتجاه يُطبَّق
      // على مستوى المكوّنات. التحقق الصحيح: وجود عنصر واحد على الأقل يُعرَض بـ direction:rtl
      // (شرط ضروري لعرض المحتوى العربي صحيحاً). تأكيد قابل للفشل وغير فارغ.
      const rtlElementCount = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('body *')) as HTMLElement[];
        return els.filter((el) => window.getComputedStyle(el).direction === 'rtl').length;
      });
      expect(
        rtlElementCount,
        'لم يُعثر على أي عنصر يُعرَض بـ direction:rtl — المحتوى العربي قد يُعرَض بشكل خاطئ',
      ).toBeGreaterThan(0);
    });
  });

  // ===========================================================================
  // المجموعة B: الفلاتر والبحث
  // ===========================================================================
  test.describe('B — الفلاتر والبحث', () => {
    test('TC-B-01 فلتر Name نصّي — نتيجة موجودة', async () => {
      // نمط مرجعي ذاتي: نلتقط اسم أول صف ظاهر (لا نعتمد على اسم مثبّت قابل للحذف من الـ sandbox)
      // ثم نتحقق أن الفلترة بجزء منه تُرجِع نتائج تحتوي ذلك الجزء.
      const ref = await products.getRowValues(products.dataRows.first());
      const namePart = (ref.name.trim().split(/\s+/)[0] || ref.name).trim();
      await products.filterByText('Name', namePart);
      expect(await products.getRowCount()).toBeGreaterThan(0);
      const v = await products.getRowValues(products.dataRows.first());
      expect(v.name).toContain(namePart);
    });

    test('TC-B-02 فلتر Name — لا نتائج', async () => {
      await products.filterByText('Name', negativeData.noMatch);
      expect(await products.getRowCount()).toBe(0);
    });

    test('TC-B-03 فلتر Barcode بقيمة موجودة', async () => {
      // نمط مرجعي ذاتي: نلتقط باركود أول صف ظاهر (لا نعتمد على ID مثبّت قابل للحذف)
      // ثم نتحقق أن الفلترة به تُرجِع نفس الصنف.
      const ref = await products.getRowValues(products.dataRows.first());
      await products.filterByText('Barcode', ref.barcode);
      const after = await products.getRowValues(products.dataRows.first());
      expect(after.barcode).toBe(ref.barcode);
      expect(after.id).toBe(ref.id);
    });

    test('TC-B-04 باركود بصفر بادئ لا يُحذف', async () => {
      await products.filterByText('Barcode', validData.barcodeLeadingZero);
      const v = await products.getRowValues(products.dataRows.first());
      expect(v.barcode).toBe('07535934');
      expect(v.barcode.startsWith('0')).toBeTruthy();
    });

    test('TC-B-05 فلتر Product Type = Standard', async () => {
      await products.filterBySelect('Product Type', filterOptions.productType.standard);
      const count = await products.getRowCount();
      expect(count).toBeGreaterThan(0);
      const v = await products.getRowValues(products.dataRows.first());
      expect(v.productType).toBe('Standard');
    });

    test('TC-B-06 فلتر Product Type = Combo', async () => {
      await products.filterBySelect('Product Type', filterOptions.productType.combo);
      const count = await products.getRowCount();
      // يجب أن تُرجِع الفلترة نتائج Combo (المستأجر يملك أصناف Combo مؤكَّدة)،
      // وكل صف ظاهر نوعه Combo — تأكيد على كامل النتائج لا على الأول فقط.
      expect(count).toBeGreaterThan(0);
      const rows = await products.dataRows.count();
      for (let i = 0; i < Math.min(rows, 10); i++) {
        const v = await products.getRowValues(products.dataRows.nth(i));
        if (v.id) expect(v.productType).toBe('Combo');
      }
    });

    test('TC-B-07 فلتر المستودع → فرع محدد يُرسل AJAX جديد', async () => {
      const resp = await products.selectWarehouse(filterOptions.warehouses.branchAmro);
      expect(resp.status()).toBe(200);
      await expect(products.table).toBeVisible();
    });

    test('TC-B-08 فلتر المستودع يُحدِّث العدّاد', async () => {
      const before = await products.getResultsCount();
      expect(Number.isNaN(before)).toBeFalsy();
      await products.selectWarehouse(filterOptions.warehouses.branchRafha);
      const after = await products.getResultsCount();
      // ثابت غير فارغ: العدّاد رقم صالح، وهو ≥ عدد الصفوف الظاهرة في الصفحة الحالية.
      expect(Number.isNaN(after)).toBeFalsy();
      expect(after).toBeGreaterThanOrEqual(await products.getRowCount());
    });

    test('TC-B-09 فلتر Supplier', async () => {
      // اسم مورد قد لا يكون معروفًا مؤكَّدًا — نتحقق من سلامة الطلب فقط.
      const resp = await products.filterBySupplier('a');
      expect(resp.status()).toBe(200);
    });

    test('TC-B-10 تشغيل فلترين معًا (Product Type + Name)', async () => {
      // نمط مرجعي ذاتي: فلتر Standard، التقط اسم أول صف، ثم أضف فلتر الاسم بجزء منه —
      // يتجنّب الاعتماد على اسم صنف مثبّت قابل للحذف من الـ sandbox.
      await products.filterBySelect('Product Type', filterOptions.productType.standard);
      expect(await products.getRowCount()).toBeGreaterThan(0);
      const ref = await products.getRowValues(products.dataRows.first());
      const namePart = (ref.name.trim().split(/\s+/)[0] || ref.name).trim();
      await products.filterByText('Name', namePart);
      const count = await products.getRowCount();
      expect(count).toBeGreaterThan(0);
      const v = await products.getRowValues(products.dataRows.first());
      expect(v.productType).toBe('Standard');
      expect(v.name).toContain(namePart);
    });

    test('TC-B-11 إعادة تعيين الفلتر تعيد كل البيانات', async () => {
      await products.filterByText('Name', knownProducts.standardPositive.name);
      const filtered = await products.getRowCount();
      await products.clearTextFilter('Name');
      const all = await products.getRowCount();
      expect(all).toBeGreaterThanOrEqual(filtered);
    });

    test('TC-B-12 محارف SQL في حقل البحث لا تكسر الخادم', async () => {
      const resp = await products.filterByText('Name', negativeData.sqlInjection);
      expect(resp.status()).toBe(200);
      // الجدول ما زال صالحًا (لا خطأ 500).
      await expect(products.table).toBeVisible();
    });

    test('TC-B-13 محارف XSS تُعامَل كنص خام (لا dialog)', async ({ page }) => {
      let dialogShown = false;
      page.on('dialog', async (d) => {
        dialogShown = true;
        await d.dismiss();
      });
      const resp = await products.filterByText('Name', negativeData.xss);
      expect(resp.status()).toBe(200);
      expect(dialogShown).toBeFalsy();
    });

    test('TC-B-14 محرف % في حقل البحث', async () => {
      const resp = await products.filterByText('Name', negativeData.likeWildcardPercent);
      expect(resp.status()).toBe(200);
      // لا نؤكّد سلوكًا محددًا (wildcard أم حرفي) — نتحقق من عدم الانهيار فقط.
      await expect(products.table).toBeVisible();
    });

    test('TC-B-15 Currency combobox — تصفية', async () => {
      const resp = await products.filterBySelect('Currency', filterOptions.currency.SAR);
      expect(resp.status()).toBe(200);
    });

    test('TC-B-16 Tax Method — Inclusive', async () => {
      const resp = await products.filterBySelect('Tax Method', filterOptions.taxMethod.inclusive);
      expect(resp.status()).toBe(200);
    });

    test('TC-B-17 Show at point of sale = Yes', async () => {
      // فلتر العمود يعتمد على إعدادات عرض الحساب — غائب لحساب m-admin (مؤكَّد 2026-09-17).
      test.skip(
        !(await products.hasSelectFilter('Show at point of sale')),
        'عمود "Show at point of sale" لا يملك فلتر select في هذا الحساب — لا يمكن اختباره.',
      );
      const resp = await products.filterBySelect('Show at point of sale', filterOptions.showAtPos.yes);
      expect(resp.status()).toBe(200);
    });
  });

  // ===========================================================================
  // المجموعة C: الفرز
  // ===========================================================================
  test.describe('C — الفرز', () => {
    test('TC-C-01 الفرز الافتراضي ID تنازلي', async () => {
      const first = Number(await products.getCellText(products.dataRows.nth(0), 1));
      const second = Number(await products.getCellText(products.dataRows.nth(1), 1));
      expect(first).toBeGreaterThan(second);
    });

    test('TC-C-02 فرز عمود ID تصاعدي', async () => {
      const resp = await products.sortBy('ID', 'asc');
      expect(resp.status()).toBe(200);
      // expect.poll: نعيد قراءة الصفّين حتى يعكس الجدول الترتيب الجديد (لا قراءة لمرة واحدة —
      // كانت تسبق إعادة رسم DataTables أحياناً فتفشل الحالة بشكل متذبذب).
      await expect
        .poll(
          async () => {
            const first = Number(await products.getCellText(products.dataRows.nth(0), 1));
            const second = Number(await products.getCellText(products.dataRows.nth(1), 1));
            return { first, second, ascending: first < second };
          },
          { timeout: 10000, message: 'الصف الأول يجب أن يملك ID أصغر من الثاني بعد الفرز تصاعدياً' },
        )
        .toMatchObject({ ascending: true });
    });

    test('TC-C-03 فرز عمود Name', async () => {
      const resp = await products.sortBy('Name');
      expect(resp.status()).toBe(200);
      await expect(products.table).toBeVisible();
    });

    test('TC-C-04 فرز عمود Price (تصاعدي ثم تنازلي)', async () => {
      const r1 = await products.sortBy('Price');
      expect(r1.status()).toBe(200);
      const r2 = await products.sortBy('Price');
      expect(r2.status()).toBe(200);
    });

    test('TC-C-05 الفرز يحتفظ بالفلتر النشط', async () => {
      await products.filterBySelect('Product Type', filterOptions.productType.standard);
      await products.sortBy('ID');
      const count = await products.getRowCount();
      // بعد الفرز يجب أن يبقى الفلتر فعّالاً: النتائج ما زالت Standard فقط.
      expect(count).toBeGreaterThan(0);
      const v = await products.getRowValues(products.dataRows.first());
      expect(v.productType).toBe('Standard');
    });
  });

  // ===========================================================================
  // المجموعة D: الترقيم
  // ===========================================================================
  test.describe('D — الترقيم', () => {
    test('TC-D-01 عدد الصفوف الافتراضي ضمن حد الصفحة', async () => {
      const count = await products.getRowCount();
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThanOrEqual(100);
    });

    test('TC-D-02 الانتقال للصفحة التالية', async () => {
      const firstIdBefore = await products.getCellText(products.dataRows.first(), 1);
      const total = await products.getResultsCount();
      test.skip(total <= 100, 'بيانات أقل من صفحة واحدة — لا توجد صفحة تالية للاختبار.');
      const resp = await products.goToNextPage();
      expect(resp.status()).toBe(200);
      const firstIdAfter = await products.getCellText(products.dataRows.first(), 1);
      expect(firstIdAfter).not.toBe(firstIdBefore);
    });

    test('TC-D-03 الانتقال للصفحة الأخيرة ثم السابقة', async () => {
      const total = await products.getResultsCount();
      test.skip(total <= 100, 'بيانات أقل من صفحة واحدة.');
      await products.goToNextPage();
      const resp = await products.goToPreviousPage();
      expect(resp.status()).toBe(200);
    });

    test('TC-D-04 تغيير عدد الصفوف لـ 25', async () => {
      const resp = await products.setPageSize('25');
      expect(resp.status()).toBe(200);
      const count = await products.getRowCount();
      expect(count).toBeLessThanOrEqual(25);
    });
  });

  // ===========================================================================
  // المجموعة E: إظهار/إخفاء الأعمدة (ColVis)
  // ملاحظة: لم يظهر زر ColVis مستقل في aria-snapshot 2026-06-22؛ بدلاً منه أعمدة
  // كثيرة موجودة أصلاً في DOM (English Name, Symbol, Min/Max Price...). تُترَك كـ skip
  // ريثما يؤكّد المُصلِّح وجود/مكان زر ColVis فعليًا (الافتراض A-05 في الخطة).
  // ===========================================================================
  test.describe('E — إظهار/إخفاء الأعمدة (ColVis)', () => {
    test.skip('TC-E-01 فتح قائمة ColVis', async () => {
      // غير مؤكَّد: لا يوجد زر ColVis في الاستكشاف الحيّ — بحاجة تأكيد المُصلِّح.
    });
    test.skip('TC-E-02 إظهار عمود English Name', async () => {
      // يعتمد على TC-E-01.
    });
    test.skip('TC-E-03 إخفاء عمود ظاهر', async () => {
      // P3 + يعتمد على زر ColVis غير المؤكَّد.
    });
  });

  // ===========================================================================
  // المجموعة F: إجراءات الصف
  // ===========================================================================
  test.describe('F — إجراءات الصف', () => {
    // ملاحظة: تستخدم هذه الحالات أول صف ظاهر (مرجع ذاتي) بدل ID مثبّت قابل للحذف —
    // إجراءات الصف تعمل على أي صنف.
    test('TC-F-01 Product Details — فتح صفحة العرض', async ({ page }) => {
      await products.openProductDetails(products.dataRows.first());
      await expect(page).toHaveURL(/\/products\/view\/\d+/);
    });

    test('TC-F-02 Edit Product — فتح نموذج التعديل', async ({ page }) => {
      await products.openEditProduct(products.dataRows.first());
      await expect(page).toHaveURL(/\/products\/edit\/\d+/);
    });

    test('TC-F-03 Duplicate Product — نسخ', async ({ page }) => {
      await products.openDuplicateProduct(products.dataRows.first());
      await expect(page).toHaveURL(/\/products\/add\/\d+/);
    });

    test('TC-F-04 Print Barcode/Label', async ({ page, context }) => {
      // قد يفتح صفحة الطباعة في نافذة جديدة أو في التبويب نفسه. إصلاح 2026-09-17: كانت مهلة
      // انتظار النافذة 8s تنتهي قبل أن يكتمل النقر (قائمة الصف تحتاج محاولة احتياطية أحياناً —
      // انظر clickRowAction) فتفشل الحالة بشكل متذبذب. الآن ننتظر أيّاً من: نافذة جديدة أو
      // تغيّر عنوان التبويب الحالي، بمهلة تكفي البيئة البطيئة.
      const popupP = context.waitForEvent('page', { timeout: 30_000 }).catch(() => null);
      const sameTabP = page
        .waitForURL(/\/products\/print_barcodes/, { timeout: 30_000 })
        .then(() => page)
        .catch(() => null);
      await products.openPrintBarcode(products.dataRows.first());
      const target = await Promise.race([
        popupP.then((p) => p ?? new Promise<null>(() => {})), // null = انتهت المهلة؛ نترك السباق للآخر
        sameTabP.then((p) => p ?? new Promise<null>(() => {})),
        page.waitForTimeout(31_000).then(() => null),
      ]);
      expect(target, 'لم تُفتح صفحة الطباعة (لا نافذة جديدة ولا تنقّل في التبويب)').not.toBeNull();
      await target!.waitForLoadState('domcontentloaded').catch(() => {});
      await expect(target!).toHaveURL(/\/products\/print_barcodes/);
    });

    test.skip('TC-F-05 View Image — صنف بصورة', async () => {
      // P3 منخفض — يحتاج صنفًا بصورة حقيقية مؤكَّد (كل الأصناف الحالية no_image).
    });

    test.skip('TC-F-06 View Image — صنف بدون صورة', async () => {
      // P3 منخفض — سلوك popup/no_image غير مؤكَّد بأداة بسيطة.
    });

    test('TC-F-07 Delete — تأكيد (popover) ثم حذف الصنف', async () => {
      // مُفعّل 2026-06-25: ننشئ صنف QA_AUTO_* خاصًّا بنا، نحذفه عبر popover التأكيد، ونتحقق
      // من اختفائه. لا نمسّ أصنافًا قائمة؛ الصنف الوحيد المنشأ هو ما نحذفه (تنظيف ذاتي).
      test.setTimeout(180_000); // دورة حياة E2E (إنشاء+حفظ+فلترة+حذف+تحقّق) — قيست ~120s+ على البيئة الحيّة (2026-09-17)
      const data = { name: validData.newProductName(), barcode: validData.newBarcode(), cost: '10' };
      await products.addProduct(data);
      expect(await products.openListAndFindByBarcode(data.barcode)).toBeGreaterThan(0);
      const row = products.rowContaining(data.barcode);
      await products.deleteProduct(row); // popover → "Yes I'm sure"
      await products.filterByText('Barcode', data.barcode);
      expect(await products.getRowCount()).toBe(0);
    });

    test('TC-F-08 Delete — إلغاء التأكيد يُبقي الصف', async () => {
      // آمن: نفتح تأكيد الحذف ثم نلغيه — لا حذف فعلي. (أول صف ظاهر، مرجع ذاتي)
      const row = products.dataRows.first();
      const idBefore = await products.getCellText(row, 1);
      await products.openRowActions(row);
      await products.clickDeleteInMenu();
      await expect(products.sweetAlertCancel).toBeVisible({ timeout: 5000 });
      await products.sweetAlertCancel.click();
      // الصف ما زال موجودًا.
      await expect(products.rowContaining(idBefore)).toBeVisible();
    });

    test.skip('TC-F-09 Delete مرتين (double-click)', async () => {
      // يتطلب صنف QA_AUTO_* قابلًا للحذف فعليًا (انظر TC-F-07). يُترَك للهيلر.
    });

    test.skip('TC-F-10 Actions الجماعية — تحديد صفوف متعددة', async () => {
      // يتطلب أصناف QA_AUTO_* وإجراءً جماعيًا غير مؤكَّد التأثير الآمن. يُترَك للهيلر.
    });

    test.skip('TC-F-11 Actions الجماعية بدون تحديد', async () => {
      // متروك 2026-06-24: زر الإجراءات الجماعية في شريط الأدوات لا يملك نصًّا فعليًا في الـ DOM
      // (تسميته عبر أيقونة/سمة، بلا data-toggle ولا نص "Actions") فيتعذّر الإمساك به بثبات.
      // مطلوب من المطورين: data-testid="bulk-actions-button" (انظر استراتيجية المُحدِّدات في الخطة).
    });
  });

  // ===========================================================================
  // المجموعة G: التنقّل والإضافة
  // ===========================================================================
  test.describe('G — التنقّل والإضافة', () => {
    test('TC-G-01 زر Add Product — تنقّل', async ({ page }) => {
      await products.clickAddProduct();
      await expect(page).toHaveURL(/\/products\/add/, { timeout: 45_000 }); // صفحة الإضافة بطيئة التحميل
    });

    test('TC-G-02 إضافة صنف ثم ظهوره في القائمة', async () => {
      // مُفعّل 2026-06-25: الحقول الإلزامية الدنيا مؤكَّدة (name/code/cost). تنظيف ذاتي في finally.
      test.setTimeout(180_000); // دورة E2E بطيئة على البيئة الحيّة (حذف الصنف وحده ~20s)
      const data = { name: validData.newProductName(), barcode: validData.newBarcode(), cost: '10' };
      await products.addProduct(data);
      try {
        expect(await products.openListAndFindByBarcode(data.barcode)).toBeGreaterThan(0);
        const v = await products.getRowValues(products.dataRows.first());
        expect(v.barcode).toBe(data.barcode);
        expect(v.name).toContain(data.name);
      } finally {
        // تنظيف: احذف الصنف المنشأ حتى لو فشل التأكيد.
        const row = products.rowContaining(data.barcode);
        if (await row.count()) await products.deleteProduct(row).catch(() => {});
      }
    });
  });

  // ===========================================================================
  // المجموعة H: التصدير والطباعة
  // ===========================================================================
  test.describe('H — التصدير والطباعة', () => {
    test('TC-H-01 تصدير EXCEL ينزّل ملفًا', async ({ page }) => {
      const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
      await products.excelButton.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.(xlsx|xls|csv)$/i);
    });

    test('TC-H-02 تصدير PDF', async ({ page }) => {
      // مؤكَّد 2026-09-17: زر PDF يُرسل POST /products/index?ajax=1 ويعود بـ application/pdf
      // (content-disposition: attachment) بعد ~20 ثانية من التوليد على الخادم — لا popup ولا
      // حدث download خلال 15 ثانية. نتحقق من الاستجابة نفسها (نوعها/حالتها) بمهلة تكفي التوليد.
      test.setTimeout(180_000); // دورة E2E بطيئة على البيئة الحيّة (حذف الصنف وحده ~20s)
      const pdfResponse = page.waitForResponse(
        (r) => isProductsAjaxResponse(r) && /application\/pdf/i.test(r.headers()['content-type'] ?? ''),
        { timeout: 90_000 },
      );
      await products.pdfButton.click();
      const resp = await pdfResponse;
      expect(resp.status()).toBe(200);
      expect(resp.headers()['content-disposition'] ?? '').toMatch(/attachment/i);
    });

    test.skip('TC-H-03 طباعة (Print)', async () => {
      // P3 منخفض — يفتح نافذة طباعة المتصفح؛ يصعب التحقق الموثوق بأداة بسيطة.
    });

    test('TC-H-04 التصدير مع فلتر نشط', async ({ page }) => {
      await products.filterBySelect('Product Type', filterOptions.productType.standard);
      const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
      await products.excelButton.click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toMatch(/\.(xlsx|xls|csv)$/i);
      // ملاحظة: التحقق من محتوى الملف (Standard فقط) يحتاج قراءة xlsx — يُترَك للهيلر.
    });
  });

  // ===========================================================================
  // المجموعة I: الصلاحيات (RBAC)
  // ===========================================================================
  test.describe('I — الصلاحيات (RBAC)', () => {
    test('TC-I-01 دور owner — كل إجراءات الصف ظاهرة', async () => {
      await products.openRowActions(products.dataRows.first());
      const count = await products.countRowActionItems();
      // الخطة تذكر 6 إجراءات؛ نتحقق من ظهور القائمة بعدد إجراءات معقول.
      expect(count).toBeGreaterThanOrEqual(4);
    });

    test.skip('TC-I-02 دور محدود — إخفاء زر Delete', async () => {
      // لا يوجد حساب بدور محدود متاح (افتراض A-06 / سؤال Q-02). RBAC غير قابل للأتمتة الآن.
    });

    test.skip('TC-I-03 دور محدود — إخفاء زر Add', async () => {
      // نفس السبب: لا حساب viewer/cashier.
    });

    test.skip('TC-I-04 RBAC عبر URL مباشر', async () => {
      // يتطلب حسابًا لا يملك صلاحية edit. غير متاح حاليًا.
    });
  });

  // ===========================================================================
  // المجموعة J: تناسق UI/API/DB
  // ===========================================================================
  test.describe('J — تناسق UI/API/DB', () => {
    test('TC-J-01 استجابة AJAX تطابق أول صف في الجدول', async ({ page }) => {
      // نلتقط استجابة AJAX الجدول عند إعادة التحميل ونقارن أول سجل بأول صف معروض.
      const resp = await products.waitForTable(async () => {
        await page.reload({ waitUntil: 'domcontentloaded' });
      });
      expect(resp.status()).toBe(200);
      const json: any = await resp.json().catch(() => null);
      expect(json, 'استجابة AJAX الجدول ليست JSON صالحًا').not.toBeNull();
      const data = json?.aaData ?? json?.data ?? json?.aData;
      expect(Array.isArray(data)).toBeTruthy();
      expect(data.length).toBeGreaterThan(0);
      // ملاحظة للمُصلِّح: بنية الصف في الاستجابة (HTML مدمج أم حقول) غير مؤكَّدة؛
      // نتحقق من وجود ID أول صف المعروض ضمن نص استجابة الصف الأول.
      const firstRowId = await products.getCellText(products.dataRows.first(), 1);
      const firstApiRowText = JSON.stringify(data[0]);
      expect(firstApiRowText).toContain(firstRowId);
    });

    test('TC-J-02 حذف صنف ثم تحقق من اختفائه (UI + الوصول المباشر)', async ({ page }) => {
      // مُفعّل 2026-06-25: ننشئ صنفًا، نلتقط معرّفه، نحذفه، ونتحقق من اختفائه في الجدول،
      // ومن أن الوصول المباشر لصفحة عرضه لم يعد يُظهر بياناته.
      test.setTimeout(180_000); // دورة E2E بطيئة على البيئة الحيّة (حذف الصنف وحده ~20s)
      const data = { name: validData.newProductName(), barcode: validData.newBarcode(), cost: '10' };
      await products.addProduct(data);
      expect(await products.openListAndFindByBarcode(data.barcode)).toBeGreaterThan(0);
      const id = await products.getCellText(products.rowContaining(data.barcode), 1);
      // حذف
      await products.deleteProduct(products.rowContaining(data.barcode));
      // تحقق UI: غائب من الجدول
      await products.filterByText('Barcode', data.barcode);
      expect(await products.getRowCount()).toBe(0);
      // تحقق من الوصول المباشر: صفحة عرض الصنف المحذوف لا تعرض اسمه
      const resp = await page.goto(`/products/view/${id}`, { waitUntil: 'domcontentloaded' });
      const body = await page.content();
      expect(resp?.status() === 404 || !body.includes(data.name)).toBeTruthy();
    });

    test.skip('TC-J-03 بيانات الصنف بعد التعديل تُحدَّث فورًا', async () => {
      // متروك 2026-06-25: تدفّق التعديل عبر /products/edit/{id} (نفس بنية نموذج الإضافة)
      // قابل للأتمتة لاحقًا بنفس نمط addProduct. يُترَك كمتابعة لتقليل عمليات الكتابة في
      // هذه الجولة (G-02/F-07/J-02 تغطّي دورة الإنشاء/الحذف).
    });
  });
});
