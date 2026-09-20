import { Page, Locator, Request, Response, TestInfo, expect } from '@playwright/test';

/**
 * مطابِق استجابة AJAX لجدول الأصناف (طلب DataTables server-side).
 *
 * ملاحظة 2026-09-14: بعد ترقية التطبيق إلى v1.1.3 صار الجدول يجلب بياناته من
 * POST /products/index?ajax=1&order_by=id&order_by_val=DESC بدل POST /products/getProducts.
 * نقبل الصيغتين كي لا ينكسر الانتظار مع أي ترقية لاحقة/رجوع.
 */
export const PRODUCTS_AJAX_RE = /\/products\/getProducts|\/products\/index\?ajax=1/;
export function isProductsAjaxResponse(r: Response): boolean {
  return r.request().method() === 'POST' && PRODUCTS_AJAX_RE.test(r.url());
}

/**
 * Page Object لصفحة قائمة الأصناف: /products/index
 *
 * حقائق مؤكَّدة (استكشاف حيّ + تشخيص هيلر 2026-06-23):
 * - الجدول server-side DataTables. نقطة AJAX (v1.1.3، مؤكَّدة 2026-09-14):
 *   POST /products/index?ajax=1&order_by=... — كانت سابقاً POST /products/getProducts?ajax=1
 *   (تغيّرت مع ترقية التطبيق). المطابقة عبر isProductsAjaxResponse تقبل الصيغتين.
 * - معرّف الجدول ديناميكي (#smart-tableN-table, N يتزايد +5 كل تحميل).
 *   المحدّد المستقر: div.dataTables_scrollBody table
 * - صف الفلاتر (scrollHead grid): textbox بأسماء ID, Barcode, Name, Cost, Price, Quantity, Unit
 * - فلتر Product Type وغيره: columnheader يحوي generic > link + button (ليس combobox مباشر!)
 *   يعمل مع DataTables كـ <select> مخفي — استخدم selectOption على الـ select المرتبط.
 * - فلتر المستودع: custom dropdown (ul>li) بنية، ليس <select>. textbox داخل الـ list للبحث.
 * - فلتر Supplier: button يفتح dropdown، ليس textbox مباشر.
 * - أزرار EXCEL/PDF/Print/Actions: generic (div) وليست button — استخدم locator CSS.
 * - عدّاد النتائج (v1.1.3): <div>Number</div><div>N</div> — كان label+span قبل الترقية؛
 *   المحدّد الحالي يعتمد على النص "Number" ثم العنصر الشقيق التالي أيًّا كان وسمه.
 * - الأعمدة (v1.1.3، 2026-09-14): تغيّر ترتيبها وزادت (Image, Symbol, English Name,
 *   Currency, Brand, Categories, Sub Categories, Min/Max Price, Tax, Excise Tax, Tax Method,
 *   Expiry, Alert Quantity, Status). لا تعتمدي على فهارس ثابتة — استخدمي getCellByName
 *   الذي يشتقّ الفهرس من رأس الجدول (placeholder حقل الفلتر أو نص الرأس).
 * - تنسيق الأرقام يختلف بحسب إعداد عرض الحساب (2026-09-15): m-admin يعرض "150.000" بلا رمز،
 *   admin يعرض "م150.00" برمز العملة داخل الخلية — الاختبارات تقبل رمزاً اختيارياً حول الرقم.
 *   الكمية "-7.0000" / "0.000". العملة عمود مستقل (SAR).
 * - حارس الأعمدة: reportColumnDiff(expectedColumns) يُستدعى في beforeEach — عند أي اختلاف
 *   يعرض كل الأعمدة الفعلية (طرفية + تقرير HTML + مرفق JSON) ثم تُكمل الحالة تنفيذها.
 */
export class ProductsPage {
  readonly page: Page;

  // ---- مُحدِّدات أساسية ----
  /** الجدول الرئيسي (معرّف من البلانر). */
  readonly table: Locator;
  /** صفوف بيانات الجدول (tbody). */
  readonly dataRows: Locator;
  readonly addProductLink: Locator;
  readonly bulkActionsButton: Locator;
  readonly supplierFilter: Locator;
  readonly warehouseFilter: Locator;
  readonly resultsCounter: Locator;
  readonly excelButton: Locator;
  readonly pdfButton: Locator;
  readonly printButton: Locator;

  constructor(page: Page) {
    this.page = page;
    // عدّاد طلبات AJAX الجدول الجارية (يغذّي waitForRedraw). بعض الإجراءات تُطلق طلبين
    // متتاليين (مثل الفرز: تغيير select ثم زر الاتجاه) — ننتظر انتهاءها كلها قبل القراءة.
    const isTableReq = (r: Request) => r.method() === 'POST' && PRODUCTS_AJAX_RE.test(r.url());
    page.on('request', (r) => {
      if (isTableReq(r)) this.pendingTableRequests++;
    });
    const settle = (r: Request) => {
      if (isTableReq(r)) this.pendingTableRequests = Math.max(0, this.pendingTableRequests - 1);
    };
    page.on('requestfinished', settle);
    page.on('requestfailed', settle);
    // معرّف الجدول ديناميكي (smart-tableN-table, N يتزايد كل تحميل: 1, 6, 11...).
    // المحدّد المستقر: div.dataTables_scrollBody يحتوي الجدول الفعلي دائماً.
    // (اكتُشف بالهيلر 2026-06-23)
    this.table = page.locator('div.dataTables_scrollBody table');
    // صفوف البيانات: صفوف الجدول التي تحوي خلايا gridcell (تستثني صفّي الرأس/الفلاتر).
    // نعتمد على بنية DataTables: tbody المرئي يحوي صفوف الأصناف.
    this.dataRows = page.locator('div.dataTables_scrollBody table tbody tr').filter({
      has: page.locator('td'),
    });
    this.addProductLink = page.locator('a[href$="/products/add"]').first();
    // الإجراءات الجماعية: generic div يحمل نص "Actions" (ليس button) — صُحِّح بالهيلر
    this.bulkActionsButton = page.locator('[data-toggle="dropdown"]').filter({ hasText: 'Actions' }).first();
    // فلتر Supplier: ودجت Select2 (الـ input الحقيقي .select2-focusser مخفي/offscreen).
    // الحاوية المرئية للنقر هي a.select2-choice — صُحِّح 2026-06-24 بعد فشل نقر الزر.
    this.supplierFilter = page.locator('a.select2-choice').first();
    // فلتر المستودع: custom ul/li dropdown — textbox داخله للبحث — صُحِّح بالهيلر
    // ملاحظة: selectWarehouse() تستخدمه بأسلوب مختلف (انظر دالة selectWarehouse)
    this.warehouseFilter = page.locator('ul').filter({ has: page.locator('li').filter({ hasText: /All Warehouses/i }) }).first();
    // العدّاد: كان <label>Number</label><span>N</span>؛ صار في v1.1.3 <div>Number</div><div>N</div>
    // (2026-09-14). نطابق النص ثم الشقيق التالي بغضّ النظر عن الوسم كي يصمد أمام الحالتين.
    this.resultsCounter = page
      .getByText('Number', { exact: true })
      .filter({ visible: true })
      .first()
      .locator('xpath=following-sibling::*[1]');
    // أزرار التصدير: روابط أيقونية بلا نص (<a title="EXCEL" class="smart-xls-table"><i class="fa"/></a>)
    // — مؤكَّد 2026-09-17؛ getByText كان يطابق عنصراً آخر فلا يُطلق التنزيل. نطابق بـ title.
    this.excelButton = page.locator('a[title="EXCEL"]').first();
    this.pdfButton = page.locator('a[title="PDF"]').first();
    this.printButton = page.locator('a[title="Print"]').first();
  }

  // ---------------------------------------------------------------------------
  // التنقّل والمصادقة
  // ---------------------------------------------------------------------------

  /**
   * @deprecated المصادقة تتم تلقائياً في `tests/auth.setup.ts` (مشروع setup) والاختبارات
   * ترث الجلسة من `use.storageState`. أُبقيت للحالات النادرة (اختبار تدفّق الدخول نفسه).
   */
  async login(): Promise<void> {
    const baseUrl = process.env.BASE_URL!; // رابط صفحة الدخول الكامل من .env
    const company = process.env.ERP_COMPANY!;
    const user = process.env.ERP_USER!;
    const password = process.env.ERP_PASSWORD!;

    await this.page.goto(baseUrl);
    await this.page.locator('#this_company').fill(company);
    await this.page.getByPlaceholder('Username').fill(user);
    await this.page.getByPlaceholder('Password').fill(password);
    await this.page.getByRole('button', { name: 'Login' }).click();
    await expect(this.page).toHaveURL(/(welcome|products\/index|dashboard|^https:\/\/[^/]+\/?$)/);

    // نافذة swal "successfully logged in" قد تعترض النقرات — أغلقها إن ظهرت.
    const ok = this.page.getByRole('button', { name: 'Ok' });
    if (await ok.isVisible({ timeout: 5000 }).catch(() => false)) {
      await ok.click();
    }
  }

  /**
   * الانتقال للصفحة وانتظار أول تحميل للجدول عبر AJAX.
   * إذا فشل waitForResponse بـ timeout → الجلسة منتهية.
   * الجلسة تُجهَّز مسبقاً بمشروع setup (tests/auth.setup.ts).
   */
  async goto(): Promise<void> {
    try {
      await this.waitForTable(async () => {
        await this.page.goto('/products/index', { waitUntil: 'domcontentloaded' });
      });
    } catch (e) {
      const errMsg = String((e as Error).message);
      if (errMsg.includes('waitForResponse') || errMsg.includes('Timeout')) {
        // الجلسة تُجدَّد تلقائياً بمشروع setup؛ بقاء الفشل هنا يعني سبباً آخر.
        throw new Error(
          'تعذّر تحميل جدول الأصناف (لم يصل طلب DataTables: POST /products/index?ajax=1).\n' +
          'تحقّقي من: (1) صلاحية .auth/owner.json — احذفيه ليُعاد إنشاؤه، '  +
          '(2) حجب WAF (شغّلي: npx playwright test --project=setup --headed)، (3) توفّر البيئة.\n' +
          'السبب الأصلي: ' + errMsg,
        );
      }
      throw e;
    }
  }

  // ---------------------------------------------------------------------------
  // الانتظار الذكي
  // ---------------------------------------------------------------------------

  /**
   * ينفّذ action وينتظر استجابة AJAX الجدول (انظر isProductsAjaxResponse).
   * يُرجِع الاستجابة لفحص الحالة/البيانات.
   *
   * ملاحظة هيلر 2026-06-23: عند انتهاء كوكي sess، الخادم يُعيد الجلسة عبر remember_login
   * وهذا يُضيف navigation إضافياً (GET products/index → JS إعادة تهيئة → POST AJAX الجدول).
   * رُصد: الطلب يصل خلال 8-15 ثانية. رُفع الـ timeout إلى 45000ms لاستيعاب ذلك.
   */
  async waitForTable(action: () => Promise<void>): Promise<Response> {
    // لقطة لمحتوى الجدول قبل الإجراء — تُقارَن بعد الاستجابة للتأكد من إعادة الرسم الفعلية.
    const before = await this.tbodySnapshot();
    const [resp] = await Promise.all([
      this.page.waitForResponse(isProductsAjaxResponse, { timeout: 45000 }),
      action(),
    ]);
    // إعادة رسم DataTables: ننتظر وجود صف في tbody (أو رسالة لا نتائج).
    // ملاحظة 2026-06-24: لا نستخدم waitForLoadState('networkidle') — الصفحة تستطلع
    // /ajax/last_noti باستمرار فلا تصل أبداً لحالة idle، ما كان يستهلك مهلة beforeEach.
    await this.page
      .locator('div.dataTables_scrollBody table tbody tr')
      .first()
      .waitFor({ state: 'attached', timeout: 10000 })
      .catch(() => {});
    await this.waitForRedraw(before);
    return resp;
  }

  /** عدد طلبات AJAX الجدول الجارية حالياً (انظر المُنشئ). */
  private pendingTableRequests = 0;

  private static readonly TBODY = 'div.dataTables_scrollBody table tbody';

  /** لقطة نصّية لمحتوى tbody الحالي ('' إن لم يوجد جدول بعد — مثل قبل أول تنقّل). */
  private async tbodySnapshot(): Promise<string> {
    return this.page
      .evaluate((sel) => document.querySelector(sel)?.innerHTML ?? '', ProductsPage.TBODY)
      .catch(() => '');
  }

  /**
   * ينتظر إعادة الرسم الفعلية للجدول بعد وصول استجابة AJAX.
   *
   * سبب الإضافة 2026-09-17 (تذبذب TC-C-02 وأخواتها): وصول الاستجابة (waitForResponse يُحلّ عند
   * وصول الترويسات) لا يعني أن DataTables أعاد رسم الصفوف — القراءة الفورية كانت تلتقط
   * الصفوف القديمة أحياناً فتفشل الحالة بشكل عشوائي. الشروط الثلاثة بالترتيب:
   *  1) لا طلبات جدول جارية (يغطّي الإجراءات التي تُطلق أكثر من طلب).
   *  2) محتوى tbody تغيّر عن اللقطة السابقة — وإن لم يتغيّر خلال المهلة نُكمل (نفس النتائج).
   *  3) محتوى tbody مستقر (قراءتان متتاليتان متطابقتان) — يحمي من التقاط رسم وسيط.
   */
  private async waitForRedraw(before: string): Promise<void> {
    const deadline = Date.now() + 10000;
    while (this.pendingTableRequests > 0 && Date.now() < deadline) {
      await this.page.waitForTimeout(100);
    }
    await this.page
      .waitForFunction(
        ({ sel, prev }) => {
          const tb = document.querySelector(sel);
          return !!tb && tb.innerHTML !== prev;
        },
        { sel: ProductsPage.TBODY, prev: before },
        // 2s فقط: القياس الحيّ (2026-09-17) أظهر أن إعادة الرسم تتم خلال <1s بعد الاستجابة؛
        // المهلة تُستهلك كاملةً فقط حين لا يتغيّر المحتوى (نفس النتائج) — 4s كانت تُبطئ التشغيل الكامل.
        { timeout: 2000 },
      )
      .catch(() => {});
    let last = await this.tbodySnapshot();
    for (let i = 0; i < 8; i++) {
      await this.page.waitForTimeout(250);
      const cur = await this.tbodySnapshot();
      if (cur === last) break;
      last = cur;
    }
  }

  // ---------------------------------------------------------------------------
  // الفلاتر والبحث
  // ---------------------------------------------------------------------------

  /** حقل فلتر نصّي في رأس عمود (ID, Barcode, Name, Cost, Price, Quantity, Unit). */
  filterTextbox(name: string): Locator {
    // قد يوجد textbox بنفس الاسم في رأس الفرز ورأس الفلاتر — نأخذ الظاهر منهما.
    return this.page.getByRole('textbox', { name, exact: true }).filter({ visible: true }).first();
  }

  /** combobox فلتر في رأس عمود (Product Type, Currency, Tax Method, ...). */
  filterCombobox(name: string): Locator {
    return this.page.getByRole('combobox', { name, exact: true }).first();
  }

  /**
   * كتابة نص في فلتر عمود وانتظار إعادة تحميل الجدول.
   * إصلاح 2026-06-25 (سباق توقيت): فلتر العمود يُطلق طلب AJAX عند الكتابة (keyup). كان الـ fill
   * يحدث **قبل** بدء waitForTable بالإصغاء، فيضيع الطلب وينتظر النظام طلباً ثانياً لا يأتي
   * (waitForResponse 45s timeout — السبب الحقيقي لفشل B-01/02/03). الحل: نُجري الكتابة وإطلاق
   * keyup **داخل** waitForTable كي يكون الإصغاء جاهزاً قبل الطلب.
   */
  async filterByText(columnName: string, value: string): Promise<Response> {
    const box = this.filterTextbox(columnName);
    await box.click();
    return this.waitForTable(async () => {
      await box.fill(value);
      await box.dispatchEvent('keyup'); // يُطلق بحث العمود في DataTables
    });
  }

  /** مسح فلتر عمود نصّي وانتظار إعادة التحميل. */
  async clearTextFilter(columnName: string): Promise<Response> {
    const box = this.filterTextbox(columnName);
    await box.click();
    return this.waitForTable(async () => {
      await box.fill('');
      await box.dispatchEvent('keyup');
    });
  }

  /**
   * اختيار قيمة من فلتر عمود منسدل وانتظار إعادة التحميل.
   * ملاحظة 2026-06-24: فلاتر الأعمدة عناصر <select> أصلية **مخفية** خلف ودجت مخصّص
   * (smart-multiple-select)؛ مُحدِّدات combobox/listbox لا تتفاعل معها. نقودها مباشرةً:
   * نطابق الـ select بنص خياره الأول (placeholder = اسم العمود)، نضبط القيمة، ونُطلق change.
   */
  /**
   * هل يوجد فلتر <select> لعمود معيّن (خياره الأول = اسم العمود)؟ بعض الأعمدة تعتمد على
   * إعدادات عرض الحساب (مثل "Show at point of sale" — غائب لحساب m-admin، مؤكَّد 2026-09-17).
   */
  async hasSelectFilter(columnName: string): Promise<boolean> {
    return this.page.evaluate(
      (col) =>
        Array.from(document.querySelectorAll('select')).some(
          (s) => s.options.length > 0 && (s.options[0].text || '').trim() === col,
        ),
      columnName,
    );
  }

  async filterBySelect(columnName: string, value: string): Promise<Response> {
    return this.waitForTable(async () => {
      const applied = await this.page.evaluate(
        ({ col, val }) => {
          const selects = Array.from(document.querySelectorAll('select')).filter(
            (s) => s.options.length > 0 && (s.options[0].text || '').trim() === col,
          ) as HTMLSelectElement[];
          let hit = 0;
          for (const s of selects) {
            const opt = Array.from(s.options).find((o) => (o.text || '').trim() === val);
            if (opt) {
              s.value = opt.value;
              s.dispatchEvent(new Event('change', { bubbles: true }));
              hit++;
            }
          }
          return hit;
        },
        { col: columnName, val: value },
      );
      if (applied === 0) throw new Error(`لم يُعثر على فلتر عمود "${columnName}" بخيار "${value}"`);
    });
  }

  /**
   * اختيار مستودع من custom dropdown وانتظار إعادة التحميل.
   * البنية: ul > li[All Warehouses link] + li[textbox للبحث] + li[خيارات المستودعات].
   * يُنقر على الـ generic "All Warehouses" لفتح القائمة ثم يُنقر على الخيار المطلوب.
   * (صُحِّح بالهيلر: ليس <select>listbox بل custom dropdown)
   */
  async selectWarehouse(label: string): Promise<Response> {
    // ملاحظة 2026-06-24: فلتر المستودع <select id="warehouses"> أصلي مخفي خلف ودجت.
    // نقوده مباشرةً (set value + dispatch change) بدل التعامل مع الودجت المرئي.
    return this.waitForTable(async () => {
      const ok = await this.page.evaluate((lbl) => {
        const s = document.querySelector('#warehouses') as HTMLSelectElement | null;
        if (!s) return false;
        const opt = Array.from(s.options).find((o) => (o.text || '').trim() === lbl);
        if (!opt) return false;
        s.value = opt.value;
        s.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }, label);
      if (!ok) throw new Error(`لم يُعثر على المستودع "${label}" في #warehouses`);
    });
  }

  /**
   * تصفية بالمورد عبر ودجت Select2 وانتظار إعادة التحميل.
   * البنية: a.select2-choice (مرئي) يفتح .select2-drop فيه input للبحث ثم .select2-results li.
   * (صُحِّح 2026-06-24: الإصدار السابق نقر input.select2-focusser المخفي فانتهى بـ timeout)
   */
  async filterBySupplier(value: string): Promise<Response> {
    // افتح القائمة بالنقر على الحاوية المرئية (قد تتعدّد select2 — نأخذ التي نصّها Supplier إن أمكن).
    const trigger = this.page.locator('a.select2-choice').filter({ hasText: /Supplier/i }).first();
    await trigger.click().catch(async () => {
      await this.supplierFilter.click();
    });
    // إصلاح 2026-06-25: التُقط حقل بحث القائمة بـ visible فقط (الصفحة فيها عدة select2 مخفية،
    // والإصدار السابق التقط حقلاً غير نشط ففشل الـ fill بـ timeout). ننتظر ظهوره ثم نُطلق keyup
    // ليُصفّي select2 النتائج.
    const searchInput = this.page.locator('input.select2-input').filter({ visible: true }).first();
    await searchInput.waitFor({ state: 'visible', timeout: 8000 });
    await searchInput.fill(value);
    await searchInput.dispatchEvent('keyup');
    // انتظر ظهور نتيجة قابلة للاختيار (وليست "Searching..." أو "No matches").
    const firstResult = this.page.locator('.select2-results li.select2-result').filter({ visible: true }).first();
    await firstResult.waitFor({ state: 'visible', timeout: 8000 });
    return this.waitForTable(async () => {
      await firstResult.click();
    });
  }

  // ---------------------------------------------------------------------------
  // الفرز
  // ---------------------------------------------------------------------------

  /**
   * الفرز عبر قائمة الفرز المخفية. ملاحظة 2026-06-24: نقر رأس العمود لا يُطلق طلب AJAX؛
   * الفرز يتم عبر <select class="smart-table-sort"> أصلي مخفي (id ديناميكي smart-tableN-sort).
   * نضبط القيمة على اسم العمود ونُطلق change.
   */
  async sortBy(columnName: string, direction: 'asc' | 'desc' = 'asc'): Promise<Response> {
    const dirBtn = this.page.locator(`a[title="${direction}"]`).first();
    // الخطوتان داخل waitForTable معاً: تغيير الـ select قد يُطلق طلبه الخاص ثم زر الاتجاه يُطلق
    // طلب الفرز الفعلي؛ waitForRedraw ينتظر انتهاء كل الطلبات الجارية واستقرار الجدول
    // (إصلاح تذبذب 2026-09-17 — كانت القراءة تسبق إعادة رسم الطلب الثاني).
    return this.waitForTable(async () => {
      // 1) اضبط عمود الفرز في الـ select المخفي.
      const ok = await this.page.evaluate((col) => {
        const s = document.querySelector('select.smart-table-sort') as HTMLSelectElement | null;
        if (!s) return false;
        const opt = Array.from(s.options).find((o) => (o.text || '').trim() === col);
        if (!opt) return false;
        s.value = opt.value;
        s.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }, columnName);
      if (!ok) throw new Error(`لم يُعثر على عمود الفرز "${columnName}" في select.smart-table-sort`);
      // 2) انقر زر الاتجاه (a[title="asc"|"desc"]) — هو ما يُطلق طلب الفرز الفعلي.
      await dirBtn.click();
    });
  }

  // ---------------------------------------------------------------------------
  // الترقيم
  // ---------------------------------------------------------------------------

  /** الانتقال للصفحة التالية في الترقيم. */
  async goToNextPage(): Promise<Response> {
    // الترقيم: <ul class="pagination"><li class="next"><a href="#">Next &gt;</a> — روابط لا أزرار (مؤكَّد 2026-09-17).
    const next = this.page.locator('.dataTables_paginate li.next a').first();
    return this.waitForTable(async () => {
      await next.click();
    });
  }

  /** الانتقال للصفحة السابقة. */
  async goToPreviousPage(): Promise<Response> {
    const prev = this.page.locator('.dataTables_paginate li.prev a').first();
    return this.waitForTable(async () => {
      await prev.click();
    });
  }

  /**
   * تغيير عدد الصفوف المعروضة (page size).
   * ملاحظة 2026-06-24: select.smart-table-length أصلي مخفي بلا name — نقوده مباشرةً.
   */
  async setPageSize(size: string): Promise<Response> {
    return this.waitForTable(async () => {
      const ok = await this.page.evaluate((sz) => {
        const s = document.querySelector('select.smart-table-length') as HTMLSelectElement | null;
        if (!s) return false;
        const opt = Array.from(s.options).find((o) => (o.text || '').trim() === String(sz));
        if (!opt) return false;
        s.value = opt.value;
        s.dispatchEvent(new Event('change', { bubbles: true }));
        return true;
      }, size);
      if (!ok) throw new Error(`لم يُعثر على خيار حجم الصفحة "${size}"`);
    });
  }

  // ---------------------------------------------------------------------------
  // الصفوف والخلايا
  // ---------------------------------------------------------------------------

  /**
   * عدد صفوف البيانات الحالية.
   * مُصلَح بالهيلر 2026-06-23: DataTables يُظهر صف "No data available" عند غياب النتائج؛
   * هذا الصف يحوي td واحدة بنص "No data". نستثني صفوف الـ "no data" بالتحقق من عدد الخلايا.
   * الجدول المؤكَّد: 11 خلية (0=checkbox, 1=ID, ..., 10=Actions). صف "no data" خلية واحدة.
   */
  async getRowCount(): Promise<number> {
    // استثني صفوف الـ "no data" التي تحوي خلية واحدة فارغة (colspan كامل).
    const allRows = this.dataRows;
    const total = await allRows.count();
    if (total === 0) return 0;
    // تحقق: إن كان الصف الأول يحوي خلية واحدة فقط → "no data row"
    const firstRowCellCount = await allRows.first().locator('td').count();
    if (total === 1 && firstRowCellCount <= 2) return 0;
    return total;
  }

  /** الصف الذي يحوي نصًّا مميّزًا (مثل ID أو اسم صنف). */
  rowContaining(text: string): Locator {
    return this.dataRows.filter({ hasText: text }).first();
  }

  /**
   * قراءة نص خلية بحسب فهرس العمود (0-based يشمل عمود الـ checkbox).
   * تحذير: الفهارس تتغيّر بين إصدارات التطبيق/إعدادات الأعمدة (v1.1.3 أضافت أعمدة كثيرة).
   * الثابت الوحيد المؤكَّد: 0=checkbox، 1=ID. لبقية الأعمدة استخدمي getCellByName.
   */
  async getCellText(row: Locator, columnIndex: number): Promise<string> {
    const cell = row.locator('td').nth(columnIndex);
    return ((await cell.textContent()) ?? '').trim();
  }

  /** خريطة اسم العمود → فهرسه، تُشتقّ من رأس الجدول مرة واحدة لكل كائن صفحة (كاش). */
  private columnIndexCache: Map<string, number> | null = null;

  /**
   * أسماء أعمدة رأس الجدول بترتيبها الفعلي (0 = عمود الاختيار "(checkbox)").
   * مصدر الاسم بالأولوية: data-th_title على <th> (مؤكَّد 2026-09-15 لكل الأعمدة) ← placeholder
   * حقل الفلتر ← الخيار الأول في <select> المخفي (اسم العمود) ← نص الرأس.
   * لا نعتمد على textContent وحده لأن أعمدة Select2 (Currency, Brand...) تُلحق كل خياراتها به.
   */
  async getColumnNames(): Promise<string[]> {
    return this.page.evaluate(() => {
      const head = document.querySelector('div.dataTables_scrollHead table thead tr');
      if (!head) return [];
      return Array.from(head.children).map((th) => {
        const title = th.getAttribute('data-th_title')?.trim();
        if (title) return title;
        const ph = th.querySelector('input[placeholder]')?.getAttribute('placeholder')?.trim();
        if (ph) return ph;
        const opt = th.querySelector('select option')?.textContent?.trim();
        if (opt) return opt;
        const txt = (th.textContent || '').replace(/\s+/g, ' ').trim();
        return txt || '(checkbox)';
      });
    });
  }

  /**
   * مقارنة أعمدة الجدول الفعلية بالقائمة المتوقَّعة (test-data → expectedColumns).
   * عند أي اختلاف (عمود ناقص/زائد/ترتيب مختلف) **لا يُفشِل** الاختبار، بل يعرض كل الأعمدة
   * الفعلية مرقّمة في: (1) مخرجات الطرفية، (2) annotation في تقرير HTML، (3) مرفق JSON —
   * ثم يترك الحالة تُكمل تنفيذها (طلب 2026-09-15). يُرجِع تفاصيل الفرق للاستخدام الاختياري.
   */
  async reportColumnDiff(expected: readonly string[], testInfo?: TestInfo) {
    const actual = await this.getColumnNames();
    const missing = expected.filter((c) => !actual.includes(c));
    const extra = actual.filter((c) => !expected.includes(c));
    const sameSet = missing.length === 0 && extra.length === 0;
    const orderChanged = sameSet && actual.some((c, i) => c !== expected[i]);
    const differs = !sameSet || orderChanged;

    if (differs) {
      const numbered = actual.map((c, i) => `${i}: ${c}`).join('\n');
      const summary =
        `اختلاف في أعمدة جدول الأصناف — ` +
        `ناقصة: [${missing.join(', ') || '—'}] | زائدة: [${extra.join(', ') || '—'}]` +
        (orderChanged ? ' | الترتيب مختلف' : '') +
        ` | الفعلي ${actual.length} عمود / المتوقَّع ${expected.length}`;
      // 1) الطرفية
      console.log(`\n⚠ ${summary}\nكل الأعمدة الفعلية (بالترتيب):\n${numbered}\n`);
      // 2) + 3) تقرير HTML
      if (testInfo) {
        testInfo.annotations.push({ type: 'columns-diff', description: summary });
        testInfo.annotations.push({ type: 'columns-actual', description: actual.join(' | ') });
        await testInfo.attach('columns-actual.json', {
          body: JSON.stringify({ summary, actual, expected, missing, extra, orderChanged }, null, 2),
          contentType: 'application/json',
        });
      }
    }
    return { differs, actual, missing, extra, orderChanged };
  }

  /**
   * فهرس عمود بالاسم كما يظهر في رأس الجدول (انظر getColumnNames).
   * أُضيف 2026-09-14 بعد أن كسرت ترقية v1.1.3 الفهارس الثابتة (كان الفهرس 7 = Price فصار Currency).
   */
  async columnIndex(name: string): Promise<number> {
    if (!this.columnIndexCache) {
      const names = await this.getColumnNames();
      const entries: [string, number][] = [];
      names.forEach((label, i) => {
        if (!entries.some(([k]) => k === label)) entries.push([label, i]);
      });
      this.columnIndexCache = new Map(entries);
    }
    const idx = this.columnIndexCache.get(name);
    if (idx === undefined) {
      throw new Error(
        `العمود "${name}" غير موجود في رأس الجدول. الأعمدة المتاحة: ` +
          Array.from(this.columnIndexCache.keys()).join(' | '),
      );
    }
    return idx;
  }

  /** قراءة نص خلية بحسب اسم العمود (انظر columnIndex). */
  async getCellByName(row: Locator, columnName: string): Promise<string> {
    return this.getCellText(row, await this.columnIndex(columnName));
  }

  /** قراءة قيم الأعمدة المعروفة في صف معطى — بالاسم لا بالفهرس. */
  async getRowValues(row: Locator) {
    return {
      id: await this.getCellByName(row, 'ID'),
      barcode: await this.getCellByName(row, 'Barcode'),
      name: await this.getCellByName(row, 'Name'),
      currency: await this.getCellByName(row, 'Currency'),
      productType: await this.getCellByName(row, 'Product Type'),
      cost: await this.getCellByName(row, 'Cost'),
      price: await this.getCellByName(row, 'Price'),
      quantity: await this.getCellByName(row, 'Quantity'),
      unit: await this.getCellByName(row, 'Unit'),
    };
  }

  /** قراءة قيمة العدّاد "Number" كرقم. */
  async getResultsCount(): Promise<number> {
    const txt = ((await this.resultsCounter.textContent()) ?? '').replace(/[^\d-]/g, '');
    return Number(txt);
  }

  // ---------------------------------------------------------------------------
  // إجراءات الصف (قائمة منسدلة)
  // ---------------------------------------------------------------------------

  /**
   * فتح قائمة إجراءات صف معيّن. زر الإجراءات أيقوني (بلا اسم) في آخر خلية —
   * نلتقطه ببنية الصف: آخر <td> ثم أول زر.
   */
  async openRowActions(row: Locator): Promise<void> {
    const btn = row.locator('td').last().locator('button').first();
    await btn.click();
    this.lastOpenedRow = row;
    // انتظر ظهور قائمة الصف نفسها (لا أي رابط مطابق في الصفحة).
    await this.rowActionMenu(row).waitFor({ state: 'visible', timeout: 10000 });
  }

  /** آخر صف فُتحت قائمته (يُستخدم لتحديد نطاق روابط الإجراءات). */
  private lastOpenedRow: Locator | null = null;

  /** قائمة إجراءات الصف: <ul class="dropdown-menu"> داخل آخر خلية في الصف (مؤكَّد 2026-09-17). */
  rowActionMenu(row: Locator): Locator {
    return row.locator('td').last().locator('ul.dropdown-menu').first();
  }

  /**
   * رابط إجراء داخل قائمة الصف المفتوحة (نص ظاهر مستقر).
   * إصلاح 2026-09-17: كان المُحدِّد عامّاً على الصفحة (getByRole link بالاسم) فالتقط أحياناً رابطاً
   * آخر يحمل النص نفسه (href="#details") ونقله بدل صفحة العرض — رُصد في TC-F-01. الآن يُحصَر
   * في قائمة الصف الذي فُتح آخراً (كل صف يملك قائمته الخاصة بنفس النصوص).
   */
  rowActionLink(name: string): Locator {
    const scope = this.lastOpenedRow ? this.rowActionMenu(this.lastOpenedRow) : this.page.locator('ul.dropdown-menu');
    // عناصر القائمة روابط؛ النص يبدأ بأيقونة فنطابق جزئياً (hasText).
    return scope.locator('a').filter({ hasText: name }).filter({ visible: true }).first();
  }

  /**
   * نقر عنصر في قائمة إجراءات الصف المفتوحة.
   * ملاحظة 2026-09-17: القائمة داخل جسم جدول يتمرّج أفقياً (scrollBody)؛ محاولة Playwright تمرير
   * العنصر إلى العرض تُحرّكه باستمرار فيبقى "غير مستقر" (element is not stable) حتى المهلة —
   * رُصد بشكل متقطّع في TC-F-01/F-03. نحاول نقراً حقيقياً قصيراً، وعند الفشل نُفعّل الرابط
   * برمجياً (HTMLElement.click) وهو يُطلق التنقّل/المعالج نفسه دون تمرير أو فحوص استقرار.
   * إن اختفى العنصر (الصفحة انتقلت فعلاً بعد النقر الأول) نعتبر النقر ناجحاً.
   */
  async clickRowAction(name: string): Promise<void> {
    const link = this.rowActionLink(name);
    await link.waitFor({ state: 'visible', timeout: 10000 });
    try {
      await link.click({ timeout: 4000 }); // حركة zoomIn للقائمة ~0.5s؛ أكثر من ذلك = عدم استقرار دائم
    } catch (e) {
      const msg = String((e as Error).message).split(/\r?\n/).slice(0, 8).join(' | ');
      console.log(`clickRowAction("${name}") — فشل النقر العادي، سيُفعَّل برمجياً: ${msg}`);
      const stillThere = await this.rowActionLink(name).count().catch(() => 0);
      if (stillThere === 0) return; // الصفحة انتقلت/القائمة أُغلقت بعد النقر الأول
      await this.rowActionLink(name)
        .evaluate((el) => (el as HTMLElement).click())
        .catch((err) => {
          // تدمير سياق التنفيذ = بدأ التنقّل فعلاً.
          if (!/context was destroyed|navigat/i.test(String(err))) throw err;
        });
    }
  }

  /** فتح "Product Details" لصف وانتظار التنقّل. */
  async openProductDetails(row: Locator): Promise<void> {
    await this.openRowActions(row);
    await this.clickRowAction('Product Details');
  }

  /** فتح "Edit Product" لصف. */
  async openEditProduct(row: Locator): Promise<void> {
    await this.openRowActions(row);
    await this.clickRowAction('Edit Product');
  }

  /** فتح "Duplicate Product" لصف. */
  async openDuplicateProduct(row: Locator): Promise<void> {
    await this.openRowActions(row);
    await this.clickRowAction('Duplicate Product');
  }

  /** فتح "Print Barcode/Label" لصف. */
  async openPrintBarcode(row: Locator): Promise<void> {
    await this.openRowActions(row);
    await this.clickRowAction('Print Barcode/Label');
  }

  /** عدّ عناصر قائمة إجراءات الصف المفتوحة (لاختبار RBAC owner). */
  async countRowActionItems(): Promise<number> {
    const scope = this.lastOpenedRow ? this.rowActionMenu(this.lastOpenedRow) : this.page;
    const menuLinks = scope
      .getByRole('link', { name: /Product Details|Edit Product|Duplicate Product|View Image|Print Barcode|Delete Product/i })
      .filter({ visible: true });
    return menuLinks.count();
  }

  // ---------------------------------------------------------------------------
  // الحذف (Bootstrap popover — وليس SweetAlert)
  // ---------------------------------------------------------------------------
  // ملاحظة 2026-06-24 (تأكيد حيّ): "Delete Product" رابط rel="popover" يفتح popover
  // محتواه: <a class="po-delete" href="/products/delete/{id}">Yes I'm sure</a> + <button class="po-close">No</button>.
  // تأكيد الحذف = رابط (تنقّل كامل إلى /products/delete/{id}) لا طلب AJAX على الجدول.

  /** الضغط على "Delete Product" في قائمة الصف المفتوحة (يفتح popover التأكيد). */
  async clickDeleteInMenu(): Promise<void> {
    await this.clickRowAction('Delete Product');
  }

  /** رابط تأكيد الحذف داخل الـ popover ("Yes I'm sure"). */
  get deleteConfirmLink(): Locator {
    return this.page.locator('a.po-delete').filter({ visible: true }).first();
  }

  /** زر إلغاء الحذف داخل الـ popover ("No"). */
  get sweetAlertCancel(): Locator {
    return this.page
      .locator('button.po-close')
      .or(this.page.getByRole('button', { name: /^No$|Cancel|إلغاء/i }))
      .filter({ visible: true })
      .first();
  }

  /**
   * حذف صنف عبر الواجهة: يفتح القائمة، يضغط Delete، يؤكّد في الـ popover ("Yes I'm sure")
   * فيحدث تنقّل كامل، ثم يعود لقائمة الأصناف. تحذير: استعمِله فقط لأصناف QA_AUTO_*.
   */
  async deleteProduct(row: Locator): Promise<void> {
    await this.openRowActions(row);
    await this.clickDeleteInMenu();
    const confirm = this.deleteConfirmLink;
    await expect(confirm).toBeVisible({ timeout: 5000 });
    await Promise.all([
      this.page.waitForNavigation({ timeout: 20000 }).catch(() => {}),
      confirm.click(),
    ]);
    // العودة للقائمة (الحذف يحوّل إلى /products أو /welcome).
    await this.goto();
  }

  // ---------------------------------------------------------------------------
  // إضافة صنف (نموذج /products/add)
  // ---------------------------------------------------------------------------
  // ملاحظة 2026-06-24 (تأكيد حيّ بإنشاء صنف 248 ثم حذفه): الحقول الإلزامية الدنيا
  // input[name="name"], input[name="code"] (الباركود), input[name="cost"]. النوع يفترض
  // Standard. زر الحفظ button.submit ("Save") → تحويل إلى /products بعد النجاح.

  /** الضغط على رابط "Add Product" في شريط الأدوات. */
  async clickAddProduct(): Promise<void> {
    // ملاحظة 2026-09-17: صفحة /products/add ثقيلة (>15s أحياناً) — النقر الافتراضي ينتظر بدء
    // التنقّل ضمن actionTimeout (15s) فيفشل بـ timeout. لا ننتظر بعد النقر، ونترك التحقق من
    // العنوان للاختبار بمهلة التنقّل الأطول.
    await this.addProductLink.click({ noWaitAfter: true });
  }

  /**
   * إنشاء صنف بالحد الأدنى من الحقول الإلزامية ثم الحفظ والانتظار حتى التحويل لقائمة الأصناف.
   * يُعيد البيانات المُدخَلة لتسهيل البحث عنه/تنظيفه لاحقًا.
   */
  async addProduct(data: { name: string; barcode: string; cost: string }): Promise<typeof data> {
    await this.page.goto('/products/add', { waitUntil: 'domcontentloaded' });
    await this.dismissBlockingModal();
    await this.page.locator('input[name="name"]').fill(data.name);
    await this.page.locator('input[name="code"]').fill(data.barcode);
    await this.page.locator('input[name="cost"]').fill(data.cost);
    await this.dismissBlockingModal();
    // زر الحفظ يُعرَض كـ button باسم "Save" (قد يكون input[type=submit] نصّه في value،
    // فلا يطابقه hasText — نستخدم getByRole الذي يقرأ الاسم من value/aria).
    const saveBtn = this.page.getByRole('button', { name: 'Save', exact: true }).first();
    await Promise.all([
      this.page.waitForNavigation({ url: /\/products(\/index)?(\?.*)?$/, timeout: 20000 }).catch(() => {}),
      saveBtn.click(),
    ]);
    return data;
  }

  /**
   * يفتح قائمة الأصناف ويفلتر بالباركود مع إعادة محاولة — يعالج هشاشة التوقيت حيث قد لا يظهر
   * الصنف المُنشأ حديثًا في أول بحث (تأخّر فهرسة/إعادة رسم على الخادم). يُعيد عدد الصفوف.
   */
  async openListAndFindByBarcode(barcode: string, tries = 4): Promise<number> {
    for (let i = 0; i < tries; i++) {
      await this.goto();
      await this.filterByText('Barcode', barcode);
      const n = await this.getRowCount();
      if (n > 0) return n;
      await this.page.waitForTimeout(1500); // انتظار حالة خارجية (فهرسة الخادم) — لا حدث محدّد
    }
    return 0;
  }

  /**
   * إغلاق نافذة "Ajax error occurred" (bootbox) العابرة التي تظهر أحيانًا على نموذج الإضافة
   * وتعترض النقرات (intercepts pointer events). تُتجاهَل إن لم تظهر.
   */
  private async dismissBlockingModal(): Promise<void> {
    const ok = this.page
      .locator('.bootbox.in button, .modal.in button')
      .filter({ hasText: /^\s*OK\s*$/i })
      .first();
    if (await ok.isVisible({ timeout: 2000 }).catch(() => false)) {
      await ok.click().catch(() => {});
      await ok.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
    }
  }
}
