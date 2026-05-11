// Uses globals & utils from calculator.js
// Expects: recipes, prices, baseRecipesCache,
//          showPopup, getUserRecipes, setUserRecipes, mergeRecipes, populateRecipeSelect

function rbPriceNames() { return Object.keys(prices || {}); }
function rbDefaultIngredient(names) {
  const idx = names.findIndex(n => (n || '').toLowerCase() === 'none');
  return idx >= 0 ? names[idx] : (names[0] || '');
}

function rbInitSelectOptions(selectEl, preferred) {
  const names = rbPriceNames();
  if (!names.length) {
    selectEl.innerHTML = `<option>— loading prices —</option>`;
    selectEl.disabled = true;
    return;
  }
  const chosen = (preferred && names.includes(preferred)) ? preferred : rbDefaultIngredient(names);
  selectEl.innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join('');
  selectEl.value = chosen;
  selectEl.disabled = false;
}

function rbAddRow(name = '', percent = '') {
  const tbody = document.getElementById('builder-body');
  const tr = document.createElement('tr');
  tr.innerHTML = `
    <td>
      <select class="rb-ing-select" data-prefer="${(name || '').replace(/"/g,'&quot;')}">
        <option>— loading prices —</option>
      </select>
    </td>
    <td><input type="number" step="0.1" placeholder="%" value="${percent}" oninput="rbUpdateSummary()"></td>
    <td><button onclick="this.closest('tr').remove(); rbUpdateSummary();">Remove</button></td>
  `;
  tbody.appendChild(tr);

  // If prices already loaded, init now; otherwise wait for pricesLoaded event
  rbInitSelectOptions(tr.querySelector('.rb-ing-select'), name);
  rbUpdateSummary();
}

function rbClearRows() {
  document.getElementById('builder-body').innerHTML = '';
  rbUpdateSummary();
}

function rbCollectRecipe() {
  const name = (document.getElementById('rb-name').value || '').trim();
  const itemWeight = parseFloat(document.getElementById('rb-item-weight').value) || 1;
  const rows = Array.from(document.querySelectorAll('#builder-body tr'));
  const ingredients = rows.map(tr => {
    const sel = tr.querySelector('.rb-ing-select');
    const pct = tr.querySelector('td:nth-child(2) input');
    return { name: (sel && sel.value) || '', percent: parseFloat(pct.value) || 0 };
  }).filter(i => i.name.length > 0);
  return { name, itemWeightGrams: itemWeight, ingredients, extras: [] };
}

function rbUpdateSummary() {
  const r = rbCollectRecipe();
  const totalPct = r.ingredients.reduce((a, i) => a + (i.percent || 0), 0);
  document.getElementById('rb-summary').textContent =
    `Ingredients: ${r.ingredients.length} | Total baker’s %: ${totalPct.toFixed(1)}%`;
}

// ----- Local storage helpers -----
function getUserRecipes() {
  try {
    const raw = localStorage.getItem('brood_user_recipes');
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function setUserRecipes(arr) {
  localStorage.setItem('brood_user_recipes', JSON.stringify(arr || []));
}

// Save current builder form to local recipes (does NOT touch recipes.json)
function rbSaveLocal() {
  const r = rbCollectRecipe();
  if (!r.name) { showPopup('Please enter a recipe name.'); return; }
  if (r.ingredients.length === 0) { showPopup('Add at least one ingredient.'); return; }

  const mine = getUserRecipes();
  const i = mine.findIndex(x => (x.name || '').toLowerCase() === r.name.toLowerCase());
  if (i >= 0) mine[i] = r; else mine.push(r);
  setUserRecipes(mine);

  // Refresh dropdown with merged list (user overrides base)
  recipes = mergeRecipes(baseRecipesCache, mine);
  populateRecipeSelect();

  showPopup('Saved to My Recipes (local).');
}

// Build merged list of base + user recipes (user overrides by name)
function rbAllRecipesMerged() {
  const base = baseRecipesCache || [];
  const user = getUserRecipes();
  const byName = new Map();
  base.forEach(r => byName.set((r.name || '').toLowerCase(), r));
  user.forEach(r => byName.set((r.name || '').toLowerCase(), r)); // user wins
  return Array.from(byName.values());
}

// Export merged recipes (keeps built-ins + your local edits/additions)
function rbExport() {
  const data = JSON.stringify(rbAllRecipesMerged(), null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'recipes_all.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

// Import replaces your local recipe set, then merges with base for the UI
function rbImport(e) {
  const file = e.target.files[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const arr = JSON.parse(reader.result);
      if (!Array.isArray(arr)) throw new Error('JSON must be an array of recipes');
      setUserRecipes(arr);
      recipes = mergeRecipes(baseRecipesCache, arr);
      populateRecipeSelect();
      showPopup('Imported recipes.');
    } catch { showPopup('Invalid JSON.'); }
    finally { e.target.value = ''; }
  };
  reader.readAsText(file);
}

function rbRefreshAllSelects() {
  document.querySelectorAll('.rb-ing-select').forEach(sel => {
    const prefer = sel.getAttribute('data-prefer') || sel.value || '';
    rbInitSelectOptions(sel, prefer);
  });
}

// Seed rows
rbAddRow('Bread Flour', 100);
rbAddRow('Water', 70);
rbAddRow('Salt', 2);

// When prices load, repopulate builder selects
document.addEventListener('pricesLoaded', rbRefreshAllSelects);
