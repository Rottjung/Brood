
import React, { useState } from "react";
import recipes from "./data/recipes.json";
import prices from "./data/ingredientPrices.json";

export default function BakeryPlanner() {
  const recipe = recipes[0];
  const totalBakersPercent = recipe.ingredients
    .filter(i => i.percent)
    .reduce((sum, i) => sum + i.percent, 0);

  const [useDoughInput, setUseDoughInput] = useState(true);
  const [inputValue, setInputValue] = useState(4000);
  const [ingredientBrands, setIngredientBrands] = useState({});

  // Total dough weight vs flour weight
  const doughBaseGrams = useDoughInput
    ? inputValue
    : inputValue / (totalBakersPercent / 100);

  const getCostPerKg = (ingredientName, brand) => {
    const ingredient = prices[ingredientName];
    if (ingredient) {
      // If no brand selected, use the first brand as default
      return brand ? ingredient[brand] : ingredient[Object.keys(ingredient)[0]];
    }
    return 0;
  };

  // Handle changing the brand selection
  const handleBrandChange = (ingredientName, brand) => {
    setIngredientBrands(prevState => ({
      ...prevState,
      [ingredientName]: brand
    }));
  };

  // Scaling ingredients based on per unit weight or percentage
  const scaledIngredients = recipe.ingredients.map(i => {
    let grams = 0;
    let cost = 0;

    if (i.perUnitGrams) {
      const units = doughBaseGrams / recipe.itemWeightGrams;
      grams = i.perUnitGrams * units;
      const brand = ingredientBrands[i.name] || Object.keys(prices[i.name])[0]; // Default to the first brand
      cost = getCostPerKg(i.name, brand) * grams / 1000;
    } else if (i.fixedGrams) {
      grams = i.fixedGrams;
      const brand = ingredientBrands[i.name] || Object.keys(prices[i.name])[0]; // Default to the first brand
      cost = getCostPerKg(i.name, brand) * grams / 1000;
    } else if (i.percent) {
      grams = (i.percent / 100) * doughBaseGrams;
      const brand = ingredientBrands[i.name] || Object.keys(prices[i.name])[0]; // Default to the first brand
      cost = getCostPerKg(i.name, brand) * grams / 1000;
    }

    return {
      ...i,
      grams,
      cost: cost.toFixed(2) || "0.00"
    };
  });

  const totalCost = scaledIngredients.reduce((sum, i) => sum + parseFloat(i.cost), 0);

  return (
    <div style={{ padding: "1rem", fontFamily: "Arial", maxWidth: 640, margin: "0 auto" }}>
      <h1>Bakery Planner</h1>

      <label>
        <input
          type="checkbox"
          checked={!useDoughInput}
          onChange={() => setUseDoughInput(!useDoughInput)}
        />
        &nbsp; Use Total Dough Weight
      </label>

      <div style={{ marginTop: "0.5rem" }}>
        <label>
          {!useDoughInput ? "Total Dough Weight (g):" : "Flour Base (g):"}
        </label>
        <input
          type="number"
          value={inputValue}
          onChange={e => setInputValue(parseFloat(e.target.value))}
          style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem" }}
        />
      </div>

      <h2>Ingredients for {recipe.name}</h2>
      <table border="1" cellPadding="8" cellSpacing="0" width="100%">
        <thead>
          <tr>
            <th>Ingredient</th>
            <th>%</th>
            <th>Grams</th>
            <th>Cost (฿)</th>
            <th>Brand</th>
          </tr>
        </thead>
        <tbody>
          {scaledIngredients.map((i, idx) => (
            <tr key={idx}>
              <td>{i.name}</td>
              <td align="right">{i.percent || (i.perUnitGrams ? `~${i.perUnitGrams}g/unit` : "-")}</td>
              <td align="right">{i.grams.toFixed(1)}</td>
              <td align="right">{i.cost}</td>
              <td>
                {(i.name === "Butter" || i.name === "Salted butter (filling)") && (
                  <select
                    value={ingredientBrands[i.name] || Object.keys(prices[i.name])[0]} // Default to first brand
                    onChange={e => handleBrandChange(i.name, e.target.value)}
                  >
                    {Object.keys(prices[i.name]).map(brand => (
                      <option key={brand} value={brand}>
                        {brand}
                      </option>
                    ))}
                  </select>
                )}
              </td>
            </tr>
          ))}
          <tr style={{ fontWeight: "bold" }}>
            <td colSpan="3">Total Cost</td>
            <td align="right">{totalCost.toFixed(2)} ฿</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <h3 style={{ marginTop: "1.5rem" }}>Ingredient Notes:</h3>
      <ul>
        {recipe.ingredients.filter(i => i.note).map((i, idx) => (
          <li key={idx}>• {i.name}: {i.note}</li>
        ))}
      </ul>
    </div>
  );
}
