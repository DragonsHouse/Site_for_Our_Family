import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const dataRoot = new URL('../entrypoints/dashboard/data/', import.meta.url);
const repositorySource = readFileSync(new URL('repositories/repository.ts', dataRoot), 'utf8');
const mockRepositorySource = readFileSync(new URL('repositories/mock-repository.ts', dataRoot), 'utf8');
const collectionHookSource = readFileSync(new URL('hooks/use-dragon-collection.ts', dataRoot), 'utf8');
const stateSource = readFileSync(new URL('state/resource-state.ts', dataRoot), 'utf8');
const errorSource = readFileSync(new URL('errors/dragon-errors.ts', dataRoot), 'utf8');
const readmeSource = readFileSync(new URL('README.md', dataRoot), 'utf8');
const calendarModelsSource = readFileSync(new URL('../entrypoints/dashboard/family/calendar-models.ts', import.meta.url), 'utf8');
const calendarServiceSource = readFileSync(new URL('../entrypoints/dashboard/family/calendar-service.ts', import.meta.url), 'utf8');
const calendarStateSource = readFileSync(new URL('../entrypoints/dashboard/family/calendar-state.ts', import.meta.url), 'utf8');
const calendarUiSource = readFileSync(new URL('../entrypoints/dashboard/family/dragon-calendar.tsx', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

describe('Dragon House frontend data architecture source contract', () => {
  it('provides the shared folder structure for future modules', () => {
    ['models', 'repositories', 'services', 'state', 'hooks', 'utils', 'types', 'errors'].forEach((folder) => {
      assert.equal(existsSync(new URL(`${folder}/`, dataRoot)), true, `${folder}/ exists`);
    });
  });

  it('defines a reusable Repository<T> contract and mock repository factory', () => {
    assert.match(repositorySource, /export type Repository<T extends DragonEntity/);
    ['list', 'getById', 'create', 'update', 'delete'].forEach((method) => {
      assert.match(repositorySource, new RegExp(`${method}:`));
    });
    assert.match(mockRepositorySource, /createMockRepository/);
    assert.doesNotMatch(mockRepositorySource, /fetch\(/);
  });

  it('standardizes collection state for loading, filtering, pagination and future optimistic updates', () => {
    ['loading', 'refreshing', 'error', 'filters', 'pagination', 'selectedId', 'optimisticIds'].forEach((field) => {
      assert.match(stateSource, new RegExp(field));
      assert.match(collectionHookSource, new RegExp(field));
    });
    assert.match(collectionHookSource, /toDragonError/);
    assert.match(collectionHookSource, /repository\.list/);
  });

  it('exposes reusable Dragon error classes', () => {
    ['ValidationError', 'NetworkError', 'PermissionError', 'UnknownError'].forEach((errorName) => {
      assert.match(errorSource, new RegExp(`class ${errorName}`));
    });
    assert.match(errorSource, /DragonErrorKind/);
    assert.match(errorSource, /toDragonError/);
  });

  it('uses Dragon Calendar as the reference implementation', () => {
    assert.match(calendarModelsSource, /DragonEntity/);
    assert.match(calendarServiceSource, /Repository</);
    assert.match(calendarServiceSource, /createMockRepository/);
    assert.doesNotMatch(calendarServiceSource, /listEvents/);
    assert.match(calendarStateSource, /useDragonCollection/);
    assert.match(calendarStateSource, /collection\.refresh/);
    assert.match(calendarUiSource, /DragonLoader/);
    assert.match(calendarUiSource, /DragonRetry/);
  });

  it('documents dependency direction, backend swapping and Members migration', () => {
    ['UI', 'State hooks', 'Services', 'Repository<T>', 'Mock data or API data source'].forEach((label) => {
      assert.match(readmeSource, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    });
    assert.match(readmeSource, /Mock and API repositories must be swappable/);
    assert.match(readmeSource, /Members Migration Path/);
    assert.match(readmeSource, /Repository<Member>/);
  });

  it('runs in the frontend test suite', () => {
    assert.match(packageJson.scripts['test:auth-source'], /tests\/dragon-data-architecture\.test\.ts/);
  });
});
