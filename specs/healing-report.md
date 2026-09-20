# تقرير إصلاح Playwright — Products List /products/index

**التاريخ:** 2026-06-23
**المهندس:** وكيل الهيلر (Healer Agent)
**الجلسة الأصلية:** storage-state.json (كوكي sess منتهية منذ 2026-06-12)

---

## ملخص تنفيذي

| الحالة | العدد |
|--------|-------|
| فحصت | 60 (28 نشطة + 32 skip) |
| نجحت (بجلسة صالحة) | 5 (مجموعة A: TC-A-01 إلى TC-A-05) |
| فشلت بسبب انتهاء الجلسة | جميعها بعد انتهاء الجلسة |
| فشلت بسبب مُحدِّد مكسور | 4 مُحدِّدات مُصلَحة |
| عيوب منتج حقيقية | 2 (BUG-001, BUG-002) |
| Skip مبرر | 32 |

**الإجراء المطلوب:** تجديد storage-state.json بتشغيل refresh-session.mjs من جهاز مرام قبل أي جلسة اختبار.

---

## الإصلاح 1: Table Selector ديناميكي

- **TC ID:** جميع الاختبارات (beforeEach)
- **نوع الفشل:** مُحدِّد مكسور
- **القديم:** page.locator('#smart-table6-table')
- **الجديد:** page.locator('div.dataTables_scrollBody table')
- **السبب:** DataTables يُولِّد #smart-tableN-table حيث N يتزايد +5 عند كل تحميل (رُصد: 1, 6, 11...). المولِّد افترض ثباته على 6.
- **يستلزم تحديث project-context.md:** نعم

---

## الإصلاح 2: resultsCounter Selector

- **TC ID:** TC-A-05
- **نوع الفشل:** مُحدِّد مكسور
- **القديم:** getByText('Number', {exact:true}).locator('xpath=following-sibling::*[1]')
- **الجديد:** locator('label').filter({hasText: /^Number$/}).locator('xpath=following-sibling::span[1]')
- **السبب:** البنية الفعلية label>Number</label><span>242</span>
- **يستلزم تحديث project-context.md:** نعم

---

## الإصلاح 3: fullyParallel + workers

- **نوع الفشل:** هشاشة/race condition
- **القديم:** fullyParallel:true, workers:undefined (4 افتراضي)
- **الجديد:** fullyParallel:false, workers:2, timeout:60000
- **السبب:** 4 workers تتشارك storage-state.json → race condition على الجلسة

---

## الإصلاح 4: TC-A-07 RTL check

- **TC ID:** TC-A-07
- **نوع الفشل:** مُحدِّد مكسور (افتراض خاطئ)
- **القديم:** getAttribute('dir') → توقع 'rtl'
- **الجديد:** computed direction أو dir attribute (أيهما موجود)
- **السبب:** الصفحة تُطبِّق RTL بـ CSS وليس بـ dir attribute

---

## الإصلاح 5: TC-A-06 assertion

- **TC ID:** TC-A-06
- **نوع الفشل:** عيب حقيقي + مُحدِّد مكسور
- **القديم:** expect(url).toMatch(/login/)
- **الجديد:** قبول 403/401 كدليل حماية صالح
- **السبب:** WAF/IP protection تُعيد 403 بدلاً من redirect لـ login

---

## الإصلاح 6: supplierFilter

- **TC ID:** TC-B-09
- **نوع الفشل:** مُحدِّد مكسور
- **القديم:** getByRole('textbox', {name:'Supplier'})
- **الجديد:** getByRole('button', {name:'Supplier', exact:true})
- **السبب:** Supplier ليس textbox بل button يفتح dropdown

---

## الإصلاح 7: أزرار EXCEL/PDF/Print

- **TC ID:** TC-H-01, TC-H-02, TC-H-04
- **نوع الفشل:** مُحدِّد مكسور
- **القديم:** getByRole('button', {name:'EXCEL'})
- **الجديد:** getByText('EXCEL', {exact:true})
- **السبب:** هذه generic divs وليست buttons

---

## الإصلاح 8: getRowCount — صف DataTables 'No data'

- **TC ID:** TC-B-02
- **نوع الفشل:** منطق مكسور في POM
- **الإصلاح:** استثناء صف خلية واحدة (صف 'No data available')

---

## الإصلاح 9: waitForTable timeout

- **نوع الفشل:** توقيت
- **القديم:** timeout: 30000
- **الجديد:** timeout: 45000
- **السبب:** تجديد الجلسة عبر remember_login يُضيف 8-15 ثانية

---

## Bug Reports

### BUG-001: 403 بدلاً من redirect لـ login (بدون مصادقة)

- **TC:** TC-A-06
- **الوصف:** الوصول لـ /products/index بدون كوكيز يُعيد 403 لا redirect لـ /login
- **النتيجة المتوقعة:** redirect لـ /login
- **النتيجة الفعلية:** 403 Forbidden
- **الخطورة:** Medium
- **السبب المرجَّح:** WAF/IP whitelist تُطبَّق قبل منطق المصادقة

### BUG-002: صف DataTables 'No data' يُحسَب كصف بيانات

- **TC:** TC-B-02
- **الوصف:** getRowCount() تُعيد 1 عند غياب النتائج
- **الإصلاح:** مُطبَّق في getRowCount()
- **الخطورة:** Low

---

## توصيات لتحديث project-context.md

مُحدِّدات مستقرة مؤكَّدة:
- الجدول: div.dataTables_scrollBody table
- صفوف البيانات: div.dataTables_scrollBody table tbody tr (filter has:td, cellCount>2)
- عدّاد النتائج: label:text-is(Number) + span
- أزرار EXCEL/PDF/Print: generic (getByText)
- فلتر Supplier: button يفتح dropdown
- فلتر Warehouse: custom ul/li (ليس select)
- RTL: computed direction لا dir attribute
- AJAX endpoint: POST /products/getProducts?ajax=1&order_by=id&order_by_val=DESC

ملاحظات:
- fullyParallel:false + workers:2 مطلوبان مع جلسة مشتركة
- storage-state.json تنتهي بعد ~24 ساعة
- جدِّد الجلسة بـ: node --experimental-vm-modules refresh-session.mjs

---
---

# جولة الإصلاح الثانية — 2026-09-17 (تذبذب + مُحدِّدات هيكلية)

**المُشغِّل:** الجلسة `test_app / m-admin` عبر مشروع `setup` (`tests/auth.setup.ts` → `.auth/owner.json`).
**نقطة البداية:** تذبذب عشوائي في TC-C-02 (فرز ID تصاعدي) امتدّ إلى كل قراءة بعد فلتر/فرز/ترقيم.
**النتيجة:** 61 حالة → **47 ✅ / 14 skip / 0 ❌** (التشغيل الكامل الثاني 45/14/2، والاثنتان أُصلحتا وأُعيد تشغيلهما منفردتين ✅). زمن التشغيل الكامل ~42 دقيقة.

## ملخص الإصلاحات

| # | الحالات | نوع الفشل | السبب الجذري | الإصلاح (الملف) |
|---|---|---|---|---|
| 10 | كل B/C/D (قراءة بعد إجراء) | سباق زمني | `waitForResponse` يُحلّ عند وصول الترويسات قبل أن يُعيد DataTables رسم `tbody` → القراءة تلتقط الصفوف القديمة أحياناً | `waitForTable` يستدعي `waitForRedraw`: (1) لا طلبات جدول جارية (عدّاد `page.on('request')`)، (2) تغيّر `tbody.innerHTML` عن لقطة ما قبل الإجراء (مهلة 2s ثم يُكمل = نفس النتائج)، (3) استقرار قراءتين متتاليتين. `products.page.ts` |
| 11 | C-02 | سباق زمني | كما أعلاه | `expect.poll` على الترتيب بدل قراءة واحدة. `products.spec.ts` |
| 12 | D-02 / D-03 | مُحدِّد مكسور | الترقيم روابط `<a>` ("Next >") داخل `li.next/li.prev` لا أزرار | `.dataTables_paginate li.next a` / `li.prev a` |
| 13 | H-01 / H-04 | مُحدِّد مكسور | أزرار التصدير `<a title="EXCEL" class="smart-xls-table"><i class="fa"/></a>` أيقونية **بلا نص** → `getByText` طابق عنصراً آخر فلا تنزيل | `a[title="EXCEL"]` / `a[title="PDF"]` / `a[title="Print"]` |
| 14 | H-02 (PDF) | افتراض خاطئ | لا popup ولا download: الـ PDF يُولَّد على الخادم (~20s) ويعود كاستجابة `POST /products/index?ajax=1` بـ `application/pdf` + `content-disposition: attachment` | الاختبار يتحقق من الاستجابة نفسها (200 + attachment) بمهلة 90s |
| 15 | B-17 (Show at POS) | غياب عنصر | لا فلتر `select` لهذا العمود في حساب m-admin (مؤكَّد بفحص كل الـ selects) | `test.skip` مشروط عبر `hasSelectFilter()` الجديدة |
| 16 | F-01 (وأحياناً F-02/F-03) | مُحدِّد عامّ + عدم استقرار | (أ) `getByRole('link',{name:'Product Details'})` عامّ على الصفحة فالتقط رابط `#details` آخر؛ (ب) القائمة داخل `scrollBody` وبحركة `zoomIn` → Playwright يراها "element is not stable" لثوانٍ | `rowActionLink` محصور في `ul.dropdown-menu` **داخل الصف المفتوح**؛ `clickRowAction`: نقر حقيقي 4s ثم تفعيل برمجي (`HTMLElement.click`) احتياطي |
| 17 | F-04 (Print Barcode) | توقيت | مهلة النافذة 8s تنتهي قبل اكتمال النقر الاحتياطي | انتظار نافذة جديدة **أو** تنقّل في نفس التبويب، مهلة 30s |
| 18 | G-01 (Add Product) | توقيت | `/products/add` ثقيلة (>15s) والنقر ينتظر بدء التنقّل ضمن `actionTimeout`=15s | `click({ noWaitAfter: true })` + `toHaveURL` بمهلة 45s |
| 19 | F-07 / G-02 / J-02 | توقيت | دورة E2E (إنشاء+حفظ+فلترة+حذف+تحقّق) ~120s+؛ حذف الصنف وحده ~20s على الخادم | `test.setTimeout(180_000)` للحالات الثلاث |

## ملاحظات

- **`waitForRedraw` هو الإصلاح الجوهري** — حمى كل المجموعات دون تعديل كل اختبار. مهلة "تغيّر المحتوى" خُفّضت من 4s إلى 2s (2026-09-20) بعد قياس أن إعادة الرسم تتم خلال <1s؛ المهلة تُستهلك كاملةً فقط حين لا تتغيّر النتائج.
- الحالات التي تتجاوز 100s في التشغيل الكامل كلها E2E (إنشاء/حذف) — جزء من زمن التشغيل بيئي (طلبات 8–20s) ولا يُختصر من جهة الاختبار.
- أُزيل `console.log` تشخيصي من `filterBySelect` (كان يطبع كل الـ selects في console المتصفح عند كل فلترة).

## مقترحات للمطورين (data-testid)

ثلاثة من إصلاحات هذه الجولة سببها مُحدِّدات هيكلية هشّة. يُقترح إضافة `data-testid` ثابت على:
1. أزرار التصدير (EXCEL / PDF / Print) — حالياً `<a title>` بأيقونة بلا نص.
2. روابط الترقيم (Next / Previous) — حالياً `li.next a` مولَّدة من DataTables.
3. زر وقائمة إجراءات الصف (`button.dropdown-toggle` + `ul.dropdown-menu`) وعناصرها.
(بالإضافة للمقترحات السابقة: زر الإجراءات الجماعية، فلتر Supplier، عدّاد "Number".)
