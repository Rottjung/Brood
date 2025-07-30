
import React, { useState, useEffect } from "react";
import recipes from "./data/recipes.json";
import prices from "./data/ingredientPrices.json";

export default function BakeryPlanner() {
  const [totalFlourGrams, setTotalFlourGrams] = useState(1000);
  const recipe = recipes[0];

  const getCostPerKg = (ingredientName) => {
    const match = prices.find(p => ingredientName.toLowerCase().includes(p.name.toLowerCase()));
    return match ? match.price : 0;
  };

  const scaledIngredients = recipe.ingredients.map(i => {
    const base = i.percent ? (i.percent / 100) * totalFlourGrams : 0;
    const grams = i.fixedGrams || base;
    const costPerKg = getCostPerKg(i.name);
    const cost = (grams / 1000) * costPerKg;
    return { ...i, grams, cost: cost.toFixed(2) };
  });

  const totalCost = scaledIngredients.reduce((sum, i) => sum + parseFloat(i.cost), 0);

  return (
    <div style={{ padding: "1rem", fontFamily: "Arial", maxWidth: 600, margin: "0 auto" }}>
      <h1>Bakery Planner</h1>
      <label>Total Flour (grams):</label>
      <input
        type="number"
        value={totalFlourGrams}
        onChange={e => setTotalFlourGrams(parseFloat(e.target.value))}
        style={{ width: "100%", padding: "0.5rem", marginBottom: "1rem" }}
      />

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
              <td align="right">{i.percent || "-"}</td>
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

      <h3 style={{ marginTop: "1.5rem" }}>Recipe Flags:</h3>
      <ul>
        {recipe.ingredients.filter(i => i.note).map((i, idx) => (
          <li key={idx}>• {i.name}: {i.note}</li>
        ))}
      </ul>
    </div>
  );
}
