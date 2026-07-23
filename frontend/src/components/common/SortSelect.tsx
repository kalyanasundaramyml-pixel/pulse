export type DateSortOption = 'createdDesc' | 'createdAsc' | 'updatedDesc' | 'updatedAsc';

// updatedAt is optional so this also works for types (like a run/assignment)
// that only ever have a creation date — sorting by "updated" just falls back
// to createdAt for those.
export function sortByDate<T extends { createdAt: string; updatedAt?: string }>(
  items: T[],
  sort: DateSortOption,
): T[] {
  const useUpdated = sort.startsWith('updated');
  const direction = sort.endsWith('Asc') ? 1 : -1;
  return [...items].sort((a, b) => {
    const aTime = new Date((useUpdated ? a.updatedAt : a.createdAt) ?? a.createdAt).getTime();
    const bTime = new Date((useUpdated ? b.updatedAt : b.createdAt) ?? b.createdAt).getTime();
    return direction * (aTime - bTime);
  });
}

export function SortSelect({ value, onChange }: { value: DateSortOption; onChange: (value: DateSortOption) => void }) {
  return (
    <label className="sort-control">
      Sort by
      <select value={value} onChange={(e) => onChange(e.target.value as DateSortOption)}>
        <option value="createdDesc">Newest created</option>
        <option value="createdAsc">Oldest created</option>
        <option value="updatedDesc">Recently updated</option>
        <option value="updatedAsc">Least recently updated</option>
      </select>
    </label>
  );
}
