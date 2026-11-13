import {rank} from '../../js/engine.js';

// Build only from a complete final cycle. The stored economic result decides
// placement; teacher grades are optional and never affect the order.
export function buildFinalRanking({companies, results, grades = []}) {
  if (!companies.length) throw new Error('No hay empresas para clasificar');
  const ids = new Set(companies.map(company => company.id));
  const resultIds = new Set(results.map(result => result.company_id));
  if (ids.size !== companies.length || resultIds.size !== results.length ||
      resultIds.size !== ids.size || [...ids].some(id => !resultIds.has(id))) {
    throw new Error('Los resultados finales están incompletos');
  }
  const notes = new Map(grades.map(row => [row.company_id, row.grade]));
  return rank(companies.map(company => ({
    ...company,
    initialCapital: Number(company.initial_capital),
    cash: Number(company.cash),
    inventoryValue: company.inventory.reduce((sum, batch) => sum + batch.quantity * batch.unitCost, 0)
  }))).map((company, index) => ({
    position: index + 1,
    companyId: company.id,
    name: company.name,
    returnPercent: company.returnPercent,
    cash: company.cash,
    grade: notes.has(company.id) ? Number(notes.get(company.id)) : null
  }));
}
