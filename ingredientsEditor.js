/* Ingredients Editor — bulletproof wiring to match Recipe Builder.
   - Global handlers (window.ieAddOrUpdate / ieExport / ieImport / ieDelete)
   - Works whether buttons use inline onclick OR are wired by ID in JS
   - No dependency on recipes/prices load for Add/Export to work
*/

(function () {
  const USER_PRICES_KEY = 'brood_user_prices_v1';

  // ---------- Storage helpers ----------
  function getUserPrices() {
    try { return JSON.parse(localStorage.getItem(USER_PRICES_KEY) || '{}') || {}; }
    catch { return {}; }
  }
  function setUserPrices(obj) {
    localStorage.setItem(USER_PRICES_KEY, JSON.stringify(obj || {}));
    document.dispatchEvent(new CustomEvent('userPricesUpdated'));
    if (typeof window.showPopup === 'function') window.showPopup('Saved ingredient prices');
  }

  // ---------- Merge helper (for table/datalist) ----------
  function merge(base, user) {
    const out = JSON.parse(JSON.stringify(base || {}));
    Object.keys(user || {}).forEach(ing => {
      if (!out[ing]) out[ing] = {};
      Object.assign(out[ing], user[ing]);
    });
    return out;
  }

  // ---------- UI refresh ----------
  function refreshDatalist() {
    const dl = document.getElementById('ingredient-list');
    if (!dl) return;
    const merged = merge(window.basePricesCache || {}, getUserPrices());
    const names = Object.keys(merged).sort();
    dl.innerHTML = names.map(n => `<option value="${n}"></option>`).join('');
  }

  function renderTable() {
    const tbody = document.querySelector('#ie-table tbody');
    if (!tbody) return;
    const merged = merge(window.basePricesCache || {}, getUserPrices());
    const rows = [];
    Object.keys(merged).sort().forEach(ing => {
      const brands = merged[ing] || {};
      Object.keys(brands).sort().forEach(brand => {
        rows.push({ ing, brand, price: brands[brand] });
      });
    });
    tbody.innerHTML = rows.map(r => {
      // Safer attribute escaping
      const ingAttr = String(r.ing).replace(/"/g, '&quot;');
      const brandAttr = String(r.brand).replace(/"/g, '&quot;');
      return `<tr>
        <td>${r.ing}</td>
        <td>${r.brand}</td>
        <td>${Number(r.price).toFixed(2)}</td>
        <td><button class="ie-del" data-ing="${ingAttr}" data-brand="${brandAttr}">Delete</button></td>
      </tr>`;
    }).join('');

    // wire delete buttons
    tbody.querySelectorAll('.ie-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const ing = btn.getAttribute('data-ing');
        const brand = btn.getAttribute('data-brand');
        const user = getUserPrices();
        if (user[ing] && user[ing][brand] != null) {
          delete user[ing][brand];
          if (Object.keys(user[ing]).length === 0) delete user[ing];
          setUserPrices(user);
          renderTable();
          refreshDatalist();
        } else {
          if (typeof window.showPopup === 'function') window.showPopup('That brand is from the base DB; create an override to change it.');
        }
      });
    });
  }

  // ---------- Handlers (GLOBAL) ----------
  function ieAddOrUpdate() {
    const ingEl = document.getElementById('ie-ingredient');
    const brandEl = document.getElementById('ie-brand');
    const priceEl = document.getElementById('ie-price');
    const ing = (ingEl && ingEl.value || '').trim();
    const brand = (brandEl && brandEl.value || '').trim();
    const price = parseFloat(priceEl && priceEl.value);

    if (!ing || !brand || isNaN(price)) {
      if (typeof window.showPopup === 'function') window.showPopup('Please fill ingredient, brand and price.');
      return;
    }
    const user = getUserPrices();
    if (!user[ing]) user[ing] = {};
    user[ing][brand] = price;
    setUserPrices(user);
    renderTable();
    refreshDatalist();
    if (brandEl) brandEl.value = '';
    if (priceEl) priceEl.value = '';
  }

  function ieExport() {
    const data = JSON.stringify(getUserPrices(), null, 2);
    try {
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ingredientPrices_user.json';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      // Mobile fallback: open data URL
      const url = 'data:application/json;charset=utf-8,' + encodeURIComponent(data);
      window.location.href = url;
    }
  }

  function ieImport(e) {
    const file = e && e.target && e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const obj = JSON.parse(reader.result);
        if (typeof obj !== 'object' || Array.isArray(obj)) throw new Error('bad format');
        setUserPrices(obj);
        renderTable();
        refreshDatalist();
        if (typeof window.showPopup === 'function') window.showPopup('Imported prices.');
      } catch {
        if (typeof window.showPopup === 'function') window.showPopup('Invalid JSON for prices.');
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  // expose globals for inline wiring (exactly like builder)
  window.ieAddOrUpdate = ieAddOrUpdate;
  window.ieExport = ieExport;
  window.ieImport = ieImport;

  // ---------- Init (same as builder style) ----------
  function init() {
    // If page uses IDs instead of inline wiring, hook those too
    const addBtn = document.getElementById('ie-add');
    const expBtn = document.getElementById('ie-export');
    const impFile = document.getElementById('ie-import');
    if (addBtn && !addBtn._ie) { addBtn.addEventListener('click', ieAddOrUpdate); addBtn._ie = true; }
    if (expBtn && !expBtn._ie) { expBtn.addEventListener('click', ieExport); expBtn._ie = true; }
    if (impFile && !impFile._ie) { impFile.addEventListener('change', ieImport); impFile._ie = true; }

    // Render now (even if base DB not loaded yet)
    renderTable();
    refreshDatalist();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Re-render when base prices or user overrides change
  document.addEventListener('pricesLoaded', () => { renderTable(); refreshDatalist(); });
  document.addEventListener('userPricesUpdated', () => { renderTable(); refreshDatalist(); });

  // Optional: surface JS errors so it's easier to report
  window.addEventListener('error', (e) => {
    try {
      console.warn('Ingredients Editor error:', e.error || e.message);
    } catch {}
  });
})();