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
    return { ingredient: obj.ingredient || {}, extra: obj.extra || {} };
  } catch { return { ingredient: {}, extra: {} }; }
}
function saveBrandCache() { try { localStorage.setItem(BRAND_CACHE_KEY, JSON.stringify(brandCache)); } catch {} }
const brandCache = loadBrandCache();

function chooseBrand(kind, name, brands) {
  const cache = kind === 'ingredient' ? brandCache.ingredient : brandCache.extra;
  const cached = cache[name];
  if (cached && brands.includes(cached)) return cached;

  if (kind === 'ingredient') {
    const paidBrand = brands.find(brand => (prices[name]?.[brand] || 0) > 0);
    if (paidBrand) return paidBrand;
  }

  return brands[0] || "";
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
  document.getElementById('number-of-items').value = formatItemCount(itemsPerBatch);

  const ingTbody = document.querySelector('#ingredients-table tbody');
  ingTbody.innerHTML = '';
  let totalCost = 0;

  (recipe.ingredients || []).forEach(ing => {
    const row = document.createElement('tr');
    const amount = flourWeight * (ing.percent / 100);
    const brands = Object.keys(prices[ing.name] || {});

    // brand persistence
    let chosenBrand = chooseBrand('ingredient', ing.name, brands);
    if (chosenBrand) { brandCache.ingredient[ing.name] = chosenBrand; saveBrandCache(); }

    const pricePerKg = prices[ing.name]?.[chosenBrand] || 0;
    const cost = pricePerKg * (amount / 1000);
    totalCost += cost;

    const rowSelect = `<select data-type="ingredient" data-name="${ing.name}" data-amount="${amount}">
        ${brands.map(b => `<option value="${b}">${b}</option>`).join('')}
      </select>`;

    row.innerHTML = `
      <td>${ing.name}</td>
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

  const extraTbody = document.querySelector('#extras-table tbody');
  extraTbody.innerHTML = '';
  (recipe.extras || []).forEach((extra, idx) => {
    const brands = Object.keys(prices[extra.name] || {});
    let chosenBrand = chooseBrand('extra', extra.name, brands);
    if (chosenBrand) { brandCache.extra[extra.name] = chosenBrand; saveBrandCache(); }

    const pricePerKg = prices[extra.name]?.[chosenBrand] || 0;
    const costPerItem = pricePerKg * (extra.perUnitGrams / 1000);
    const totalExtraCost = costPerItem * itemsPerBatch;
    totalCost += totalExtraCost;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${extra.name}</td>
      <td><input type="number" value="${extra.perUnitGrams}" class="input-short" oninput="updateExtraGrams(${idx}, this.value)"></td>
      <td>
        <select data-type="extra" data-name="${extra.name}" data-amount="${extra.perUnitGrams}">
          ${brands.map(b => `<option value="${b}">${b}</option>`).join('')}
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
  document.getElementById('cost-per-item').textContent = (totalCost / itemsPerBatch).toFixed(2);
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

  const price = prices[name]?.[brand] || 0;
  const cost = price * (amount / 1000);
  costTd.textContent = cost.toFixed(2);
  showPopup(`${name} → ${brand}`);
  updateTotalCost();
}

function updateExtraGrams(index, newGrams) {
  const recipe = recipes[document.getElementById('recipe-select').value];
  if (!recipe.extras) recipe.extras = [];
  recipe.extras[index].perUnitGrams = parseFloat(newGrams);
  handleRecipeChange();
}

function updateTotalCost() {
  let total = 0;
  document.querySelectorAll('#ingredients-table tbody tr').forEach(row => {
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
  document.querySelectorAll('#extras-table tbody tr').forEach(row => {
    const costPerItem = parseFloat(row.cells[3].textContent) || 0;
    total += costPerItem * itemsPerBatch;
  });

  document.getElementById('total-cost').textContent = total.toFixed(2);
  document.getElementById('number-of-items').value = formatItemCount(itemsPerBatch);
  document.getElementById('cost-per-item').textContent = (total / itemsPerBatch).toFixed(2);
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
  const elec = inputNumber('electricity');
  const water = inputNumber('water');
  const gas = inputNumber('gas');
  const days = inputNumber('work-days');
  const hours = inputNumber('hours-day');
  const wage = inputNumber('hour-wage');
  const employees = inputNumber('employees', 1) || 1;
  const dailyItems = inputNumber('items-day');
  const misc = inputNumber('misc');
  const markup = inputNumber('markup', 1) || 1;

  const monthlyCost = elec + water + gas + (days * hours * wage * employees) + misc;
  const monthlyItems = days * dailyItems;
  const overheadPerItem = monthlyItems > 0 ? monthlyCost / monthlyItems : 0;

  document.getElementById('overhead-per-item').textContent = overheadPerItem.toFixed(2);
  const totalPerItem = (totalCost / itemsPerBatch) + overheadPerItem;
  document.getElementById('total-item-cost').textContent = totalPerItem.toFixed(2);
  const suggestedPerItem = totalPerItem * markup;
  document.getElementById('suggested-price').textContent = suggestedPerItem.toFixed(2);

  const batchOverhead = overheadPerItem * itemsPerBatch;
  const totalBatchCost = totalCost + batchOverhead;
  const suggestedTotalBatch = suggestedPerItem * itemsPerBatch;

  const ob = document.getElementById('overhead-batch'); if (ob) ob.textContent = batchOverhead.toFixed(2);
  const tbc = document.getElementById('total-batch-cost'); if (tbc) tbc.textContent = totalBatchCost.toFixed(2);
  const stb = document.getElementById('suggested-total-batch'); if (stb) stb.textContent = suggestedTotalBatch.toFixed(2);

  const profit = suggestedTotalBatch - totalBatchCost;
  const ep = document.getElementById('estimated-profit'); if (ep) ep.textContent = profit.toFixed(2);
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
