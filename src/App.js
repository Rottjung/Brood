import React, { useState } from "react";

const mockIngredients = [
  { name: "Flour T65", packageWeightKg: 22.5, packagePrice: 900 },
  { name: "Butter", packageWeightKg: 1, packagePrice: 250 },
  { name: "Water", packageWeightKg: 18, packagePrice: 70 },
  { name: "Salt", packageWeightKg: 1, packagePrice: 20 },
];

const mockRecipe = {
  name: "Shio Pan",
  ingredients: [
    { name: "Flour T65", percent: 100 },
    { name: "Butter", percent: 10 },
    { name: "Water", percent: 65 },
    { name: "Salt", percent: 2 },
  ],
  flags: ["NeedsRetard"]
};

function getCostPerKg(name) {
  const entry = mockIngredients.find(i => i.name === name);
  return entry ? entry.packagePrice / entry.packageWeightKg : 0;
}

export default function BakeryPlanner() {
  const [totalFlourGrams, setTotalFlourGrams] = useState(1000);

  const scaledIngredients = mockRecipe.ingredients.map(i => {
    const grams = (i.percent / 100) * totalFlourGrams;
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

      <h2>Ingredients for {mockRecipe.name}</h2>
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
              <td align="right">{i.percent}</td>
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
        {mockRecipe.flags.map((flag, idx) => (
          <li key={idx}>• {flag}</li>
        ))}
      </ul>
    </div>
  );
}
