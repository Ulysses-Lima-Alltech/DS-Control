import assert from 'node:assert/strict';

import { normalizeApplicationSearch } from './application-search';

assert.equal(normalizeApplicationSearch(undefined), undefined);
assert.equal(normalizeApplicationSearch(''), undefined);
assert.equal(normalizeApplicationSearch('   '), undefined);
assert.equal(normalizeApplicationSearch('  Fazenda   São   José  '), 'Fazenda São José');
assert.equal(normalizeApplicationSearch('  142  '), '142');
