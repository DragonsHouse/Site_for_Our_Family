import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

const source = readFileSync(new URL('../entrypoints/dashboard/family/family-members.tsx', import.meta.url), 'utf8');

describe('family members sorting controls', () => {
  it('keeps rank and status as real sortable fields', () => {
    assert.match(source, /type MemberSortField = 'rank' \| 'status'/u);
    assert.match(source, /const \[sortField, setSortField\] = useState<MemberSortField>\('rank'\)/u);
    assert.match(source, /const \[sortDirection, setSortDirection\] = useState<MemberSortDirection>\('asc'\)/u);
    assert.match(source, /sortField === 'rank'\s*\?\s*left\.rankLevel - right\.rankLevel\s*:\s*statusSortValue\(left\) - statusSortValue\(right\)/u);
  });

  it('makes status sorting visible by showing every account status before sorting', () => {
    assert.match(source, /const \[status, setStatus\] = useState<'all' \| 'active' \| 'inactive'>\('all'\)/u);
    assert.match(source, /if \(field === 'status'\) \{\s*setStatus\('all'\);\s*\}/u);
    assert.match(source, /return direction === 'asc' \? 'активні -> неактивні' : 'неактивні -> активні'/u);
    assert.match(source, /onClick=\{\(\) => toggleSort\('status'\)\}/u);
  });
});
