
import React, { useState } from "react";
import recipes from "./data/recipes.json";
import prices from "./data/ingredientPrices.json";

export default function BakeryPlanner() {
  const recipe = recipes[0];
  const totalBakersPercent = recipe.ingredients
    .filter(i => i.percent)
    .reduce((sum, i) => sum + i.percent, 0);

  const [useDoughInput, setUseDoughInput] = useState(false);
  const [inputValue, setInputValue] = useState(1000); // grams

  // Total dough weight vs flour weight
  const doughBaseGrams = useDoughInput
    ? inputValue
    : inputValue / (totalBakersPercent / 100);

  const getCostPerKg = (ingredientName) => {
    const match = prices.find(p =>
      ingredientName.toLowerCase().includes(p.name.toLowerCase())
    );
    return match ? match.price : 0;
  };

  // Scaling ingredients based on per unit weight or percentage
  const scaledIngredients = recipe.ingredients.map(i => {
    let grams = 0;

    // Handle ingredients based on per unit weight (e.g., butter sticks)
    if (i.perUnitGrams) {
      const units = doughBaseGrams / recipe.itemWeightGrams;
      grams = i.perUnitGrams * units;
    } else if (i.fixedGrams) {
      grams = i.fixedGrams;
    } else if (i.percent) {
      grams = (i.percent / 100) * doughBaseGrams;
    }

    const costPerKg = getCostPerKg(i.name);
    const cost = (grams / 1000) * costPerKg;

    return {
      ...i,
      grams,
      cost: cost.toFixed(2)
    };
  });

  const totalCost = scaledIngredients.reduce((sum, i) => sum + parseFloat(i.cost), 0);

  return (
    <div style={{ padding: "1rem", fontFamily: "Arial", maxWidth: 640, margin: "0 auto" }}>
      <h1>Bakery Planner</h1>

      <label>
        <input
          type="checkbox"
          checked={useDoughInput}
          onChange={() => setUseDoughInput(!useDoughInput)}
        />
        &nbsp; Use Total Dough Weight
      </label>

      <div style={{ marginTop: "0.5rem" }}>
        <label>
          {useDoughInput ? "Total Dough Weight (g):" : "Flour Base (g):"}
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
          </tr>
        </thead>
        <tbody>
          {scaledIngredients.map((i, idx) => (
            <tr key={idx}>
              <td>{i.name}</td>
              <td align="right">{i.percent || (i.perUnitGrams ? `~${i.perUnitGrams}g/unit` : "-")}</td>
              <td align="right">{i.grams.toFixed(1)}</td>
              <td align="right">{i.cost}</td>
            </tr>
          ))}
          <tr style={{ fontWeight: "bold" }}>
            <td colSpan="3">Total Cost</td>
            <td align="right">{totalCost.toFixed(2)} ฿</td>
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
