# Product List Testing Plan

## Application Overview

This test plan covers comprehensive testing of the Products List page in the SmartERP inventory management system. The system allows users to view, filter, search, and manage products with detailed information including pricing, quantities, categories, and tax details. Tests cover login, navigation, filtering, searching, sorting, selection, and various product management operations.

## Test Scenarios

### 1. Authentication and Navigation

**Seed:** `tests/seed.spec.ts`

#### 1.1. Successful Login with Valid Credentials

**File:** `tests/auth/login.spec.ts`

**Steps:**
  1. -
    - expect: User navigates to the SmartERP login page
  2. Enter company name 'demo_maramc2' in the Company name field
    - expect: Company name is entered successfully
    - expect: No validation errors are shown
  3. Enter username 'Ahmed' in the Username field
    - expect: Username is entered successfully
  4. Enter password '12345678' in the Password field
    - expect: Password is entered successfully
    - expect: Login button becomes enabled
  5. Click the Login button
    - expect: User is redirected to the dashboard
    - expect: Page title shows 'Products - demo_maramc2' or dashboard page
    - expect: User is successfully authenticated

#### 1.2. Navigate to Products List from Menu

**File:** `tests/auth/navigation.spec.ts`

**Steps:**
  1. -
    - expect: User is logged in and on the dashboard
  2. Click on 'Inventory' menu item in the left sidebar
    - expect: Inventory submenu expands
    - expect: List Products option is visible
  3. Click on 'List Products' option
    - expect: Products list page loads successfully
    - expect: Page title displays 'Products'
    - expect: Products grid is visible

#### 1.3. Login with Invalid Credentials

**File:** `tests/auth/invalid-login.spec.ts`

**Steps:**
  1. -
    - expect: User is on the login page
  2. Enter company name 'invalid_company' in the Company name field
    - expect: Company name is entered
  3. Enter username 'InvalidUser' in the Username field
    - expect: Username is entered
  4. Enter password 'WrongPassword' in the Password field
    - expect: Password is entered
  5. Click the Login button
    - expect: An error message is displayed
    - expect: User remains on the login page
    - expect: Login fails and user cannot access the system

### 2. Products List Display and Layout

**Seed:** `tests/seed.spec.ts`

#### 2.1. Verify Products Grid Structure and Columns

**File:** `tests/products/grid-structure.spec.ts`

**Steps:**
  1. -
    - expect: User is logged in and on the Products list page
  2. Verify the products grid is displayed with data
    - expect: Grid contains checkbox column for row selection
    - expect: Grid contains the following columns: ID, Image, Code, Arabic Name, English Name, Currency, Product Type, Brand, Categories, Sub Categories, Cost, Price, Min Price, Max Price, Quantity, Reserved Quantity, Unit, Tax, Tax Method, Alert Quantity
  3. Verify that product data is populated in the grid
    - expect: At least one product row is visible
    - expect: Each product row contains: ID (e.g., 2719), Code (e.g., 67147313), Product name, Price, Quantity, Unit, Tax information
  4. Verify action menu button exists for each product row
    - expect: Each row contains an action menu button (three dots icon)
    - expect: Menu button is clickable

#### 2.2. Verify Toolbar and Action Buttons

**File:** `tests/products/toolbar.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
  2. Identify and verify all toolbar buttons above the products grid
    - expect: 'Add Product' button is visible and clickable
    - expect: Filter buttons are available
    - expect: Additional action buttons are present in the toolbar
  3. Verify the 'Add Product' button
    - expect: Button is labeled 'Add Product'
    - expect: Button has appropriate icon
    - expect: Button is enabled and clickable

#### 2.3. Verify Header Filters and Search

**File:** `tests/products/header-filters.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
  2. Locate the search/filter area above the products grid
    - expect: 'All Warehouses' dropdown is visible
    - expect: Search textbox is present
    - expect: Filter options are available
  3. Verify warehouse selector displays default value
    - expect: Warehouse selector shows 'All Warehouses' by default
    - expect: Dropdown is clickable

### 3. Products List Filtering

**Seed:** `tests/seed.spec.ts`

#### 3.1. Filter Products by Warehouse

**File:** `tests/products/filter-warehouse.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
    - expect: Products are displayed
  2. Click on the 'All Warehouses' dropdown selector
    - expect: Dropdown opens and shows available warehouses
    - expect: Options are clickable
  3. Select a specific warehouse from the dropdown
    - expect: Selected warehouse is displayed in the selector
    - expect: Products grid updates to show only products from that warehouse

#### 3.2. Search Products by Name

**File:** `tests/products/search-name.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
    - expect: Products list is displayed
  2. Click on the search textbox
    - expect: Search textbox is focused
  3. Enter a product name (e.g., 'shamel1') in the search field
    - expect: Search input is entered
    - expect: Products grid filters to show only matching products
  4. Clear the search field
    - expect: Search field is cleared
    - expect: All products are displayed again

#### 3.3. Filter by Supplier

**File:** `tests/products/filter-supplier.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
  2. Click on the Supplier filter link
    - expect: Supplier filter menu or dropdown appears
    - expect: Available suppliers are listed
  3. Select a supplier
    - expect: Selected supplier is applied as filter
    - expect: Products list updates to show only products from that supplier

#### 3.4. Filter Products Using Column Filters

**File:** `tests/products/column-filters.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
  2. Click on the ID column filter textbox
    - expect: ID filter textbox is active and ready for input
  3. Enter a product ID to filter (e.g., '2719')
    - expect: Products are filtered by the entered ID
    - expect: Only the matching product is displayed
  4. Click on the English Name column filter textbox
    - expect: English Name filter is active
  5. Enter a product name to filter
    - expect: Products are filtered by the entered name

### 4. Products List Sorting

**Seed:** `tests/seed.spec.ts`

#### 4.1. Sort Products by ID

**File:** `tests/products/sort-id.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
    - expect: Products are displayed
  2. Click on the ID column header to sort
    - expect: Products are sorted by ID in ascending order
    - expect: Sort indicator appears on the column
  3. Click on the ID column header again to reverse sort
    - expect: Products are sorted by ID in descending order
    - expect: Sort indicator shows descending direction

#### 4.2. Sort Products by Price

**File:** `tests/products/sort-price.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
  2. Click on the Price column header
    - expect: Products are sorted by Price
    - expect: Sort direction is indicated
  3. Verify sorting order is correct
    - expect: Products are arranged in price order
    - expect: Lower prices appear first (or highest first depending on sort direction)

#### 4.3. Sort Products by Category

**File:** `tests/products/sort-category.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
  2. Click on the Categories column header
    - expect: Products are sorted by Categories
  3. Verify products are grouped/sorted by category
    - expect: Products with the same category appear together
    - expect: Categories are in alphabetical or logical order

### 5. Products List Row Selection

**Seed:** `tests/seed.spec.ts`

#### 5.1. Select Single Product Checkbox

**File:** `tests/products/select-single.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
    - expect: Products are displayed
  2. Click on the checkbox for the first product row
    - expect: Checkbox is checked
    - expect: Row is highlighted/selected
  3. Verify selected row state
    - expect: Selected product row has visual indication (highlighted)
    - expect: Checkbox shows checked state

#### 5.2. Select Multiple Products

**File:** `tests/products/select-multiple.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
  2. Click on checkbox for the first product
    - expect: First product is selected
  3. Hold Shift or Ctrl and click on another product checkbox to select multiple
    - expect: Multiple products are selected
    - expect: All selected checkboxes show checked state

#### 5.3. Select All Products Using Header Checkbox

**File:** `tests/products/select-all.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
  2. Click on the checkbox in the table header
    - expect: All visible products are selected
    - expect: All product row checkboxes are checked
  3. Click on the header checkbox again to deselect all
    - expect: All products are deselected
    - expect: All checkboxes show unchecked state

### 6. Product Row Actions

**Seed:** `tests/seed.spec.ts`

#### 6.1. Open Product Action Menu

**File:** `tests/products/action-menu.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
  2. Click on the action menu button (three dots icon) for a product row
    - expect: Action menu opens
    - expect: Menu options are displayed
  3. Identify available action menu options
    - expect: Menu contains options such as Edit, Delete, View Details, or other product management actions

#### 6.2. Click on Product Row to View Details

**File:** `tests/products/view-details.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
  2. Click on a product row
    - expect: Product details page or modal opens
    - expect: Product information is displayed
  3. Verify product details are correct
    - expect: All product fields are populated: ID, Name, Price, Quantity, Category, etc.
    - expect: Edit and other action buttons are available

#### 6.3. Navigate to Add New Product

**File:** `tests/products/add-product.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
  2. Click on the 'Add Product' button in the toolbar
    - expect: User is navigated to the Add Product form
    - expect: Product form is displayed with empty fields

### 7. Edge Cases and Negative Scenarios

**Seed:** `tests/seed.spec.ts`

#### 7.1. Search for Non-existent Product

**File:** `tests/products/search-empty-result.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
  2. Enter a search term that does not match any product (e.g., 'NonexistentProduct123')
    - expect: No products are displayed
    - expect: Empty state message is shown (if applicable)
    - expect: Grid shows no data or 'No records found' message
  3. Clear the search field
    - expect: All products are displayed again

#### 7.2. Filter by Warehouse with No Products

**File:** `tests/products/filter-empty-warehouse.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
  2. Select a warehouse that has no products (if available)
    - expect: Products list becomes empty
    - expect: Empty state is displayed or no data message appears

#### 7.3. Verify Column Headers Are Sortable

**File:** `tests/products/sortable-columns.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
  2. Verify all column headers with sort capability have clickable indicators
    - expect: Sortable columns (ID, Currency, Product Type, Brand, Categories, Sub Categories, Tax, Tax Method) have sort indicators
    - expect: Clicking sort buttons toggles sort order

#### 7.4. Page Responsiveness with Large Product List

**File:** `tests/products/large-dataset.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page with many products loaded
  2. Scroll through the products list
    - expect: Page scrolls smoothly
    - expect: No performance issues observed
    - expect: All products load correctly
  3. Apply multiple filters/searches
    - expect: Filtering works smoothly
    - expect: Products are updated without lag
    - expect: Page remains responsive

#### 7.5. Session Timeout Handling

**File:** `tests/products/session-timeout.spec.ts`

**Steps:**
  1. -
    - expect: User is logged in on the Products list page
  2. Wait for the session to expire (or simulate session expiration)
    - expect: User is redirected to the login page
    - expect: Error message or warning is displayed
    - expect: Previously entered filters/searches are cleared

### 8. Performance and Data Integrity

**Seed:** `tests/seed.spec.ts`

#### 8.1. Verify Product Data Accuracy

**File:** `tests/products/data-accuracy.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
  2. Select a product and view its full details
    - expect: All product fields are correctly displayed
    - expect: Prices are accurate and formatted correctly
    - expect: Quantities match inventory data
    - expect: Tax information is correct

#### 8.2. Verify Currency Display

**File:** `tests/products/currency-display.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
  2. Observe currency column in the products grid
    - expect: All products display correct currency (e.g., SAR)
    - expect: Currency symbol or code is consistent across all rows

#### 8.3. Verify Image Loading

**File:** `tests/products/image-loading.spec.ts`

**Steps:**
  1. -
    - expect: User is on the Products list page
  2. Observe product image column
    - expect: Images load successfully or display placeholder
    - expect: No broken image icons appear
    - expect: Images are correctly aligned
