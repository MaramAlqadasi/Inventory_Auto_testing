/**
 * بيانات اختبار صفحة قائمة الأصناف /products/index
 * المصدر: القسم 5 من خطة الاختبار (product-list.test-plan.md)
 * مؤكَّدة باستكشاف حيّ 2026-06-22 (المستأجر test_faten).
 */

/** أصناف حقيقية موجودة في قاعدة بيانات المستأجر — تُستعمَل للقراءة فقط (لا تُحذَف). */
export const knownProducts = {
  /**
   * صنف بكمية سالبة وباركود بصفر بادئ (id=237).
   * الكمية قيمة حيّة تتغيّر مع حركات المخزون (-3.000 يونيو 2026 → -7.0000 سبتمبر 2026)،
   * والصيغة صارت 4 منازل في v1.1.3 — الاختبارات تتحقق من «سالبة» لا من القيمة الحرفية.
   */
  negativeQty: {
    id: '237',
    barcode: '07535934',
    name: 'سماح صفري',
    quantity: '-7.0000',
    productType: 'Standard',
  },
  /** صنف Standard بكمية موجبة (id=235). */
  standardPositive: {
    id: '235',
    barcode: '60701922',
    name: 'معياري كمية',
    quantity: '699.000',
    productType: 'Standard',
  },
  /** صنف Combo (id=236) — لاختبار فلتر Product Type=Combo. */
  combo: {
    id: '236',
    barcode: '81857841',
    name: 'تجميعي كمية',
    productType: 'Combo',
  },
} as const;

/** بيانات صالحة. */
export const validData = {
  /** يولّد اسم صنف فريد آمن للإنشاء/الحذف. */
  newProductName: () => `QA_AUTO_${Date.now()}`,
  /** يولّد باركودًا رقميًا فريدًا (آخر 9 أرقام من الطابع الزمني) للإنشاء الآمن. */
  newBarcode: () => String(Date.now()).slice(-9),
  barcodeLeadingZero: '07535934',
  validPrice: '100.000',
  positiveQty: '6,310.0000',
  arabicName: 'صنف تجريبي',
  defaultUnit: 'حبة',
  /** v1.1.3: رمز العملة لم يعد يُدمَج مع السعر؛ العملة تُعرَض في عمود Currency مستقل. */
  currencyCode: 'SAR',
};

/** بيانات حدّية. */
export const edgeData = {
  negativeQty: '-3.000',
  longName: 'a'.repeat(256),
  zeroPrice: '0.0000',
  negativePrice: '-100.0000',
  mixedUnicodeName: 'Ñoño_صنف_ñ',
};

/** بيانات سلبية (سيناريوهات الاختراق). */
export const negativeData = {
  sqlInjection: `'; DROP TABLE products; --`,
  xss: `<script>alert('xss')</script>`,
  likeWildcardPercent: '%',
  likeWildcardUnderscore: '_',
  emptyFilter: '',
  arabicDigits: '١٢٣٤٥',
  noMatch: 'ZZZNOMATCH_999',
};

/** قيم الفلاتر المنسدلة المؤكَّدة من الاستكشاف الحيّ. */
export const filterOptions = {
  productType: {
    standard: 'Standard',
    combo: 'Combo',
    digital: 'Digital',
    service: 'Service',
    industrial: 'Industrial',
  },
  currency: {
    SAR: 'SAR',
    USD: 'USD',
  },
  taxMethod: {
    inclusive: 'Inclusive',
    exclusive: 'Exclusive',
  },
  showAtPos: {
    yes: 'Yes',
    no: 'No',
  },
  warehouses: {
    all: 'All Warehouses',
    branchAmro: 'فرع عمرو',
    branchRafha: 'فرع رفحاء',
    branchJeddah: 'جدة',
  },
} as const;

/**
 * أنماط ضوضاء الـ console من أطراف ثالثة (إعلانات/تحليلات/دردشة) — تُستبعَد عند
 * التحقق من أخطاء الصفحة. مؤكَّدة من سجل console 2026-06-22.
 */
export const ignoredConsolePatterns: RegExp[] = [
  /ERR_BLOCKED_BY_CLIENT/i,
  /Pusher is not defined/i,
  /googletagmanager/i,
  /contentsquare/i,
  /mbirdcdn|messagebird/i,
  /pusher\.com/i,
  /Failed to load resource/i,
  /Slow network is detected/i,
];

/**
 * الأعمدة المتوقَّعة في رأس جدول الأصناف بترتيبها (الحساب test_app/admin، v1.1.3، 2026-09-15).
 * الاسم = data-th_title لكل <th>؛ عمود الاختيار (checkbox) بلا عنوان فيُسمّى "(checkbox)".
 * عند أي اختلاف (نقص/زيادة/ترتيب) تعرض الاختبارات كل الأعمدة الفعلية في التقرير ثم تُكمل التنفيذ —
 * انظر ProductsPage.reportColumnDiff.
 */
export const expectedColumns = [
  '(checkbox)',
  'ID',
  'Image',
  'Barcode',
  'Symbol',
  'Name',
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
  'Unit',
  'Tax',
  'Excise Tax',
  'Tax Method',
  'Expiry',
  'Alert Quantity',
  'Status',
  'Actions',
] as const;
