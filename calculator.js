// ===== Shared state & utilities =====
window.recipes = [];
window.prices = {};
window.baseRecipesCache = [];
window.basePricesCache = {}; // base prices from ingredientPrices.json

function showPopup(message) {
  const popup = document.createElement('div');
  popup.className = 'popup';
  popup.textContent = message;
  document.body.appendChild(popup);
  const existing = document.querySelectorAll('.popup');
  existing.forEach((el, i) => el.style.top = `${20 + i * 50}px`);
  setTimeout(() => popup.remove(), 1800);
}

function switchTab(which) {
  document.getElementById('tab-calculator').classList.toggle('active', which === 'calculator');
  document.getElementById('tab-builder').classList.toggle('active', which === 'builder');
  document.getElementById('tab-ingredients').classList.toggle('active', which === 'ingredients');
  document.getElementById('panel-calculator').classList.toggle('active', which === 'calculator');
  document.getElementById('panel-builder').classList.toggle('active', which === 'builder');
  document.getElementById('panel-ingredients').classList.toggle('active', which === 'ingredients');
}

function fetchJSON(path) {
  return fetch(path + '?cacheBust=' + new Date().getTime()).then(async (r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status} for ${path}`);
    const txt = await r.text();
    try { return JSON.parse(txt); }
    catch (e) { console.error('JSON parse error', path, e, txt.slice(0,1000)); throw e; }
  });
}

function getUserRecipes() {
  try {
    const raw = localStorage.getItem('brood_user_recipes');
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function setUserRecipes(arr) { localStorage.setItem('brood_user_recipes', JSON.stringify(arr || [])); }
function mergeRecipes(base, user) {
  const byName = new Map();
  (base || []).forEach(recipe => byName.set((recipe.name || '').toLowerCase(), recipe));
  (user || []).forEach(recipe => byName.set((recipe.name || '').toLowerCase(), recipe));
  return Array.from(byName.values());
}

// ===== User prices (for merging with base) =====
const USER_PRICES_KEY = 'brood_user_prices_v1';
function getUserPrices() {
  try { return JSON.parse(localStorage.getItem(USER_PRICES_KEY) || '{}') || {}; } catch { return {}; }
}
function setUserPrices(obj) {
  localStorage.setItem(USER_PRICES_KEY, JSON.stringify(obj || {}));
  document.dispatchEvent(new CustomEvent('userPricesUpdated'));
}
function mergePrices(base, user) {
  const out = JSON.parse(JSON.stringify(base || {}));
  Object.keys(user || {}).forEach(ing => {
    if (!out[ing]) out[ing] = {};
    Object.assign(out[ing], user[ing]);
  });
  return out;
}

// ===== Brand cache (persist across reloads) =====
const BRAND_CACHE_KEY = 'brood_brand_cache_v1';
function loadBrandCache() {
  try {
    const raw = localStorage.getItem(BRAND_CACHE_KEY);
    const obj = raw ? JSON.parse(raw) : {};
    return { ingredient: obj.ingredient || {}, extra: obj.extra || {}, role: obj.role || {} };
  } catch { return { ingredient: {}, extra: {}, role: {} }; }
}
function saveBrandCache() { try { localStorage.setItem(BRAND_CACHE_KEY, JSON.stringify(brandCache)); } catch {} }
const brandCache = loadBrandCache();

function priceMeta(name) {
  const meta = prices[name]?._meta;
  return meta && typeof meta === 'object' ? meta : {};
}

function brandNames(name) {
  return Object.keys(prices[name] || {})
    .filter(brand => typeof prices[name]?.[brand] === 'number');
}

function priceFor(name, brand) {
  return prices[name]?.[brand] || 0;
}

function canBeRole(name, role) {
  const canBe = priceMeta(name).canBe;
  return Array.isArray(canBe) && canBe.includes(role);
}

function roleOptions(role) {
  const options = Object.keys(prices || {})
    .filter(name => name !== role && canBeRole(name, role))
    .sort();
  return options.length ? ['None', ...options] : [];
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function brandLabel(brand) {
  return brand || 'Default';
}

function optionsHtml(values, labelFn = value => value) {
  return values
    .map(value => `<option value="${escapeHtml(value)}">${escapeHtml(labelFn(value))}</option>`)
    .join('');
}

function chooseBrand(kind, name, brands) {
  const cache = kind === 'ingredient' ? brandCache.ingredient : brandCache.extra;
  const cached = cache[name];
  if (cached && brands.includes(cached)) return cached;

  if (kind === 'ingredient') {
    const paidBrand = brands.find(brand => priceFor(name, brand) > 0);
    if (paidBrand) return paidBrand;
  }

  return brands[0] || "";
}

function roleSelection(role, defaultIngredient = '', cacheKey = role) {
  const options = roleOptions(role);
  const cached = brandCache.role[cacheKey] || {};
  const legacyIngredient = brandCache.ingredient[role];
  const preferredDefault = defaultIngredient || priceMeta(role).defaultIngredient;
  const firstPaidIngredient = options.find(name => brandNames(name).some(brand => priceFor(name, brand) > 0));
  const canUseCached = cached.defaultIngredient === preferredDefault && options.includes(cached.ingredient);
  const ingredient = canUseCached
    ? cached.ingredient
    : (options.includes(legacyIngredient)
      ? legacyIngredient
      : (options.includes(preferredDefault) ? preferredDefault : (firstPaidIngredient || options[0])));
  const brands = brandNames(ingredient);
  const cachedBrands = cached.brands || {};
  const brand = brands.includes(cachedBrands[ingredient])
    ? cachedBrands[ingredient]
    : chooseBrand('ingredient', ingredient, brands);

  brandCache.role[cacheKey] = {
    ingredient,
    defaultIngredient: preferredDefault,
    brands: { ...cachedBrands, [ingredient]: brand }
  };
  saveBrandCache();

  return { options, ingredient, brands, brand };
}

function inputNumber(id, fallback = 0) {
  const value = parseFloat(document.getElementById(id)?.value);
  return Number.isFinite(value) ? value : fallback;
}

function itemsForDoughWeight(doughWeight, itemWeight) {
  return doughWeight > 0 && itemWeight > 0 ? doughWeight / itemWeight : 1;
}

function formatItemCount(items) {
  if (!Number.isFinite(items)) return '0';
  return Math.abs(items - Math.round(items)) < 0.01 ? String(Math.round(items)) : items.toFixed(2);
}

function setText(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function wasteRate() {
  const value = inputNumber('waste-percent');
  return Math.min(Math.max(value, 0), 95) / 100;
}

function sellableItemsFor(items) {
  const sellable = items * (1 - wasteRate());
  return Math.max(sellable, 0.0001);
}

function roundUpToIncrement(value, increment) {
  if (!Number.isFinite(value) || value <= 0) return 0;
  if (!Number.isFinite(increment) || increment <= 0) return value;
  return Math.ceil(value / increment) * increment;
}

function percentOf(part, whole) {
  return whole > 0 ? (part / whole) * 100 : 0;
}

function populateRecipeSelect() {
  const select = document.getElementById('recipe-select');
  if (!select) return;
  select.innerHTML = '';
  recipes.forEach((r, i) => {
    const opt = document.createElement('option');
    opt.value = i; opt.textContent = r.name;
    select.appendChild(opt);
  });
  if (recipes.length > 0) {
    select.selectedIndex = 0;
    showPopup(`Loaded: ${recipes[0].name}`);
    handleRecipeChange();
  }
}

// ===== Calculator logic =====
function handleRecipeChange() {
  const recipe = recipes[document.getElementById('recipe-select').value];
  const inputType = document.getElementById('input-type').value;
  const grams = inputNumber('input-grams');
  if (!recipe || isNaN(grams)) return;

  const itemWeight = parseFloat(recipe.itemWeightGrams) || 1;
  document.getElementById('item-weight').value = itemWeight;

  const doughPercent = totalDoughPercent(recipe);
  if (doughPercent <= 0) return;
  const flourWeight = (inputType === 'flour') ? grams : grams / (doughPercent / 100);
  const doughWeight = flourWeight * (doughPercent / 100);

  const itemsPerBatch = itemsForDoughWeight(doughWeight, itemWeight);
  const sellableItemsPerBatch = sellableItemsFor(itemsPerBatch);
  document.getElementById('number-of-items').value = formatItemCount(itemsPerBatch);
  setText('sellable-items', formatItemCount(sellableItemsPerBatch));

  const ingTbody = document.querySelector('#ingredients-table tbody');
  ingTbody.innerHTML = '';
  let totalCost = 0;

  (recipe.ingredients || []).forEach(ing => {
    const row = document.createElement('tr');
    const amount = flourWeight * (ing.percent / 100);
    const selectableRole = priceMeta(ing.name).selectsRole || ing.name;
    const selectableOptions = roleOptions(selectableRole);

    if (selectableOptions.length) {
      const cacheKey = `${recipe.name}:ingredient:${ing.name}`;
      const selection = roleSelection(selectableRole, ing.defaultIngredient, cacheKey);
      const pricePerKg = priceFor(selection.ingredient, selection.brand);
      const cost = pricePerKg * (amount / 1000);
      totalCost += cost;

      row.innerHTML = `
        <td>${escapeHtml(ing.name)}</td>
        <td>${amount.toFixed(1)}</td>
        <td>${ing.percent}%</td>
        <td>
          <select data-type="role" data-role="${escapeHtml(selectableRole)}" data-cache-key="${escapeHtml(cacheKey)}" data-amount="${amount}">
            ${optionsHtml(selection.options)}
          </select>
          <select data-type="role-brand" data-role="${escapeHtml(selectableRole)}" data-cache-key="${escapeHtml(cacheKey)}" data-ingredient="${escapeHtml(selection.ingredient)}" data-amount="${amount}">
            ${optionsHtml(selection.brands, brandLabel)}
          </select>
        </td>
        <td>${cost.toFixed(2)}</td>`;
      ingTbody.appendChild(row);

      const roleSel = row.querySelector('select[data-type="role"]');
      const brandSel = row.querySelector('select[data-type="role-brand"]');
      roleSel.value = selection.ingredient;
      brandSel.value = selection.brand;

      roleSel.addEventListener('change', () => {
        const cached = brandCache.role[cacheKey] || {};
        brandCache.role[cacheKey] = {
          ingredient: roleSel.value,
          defaultIngredient: ing.defaultIngredient || priceMeta(selectableRole).defaultIngredient || '',
          brands: cached.brands || {}
        };
        saveBrandCache();
        handleRecipeChange();
      });

      brandSel.addEventListener('change', () => {
        updateRoleBrand(selectableRole, selection.ingredient, brandSel.value, amount, brandSel.parentElement.nextElementSibling, cacheKey);
      });
      return;
    }

    const brands = brandNames(ing.name);

    // brand persistence
    let chosenBrand = chooseBrand('ingredient', ing.name, brands);
    if (chosenBrand) { brandCache.ingredient[ing.name] = chosenBrand; saveBrandCache(); }

    const pricePerKg = priceFor(ing.name, chosenBrand);
    const cost = pricePerKg * (amount / 1000);
    totalCost += cost;

    const rowSelect = `<select data-type="ingredient" data-name="${ing.name}" data-amount="${amount}">
        ${optionsHtml(brands, brandLabel)}
      </select>`;

    row.innerHTML = `
      <td>${escapeHtml(ing.name)}</td>
      <td>${amount.toFixed(1)}</td>
      <td>${ing.percent}%</td>
      <td>${rowSelect}</td>
      <td>${cost.toFixed(2)}</td>`;
    ingTbody.appendChild(row);

    const sel = row.querySelector('select');
    sel.value = chosenBrand;
    sel.addEventListener('change', () => {
      updateBrand(sel, 'ingredient', ing.name, amount, sel.parentElement.nextElementSibling);
    });
  });

  const laminationTbody = document.querySelector('#lamination-table tbody');
  laminationTbody.innerHTML = '';
  (recipe.lamination || []).forEach(lam => {
    const row = document.createElement('tr');
    const percent = parseFloat(lam.percent) || 0;
    const amount = flourWeight * (percent / 100);
    const brands = brandNames(lam.name);
    let chosenBrand = chooseBrand('ingredient', lam.name, brands);
    if (chosenBrand) { brandCache.ingredient[lam.name] = chosenBrand; saveBrandCache(); }

    const pricePerKg = priceFor(lam.name, chosenBrand);
    const cost = pricePerKg * (amount / 1000);
    totalCost += cost;

    const rowSelect = `<select data-type="lamination" data-name="${escapeHtml(lam.name)}" data-amount="${amount}">
        ${optionsHtml(brands, brandLabel)}
      </select>`;

    row.innerHTML = `
      <td>${escapeHtml(lam.name)}</td>
      <td>${amount.toFixed(1)}</td>
      <td>${percent}%</td>
      <td>${rowSelect}</td>
      <td>${cost.toFixed(2)}</td>`;
    laminationTbody.appendChild(row);

    const sel = row.querySelector('select');
    sel.value = chosenBrand;
    sel.addEventListener('change', () => {
      updateBrand(sel, 'ingredient', lam.name, amount, sel.parentElement.nextElementSibling);
    });
  });

  const fillingTbody = document.querySelector('#fillings-table tbody');
  fillingTbody.innerHTML = '';
  (recipe.fillings || []).forEach((filling, idx) => {
    const role = priceMeta(filling.name).selectsRole || filling.role || filling.name;
    const options = roleOptions(role);
    const cacheKey = `${recipe.name}:filling:${idx}`;
    const selection = roleSelection(role, filling.defaultIngredient, cacheKey);
    const gramsPerItem = parseFloat(filling.perUnitGrams) || 0;
    const pricePerKg = priceFor(selection.ingredient, selection.brand);
    const costPerItem = pricePerKg * (gramsPerItem / 1000);
    totalCost += costPerItem * itemsPerBatch;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(filling.name)}</td>
      <td><input type="number" value="${gramsPerItem}" class="input-short" oninput="updateFillingGrams(${idx}, this.value)"></td>
      <td>
        <select data-type="filling" data-role="${escapeHtml(role)}" data-cache-key="${escapeHtml(cacheKey)}" data-amount="${gramsPerItem}">
          ${optionsHtml(options)}
        </select>
        <select data-type="filling-brand" data-role="${escapeHtml(role)}" data-cache-key="${escapeHtml(cacheKey)}" data-ingredient="${escapeHtml(selection.ingredient)}" data-amount="${gramsPerItem}">
          ${optionsHtml(selection.brands, brandLabel)}
        </select>
      </td>
      <td>${costPerItem.toFixed(2)}</td>`;
    fillingTbody.appendChild(row);

    const roleSel = row.querySelector('select[data-type="filling"]');
    const brandSel = row.querySelector('select[data-type="filling-brand"]');
    roleSel.value = selection.ingredient;
    brandSel.value = selection.brand;

    roleSel.addEventListener('change', () => {
      const cached = brandCache.role[cacheKey] || {};
      brandCache.role[cacheKey] = {
        ingredient: roleSel.value,
        defaultIngredient: filling.defaultIngredient || priceMeta(role).defaultIngredient || '',
        brands: cached.brands || {}
      };
      saveBrandCache();
      handleRecipeChange();
    });

    brandSel.addEventListener('change', () => {
      updateRoleBrand(role, selection.ingredient, brandSel.value, gramsPerItem, brandSel.parentElement.nextElementSibling, cacheKey);
    });
  });

  const extraTbody = document.querySelector('#extras-table tbody');
  extraTbody.innerHTML = '';
  (recipe.extras || []).forEach((extra, idx) => {
    const brands = brandNames(extra.name);
    let chosenBrand = chooseBrand('extra', extra.name, brands);
    if (chosenBrand) { brandCache.extra[extra.name] = chosenBrand; saveBrandCache(); }

    const pricePerKg = priceFor(extra.name, chosenBrand);
    const costPerItem = pricePerKg * (extra.perUnitGrams / 1000);
    const totalExtraCost = costPerItem * itemsPerBatch;
    totalCost += totalExtraCost;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${extra.name}</td>
      <td><input type="number" value="${extra.perUnitGrams}" class="input-short" oninput="updateExtraGrams(${idx}, this.value)"></td>
      <td>
        <select data-type="extra" data-name="${extra.name}" data-amount="${extra.perUnitGrams}">
          ${optionsHtml(brands, brandLabel)}
        </select>
      </td>
      <td>${costPerItem.toFixed(2)}</td>`;
    extraTbody.appendChild(row);

    const sel = row.querySelector('select');
    sel.value = chosenBrand;
    sel.addEventListener('change', () => {
      updateBrand(sel, 'extra', extra.name, extra.perUnitGrams, sel.parentElement.nextElementSibling);
    });
  });

  document.getElementById('total-cost').textContent = totalCost.toFixed(2);
  document.getElementById('cost-per-item').textContent = (totalCost / sellableItemsPerBatch).toFixed(2);
  updateSuggestedPrice(totalCost, recipe);
}

function handleItemWeightChange() {
  const recipe = recipes[document.getElementById('recipe-select').value];
  recipe.itemWeightGrams = parseFloat(document.getElementById('item-weight').value) || 1;
  handleRecipeChange();
}

function handleItemsChange() {
  const items = inputNumber('number-of-items', 1) || 1;
  const itemWeight = inputNumber('item-weight', 1) || 1;
  document.getElementById('input-grams').value = (items * itemWeight).toFixed(1);
  handleRecipeChange();
}

function updateBrand(selectEl, type, name, amount, costTd) {
  const brand = selectEl.value;
  if (type === 'ingredient') brandCache.ingredient[name] = brand;
  else brandCache.extra[name] = brand;
  saveBrandCache();

  const price = priceFor(name, brand);
  const cost = price * (amount / 1000);
  costTd.textContent = cost.toFixed(2);
  showPopup(`${name} → ${brand}`);
  updateTotalCost();
}

function updateRoleBrand(role, ingredient, brand, amount, costTd, cacheKey = role) {
  const cached = brandCache.role[cacheKey] || {};
  brandCache.role[cacheKey] = {
    ingredient,
    defaultIngredient: cached.defaultIngredient || priceMeta(role).defaultIngredient || '',
    brands: { ...(cached.brands || {}), [ingredient]: brand }
  };
  saveBrandCache();

  const price = priceFor(ingredient, brand);
  const cost = price * (amount / 1000);
  costTd.textContent = cost.toFixed(2);
  showPopup(`${role}: ${ingredient} → ${brandLabel(brand)}`);
  updateTotalCost();
}

function updateExtraGrams(index, newGrams) {
  const recipe = recipes[document.getElementById('recipe-select').value];
  if (!recipe.extras) recipe.extras = [];
  recipe.extras[index].perUnitGrams = parseFloat(newGrams);
  handleRecipeChange();
}

function updateFillingGrams(index, newGrams) {
  const recipe = recipes[document.getElementById('recipe-select').value];
  if (!recipe.fillings) recipe.fillings = [];
  recipe.fillings[index].perUnitGrams = parseFloat(newGrams);
  handleRecipeChange();
}

function updateTotalCost() {
  let total = 0;
  document.querySelectorAll('#ingredients-table tbody tr').forEach(row => {
    total += parseFloat(row.cells[4].textContent) || 0;
  });

  document.querySelectorAll('#lamination-table tbody tr').forEach(row => {
    total += parseFloat(row.cells[4].textContent) || 0;
  });

  const recipe = recipes[document.getElementById('recipe-select').value];
  const inputType = document.getElementById('input-type').value;
  const grams = inputNumber('input-grams');
  const itemWeight = parseFloat(recipe.itemWeightGrams) || 1;
  const doughPercent = totalDoughPercent(recipe);
  if (doughPercent <= 0) return;
  const doughWeight = inputType === 'flour' ? grams * (doughPercent / 100) : grams;
  const itemsPerBatch = itemsForDoughWeight(doughWeight, itemWeight);
  const sellableItemsPerBatch = sellableItemsFor(itemsPerBatch);

  document.querySelectorAll('#fillings-table tbody tr').forEach(row => {
    const costPerItem = parseFloat(row.cells[3].textContent) || 0;
    total += costPerItem * itemsPerBatch;
  });

  document.querySelectorAll('#extras-table tbody tr').forEach(row => {
    const costPerItem = parseFloat(row.cells[3].textContent) || 0;
    total += costPerItem * itemsPerBatch;
  });

  document.getElementById('total-cost').textContent = total.toFixed(2);
  document.getElementById('number-of-items').value = formatItemCount(itemsPerBatch);
  setText('sellable-items', formatItemCount(sellableItemsPerBatch));
  document.getElementById('cost-per-item').textContent = (total / sellableItemsPerBatch).toFixed(2);
  updateSuggestedPrice(total, recipe);
}

function totalDoughPercent(recipe) {
  return (recipe.ingredients || [])
    .filter(i => !i.excludeFromDoughWeight)
    .reduce((acc, i) => acc + (parseFloat(i.percent) || 0), 0);
}

function updateSuggestedPrice(totalCost, recipe) {
  const itemWeight = parseFloat(recipe.itemWeightGrams) || 1;
  const inputType = document.getElementById('input-type').value;
  const grams = inputNumber('input-grams');
  const doughPercent = totalDoughPercent(recipe);
  if (doughPercent <= 0) return;
  const doughWeight = inputType === 'flour' ? grams * (doughPercent / 100) : grams;
  const itemsPerBatch = itemsForDoughWeight(doughWeight, itemWeight);
  const sellableItemsPerBatch = sellableItemsFor(itemsPerBatch);
  const elec = inputNumber('electricity');
  const water = inputNumber('water');
  const gas = inputNumber('gas');
  const days = inputNumber('work-days');
  const hours = inputNumber('hours-day');
  const wage = inputNumber('hour-wage');
  const employees = inputNumber('employees', 1) || 1;
  const dailyItems = inputNumber('items-day');
  const misc = inputNumber('misc');
  const packagingPerItem = Math.max(inputNumber('packaging-cost'), 0);
  const batchLaborMinutes = Math.max(inputNumber('batch-labor-minutes'), 0);
  const markup = inputNumber('markup', 1) || 1;
  const roundingIncrement = inputNumber('rounding-increment');
  const manualPrice = inputNumber('manual-price');

  const monthlyCost = elec + water + gas + (days * hours * wage * employees) + misc;
  const monthlyItems = days * dailyItems;
  const overheadPerItem = monthlyItems > 0 ? monthlyCost / monthlyItems : 0;
  const ingredientCostPerItem = totalCost / sellableItemsPerBatch;
  const directLaborBatch = (batchLaborMinutes / 60) * wage;
  const directLaborPerItem = directLaborBatch / sellableItemsPerBatch;
  const totalPerItem = ingredientCostPerItem + overheadPerItem + packagingPerItem + directLaborPerItem;
  const suggestedPerItem = totalPerItem * markup;
  const roundedSuggestedPerItem = roundUpToIncrement(suggestedPerItem, roundingIncrement);
  const sellingPrice = manualPrice > 0 ? manualPrice : roundedSuggestedPerItem;
  const profitPerItem = sellingPrice - totalPerItem;
  const foodCostPercent = percentOf(ingredientCostPerItem, sellingPrice);
  const profitMarginPercent = percentOf(profitPerItem, sellingPrice);

  const batchOverhead = overheadPerItem * sellableItemsPerBatch;
  const batchPackaging = packagingPerItem * sellableItemsPerBatch;
  const totalBatchCost = totalCost + batchOverhead + batchPackaging + directLaborBatch;
  const estimatedRevenue = sellingPrice * sellableItemsPerBatch;
  const profit = estimatedRevenue - totalBatchCost;

  setText('sellable-items', formatItemCount(sellableItemsPerBatch));
  setText('overhead-per-item', overheadPerItem.toFixed(2));
  setText('packaging-per-item', packagingPerItem.toFixed(2));
  setText('direct-labor-per-item', directLaborPerItem.toFixed(2));
  setText('total-item-cost', totalPerItem.toFixed(2));
  setText('suggested-price', suggestedPerItem.toFixed(2));
  setText('rounded-suggested-price', roundedSuggestedPerItem.toFixed(2));
  setText('selling-price-used', sellingPrice.toFixed(2));
  setText('food-cost-percent', foodCostPercent.toFixed(1));
  setText('profit-margin-percent', profitMarginPercent.toFixed(1));
  setText('estimated-profit-per-item', profitPerItem.toFixed(2));
  setText('overhead-batch', batchOverhead.toFixed(2));
  setText('total-batch-cost', totalBatchCost.toFixed(2));
  setText('suggested-total-batch', estimatedRevenue.toFixed(2));
  setText('estimated-profit', profit.toFixed(2));
}

// ===== Startup: load BOTH DBs, merge prices with user overrides =====
Promise.all([ fetchJSON('recipes.json'), fetchJSON('ingredientPrices.json') ])
  .then(([recData, priceData]) => {
    baseRecipesCache = recData || [];
    const mine = getUserRecipes();
    recipes = mergeRecipes(baseRecipesCache, mine);

    window.basePricesCache = priceData || {};
    prices = mergePrices(basePricesCache, getUserPrices());

    showPopup(`Prices loaded (${Object.keys(prices).length} items)`);
    populateRecipeSelect();

    document.dispatchEvent(new CustomEvent('recipesLoaded'));
    document.dispatchEvent(new CustomEvent('pricesLoaded'));
  })
  .catch(err => {
    console.error('Startup load error:', err);
    if (/recipes\.json/.test(String(err))) showPopup('Failed to load recipes');
    if (/ingredientPrices\.json/.test(String(err))) showPopup('Failed to load prices');
  });

// React to editor updates of user prices (live merge without reload)
document.addEventListener('userPricesUpdated', () => {
  prices = mergePrices(basePricesCache, getUserPrices());
  handleRecipeChange();
});
