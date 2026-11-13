// Shared podium ordering. Equal grades share a position; names and IDs only
// make the display order deterministic within a tie.
export function rankCompanies(companies) {
  const sorted = [...companies].sort((a, b) =>
    Number(b.grade) - Number(a.grade) ||
    a.name.localeCompare(b.name, 'es') || a.id.localeCompare(b.id));
  return sorted.map((company, index) => ({
    position: index && Number(company.grade) === Number(sorted[index - 1].grade)
      ? sorted.findIndex(other => Number(other.grade) === Number(company.grade)) + 1
      : index + 1,
    companyId: company.id,
    name: company.name,
    grade: Number(company.grade)
  }));
}
