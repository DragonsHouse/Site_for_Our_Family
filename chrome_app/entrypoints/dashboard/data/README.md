# Dragon House Frontend Data Architecture

Phase 3.3 establishes the shared data path for every future Dragon House module.

## Folder Layout

```text
data/
  models/        shared entity primitives
  repositories/  common Repository<T> contract and mock repository factory
  services/      business-logic service boundaries
  state/         loading, refreshing, error, filtering, pagination and selection state
  hooks/         reusable React data hooks
  utils/         small data utilities
  types/         shared DTO/query/result types
  errors/        Dragon error model
```

## Dependency Rules

```text
UI
  |
  v
State hooks
  |
  v
Services
  |
  v
Repository<T>
  |
  v
Mock data or API data source
```

Modules must not import upward. Repositories do not import React. Services do not import UI. UI receives state and actions from hooks.

## Repository Contract

Every future data source implements the same methods:

```ts
Repository<T>.list()
Repository<T>.getById()
Repository<T>.create()
Repository<T>.update()
Repository<T>.delete()
```

Mock and API repositories must be swappable without changing module UI.

## State Contract

Shared state tracks:

- `loading`
- `refreshing`
- `error`
- `filters`
- `pagination`
- `selection`
- `optimisticIds` for future optimistic updates

## Service Responsibilities

Services own business logic such as filtering, sorting, statistics, normalization and derived values. React components should remain presentation-only.

## Future Backend Integration

To connect a module to the backend, create an API repository that implements `Repository<T>` and replace the mock repository at the hook/service boundary. The UI should not change.

## Members Migration Path

1. Move public member DTOs into `data/models`.
2. Add `members-repository.ts` implementing `Repository<Member>`.
3. Wrap existing mock/local members through `createMockRepository`.
4. Move member filtering/sorting into a members service.
5. Replace direct component loading with `useDragonCollection`.
6. Later swap mock repository for an API repository without changing Members UI.
