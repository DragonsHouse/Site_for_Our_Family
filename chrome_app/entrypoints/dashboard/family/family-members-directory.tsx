import { useEffect, useMemo, useRef, useState } from 'react';
import {
  FamilyMemberDirectoryClient,
  FamilyMemberDirectoryError,
  type FamilyMemberDirectoryItem,
  type FamilyMemberDirectoryOrder,
  type FamilyMemberDirectoryRoleFilter,
  type FamilyMemberDirectorySort,
  type FamilyMemberDirectoryStatusFilter,
  type FamilyMemberDirectoryResponse,
} from '../../../lib/family-member-directory-client';
import { FamilyMemberCard } from './family-member-card';

const PAGE_SIZE = 24;
const ROLE_OPTIONS: Array<{ value: FamilyMemberDirectoryRoleFilter; label: string }> = [
  { value: 'all', label: 'All roles' },
  { value: 'owner', label: 'Owner' },
  { value: 'deputy', label: 'Deputy' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'member', label: 'Member' },
];
const STATUS_OPTIONS: Array<{ value: FamilyMemberDirectoryStatusFilter; label: string }> = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'all', label: 'All statuses' },
];
const SORT_OPTIONS: Array<{ value: FamilyMemberDirectorySort; label: string }> = [
  { value: 'rank', label: 'Rank' },
  { value: 'displayName', label: 'Display name' },
  { value: 'role', label: 'Role' },
  { value: 'joinedAt', label: 'Joined date' },
];
const ORDER_OPTIONS: Array<{ value: FamilyMemberDirectoryOrder; label: string }> = [
  { value: 'desc', label: 'Descending' },
  { value: 'asc', label: 'Ascending' },
];

type DirectoryState =
  | { status: 'loading'; data: FamilyMemberDirectoryResponse | null }
  | { status: 'ready'; data: FamilyMemberDirectoryResponse }
  | { status: 'empty'; data: FamilyMemberDirectoryResponse }
  | { status: 'forbidden'; message: string; data: FamilyMemberDirectoryResponse | null }
  | { status: 'error'; message: string; data: FamilyMemberDirectoryResponse | null };

type DirectoryUrlState = {
  page: number;
  search: string;
  role: FamilyMemberDirectoryRoleFilter;
  status: FamilyMemberDirectoryStatusFilter;
  sort: FamilyMemberDirectorySort;
  order: FamilyMemberDirectoryOrder;
};

const DEFAULT_DIRECTORY_URL_STATE: DirectoryUrlState = {
  page: 1,
  search: '',
  role: 'all',
  status: 'active',
  sort: 'rank',
  order: 'desc',
};

function selectClassName() {
  return 'rounded-xl border border-white/10 bg-[#151515] px-3 py-2 text-sm text-slate-100 outline-none ring-orange-500/30 focus:ring';
}

function readDirectoryUrlState(): DirectoryUrlState {
  const params = new URL(window.location.href).searchParams;
  return {
    page: parsePositivePage(params.get('page')),
    search: params.get('search')?.trim() ?? '',
    role: parseOption(params.get('role'), ROLE_OPTIONS, DEFAULT_DIRECTORY_URL_STATE.role),
    status: parseOption(params.get('status'), STATUS_OPTIONS, DEFAULT_DIRECTORY_URL_STATE.status),
    sort: parseOption(params.get('sort'), SORT_OPTIONS, DEFAULT_DIRECTORY_URL_STATE.sort),
    order: parseOption(params.get('order'), ORDER_OPTIONS, DEFAULT_DIRECTORY_URL_STATE.order),
  };
}

function parsePositivePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : DEFAULT_DIRECTORY_URL_STATE.page;
}

function parseOption<T extends string>(value: string | null, options: Array<{ value: T; label: string }>, fallback: T): T {
  return options.some((option) => option.value === value) ? (value as T) : fallback;
}

function directoryUrlSignature(state: DirectoryUrlState): string {
  return JSON.stringify(state);
}

function writeDirectoryUrlState(state: DirectoryUrlState, mode: 'push' | 'replace') {
  const url = new URL(window.location.href);
  url.searchParams.set('page', String(state.page));
  if (state.search.trim()) url.searchParams.set('search', state.search.trim());
  else url.searchParams.delete('search');
  url.searchParams.set('role', state.role);
  url.searchParams.set('status', state.status);
  url.searchParams.set('sort', state.sort);
  url.searchParams.set('order', state.order);
  if (url.href === window.location.href) return;
  if (mode === 'push') window.history.pushState(null, document.title, url);
  else window.history.replaceState(null, document.title, url);
}

function SkeletonCards() {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3" aria-hidden="true">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="dh-card flex min-h-[252px] flex-col gap-4 rounded-2xl p-4">
          <div className="flex gap-3">
            <div className="h-16 w-16 rounded-2xl bg-white/10" />
            <div className="flex-1 space-y-3">
              <div className="h-4 w-2/3 rounded bg-white/10" />
              <div className="h-3 w-1/2 rounded bg-white/5" />
            </div>
          </div>
          <div className="mt-5 space-y-2">
            <div className="h-3 rounded bg-white/5" />
            <div className="h-3 rounded bg-white/5" />
            <div className="h-3 rounded bg-white/5" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DirectoryGrid({ members }: { members: FamilyMemberDirectoryItem[] }) {
  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {members.map((member) => (
        <FamilyMemberCard key={member.memberId} member={member} />
      ))}
    </div>
  );
}

export function FamilyMembersDirectory() {
  const client = useMemo(() => new FamilyMemberDirectoryClient(), []);
  const initialUrlState = useMemo(() => readDirectoryUrlState(), []);
  const [searchDraft, setSearchDraft] = useState(initialUrlState.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initialUrlState.search);
  const [role, setRole] = useState<FamilyMemberDirectoryRoleFilter>(initialUrlState.role);
  const [status, setStatus] = useState<FamilyMemberDirectoryStatusFilter>(initialUrlState.status);
  const [sort, setSort] = useState<FamilyMemberDirectorySort>(initialUrlState.sort);
  const [order, setOrder] = useState<FamilyMemberDirectoryOrder>(initialUrlState.order);
  const [page, setPage] = useState(initialUrlState.page);
  const [refreshNonce, setRefreshNonce] = useState(0);
  const [state, setState] = useState<DirectoryState>({ status: 'loading', data: null });
  const didMountSearchRef = useRef(false);
  const suppressSearchDebounceRef = useRef(false);
  const lastUrlSignatureRef = useRef(directoryUrlSignature(initialUrlState));
  const requestAbortRef = useRef<AbortController | null>(null);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    writeDirectoryUrlState(readDirectoryUrlState(), 'replace');
  }, []);

  useEffect(() => {
    function restoreFromUrl() {
      const next = readDirectoryUrlState();
      suppressSearchDebounceRef.current = true;
      lastUrlSignatureRef.current = directoryUrlSignature(next);
      setSearchDraft(next.search);
      setDebouncedSearch(next.search);
      setRole(next.role);
      setStatus(next.status);
      setSort(next.sort);
      setOrder(next.order);
      setPage(next.page);
      writeDirectoryUrlState(next, 'replace');
    }

    window.addEventListener('popstate', restoreFromUrl);
    return () => window.removeEventListener('popstate', restoreFromUrl);
  }, []);

  useEffect(() => {
    const next = { page, search: debouncedSearch.trim(), role, status, sort, order };
    const signature = directoryUrlSignature(next);
    if (signature === lastUrlSignatureRef.current) return;
    lastUrlSignatureRef.current = signature;
    writeDirectoryUrlState(next, 'push');
  }, [debouncedSearch, order, page, role, sort, status]);

  useEffect(() => {
    if (!didMountSearchRef.current) {
      didMountSearchRef.current = true;
      return;
    }
    if (suppressSearchDebounceRef.current) {
      suppressSearchDebounceRef.current = false;
      return;
    }
    const handle = window.setTimeout(() => {
      setDebouncedSearch(searchDraft.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchDraft]);

  useEffect(() => {
    requestAbortRef.current?.abort();
    const controller = new AbortController();
    requestAbortRef.current = controller;
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;
    setState((current) => ({ status: 'loading', data: 'data' in current ? current.data : null }));
    void client
      .listMembers(
        {
          page,
          pageSize: PAGE_SIZE,
          search: debouncedSearch,
          role,
          status,
          sort,
          order,
        },
        controller.signal,
      )
      .then((data) => {
        if (controller.signal.aborted || requestId !== requestSequenceRef.current) return;
        setState(data.items.length > 0 ? { status: 'ready', data } : { status: 'empty', data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || requestId !== requestSequenceRef.current) return;
        if (error instanceof FamilyMemberDirectoryError && error.status === 403) {
          setState({ status: 'forbidden', message: 'Additional permissions are required to view inactive members.', data: null });
          return;
        }
        setState({
          status: 'error',
          message: error instanceof Error ? error.message : 'Unable to load members.',
          data: null,
        });
      });
    return () => {
      if (requestAbortRef.current === controller) requestAbortRef.current = null;
      controller.abort();
    };
  }, [client, debouncedSearch, order, page, refreshNonce, role, sort, status]);

  const data = 'data' in state ? state.data : null;
  const members = data?.items ?? [];
  const pagination = data?.pagination;

  function retry() {
    setRefreshNonce((current) => current + 1);
    setState({ status: 'loading', data });
  }

  return (
    <section className="space-y-4" aria-labelledby="family-members-directory-title">
      <div className="dh-panel rounded-2xl p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Dragon House</p>
            <h2 id="family-members-directory-title" className="mt-1 text-2xl font-semibold text-white">
              Members
            </h2>
            <p className="mt-2 text-sm text-slate-400">Read-only family directory.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Search</span>
              <input
                type="search"
                value={searchDraft}
                onChange={(event) => setSearchDraft(event.target.value)}
                placeholder="Search members"
                className="w-full rounded-xl border border-white/10 bg-[#151515] px-3 py-2 text-sm text-slate-100 outline-none ring-orange-500/30 placeholder:text-slate-600 focus:ring"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Role</span>
              <select
                value={role}
                onChange={(event) => {
                  setRole(event.target.value as FamilyMemberDirectoryRoleFilter);
                  setPage(1);
                }}
                className={selectClassName()}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Status</span>
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as FamilyMemberDirectoryStatusFilter);
                  setPage(1);
                }}
                className={selectClassName()}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Sort</span>
              <select
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value as FamilyMemberDirectorySort);
                  setPage(1);
                }}
                className={selectClassName()}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-xs text-slate-400">Order</span>
              <select
                value={order}
                onChange={(event) => {
                  setOrder(event.target.value as FamilyMemberDirectoryOrder);
                  setPage(1);
                }}
                className={selectClassName()}
              >
                {ORDER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <div className="sr-only" aria-live="polite">
        {state.status === 'loading' ? 'Loading members' : `${members.length} members loaded`}
      </div>

      {state.status === 'loading' ? <SkeletonCards /> : null}

      {state.status === 'forbidden' ? (
        <div className="dh-panel rounded-2xl border border-amber-500/30 p-5 text-amber-100" role="alert">
          <h3 className="font-semibold">Additional permissions required</h3>
          <p className="mt-2 text-sm text-amber-50">{state.message}</p>
        </div>
      ) : null}

      {state.status === 'error' ? (
        <div className="dh-panel rounded-2xl border border-rose-500/30 p-5 text-rose-100" role="alert">
          <h3 className="font-semibold">Unable to load members</h3>
          <p className="mt-2 text-sm text-rose-50">{state.message}</p>
          <button
            type="button"
            onClick={retry}
            className="mt-4 rounded-xl border border-rose-400/40 px-4 py-2 text-sm font-semibold text-rose-50 hover:bg-rose-500/10 focus:outline-none focus:ring focus:ring-rose-400/30"
          >
            Retry
          </button>
        </div>
      ) : null}

      {state.status === 'empty' ? (
        <div className="dh-panel rounded-2xl p-8 text-center text-slate-400">No dragons found.</div>
      ) : null}

      {state.status === 'ready' ? <DirectoryGrid members={members} /> : null}

      {pagination ? (
        <nav className="dh-panel flex flex-col gap-3 rounded-2xl p-4 sm:flex-row sm:items-center sm:justify-between" aria-label="Members pagination">
          <button
            type="button"
            disabled={!pagination.hasPreviousPage || state.status === 'loading'}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            aria-label="Previous members page"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Previous
          </button>
          <div className="text-center text-sm text-slate-400">
            Page {pagination.page} of {Math.max(1, pagination.totalPages)}
          </div>
          <button
            type="button"
            disabled={!pagination.hasNextPage || state.status === 'loading'}
            onClick={() => setPage((current) => current + 1)}
            aria-label="Next members page"
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-100 hover:border-slate-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Next
          </button>
        </nav>
      ) : null}
    </section>
  );
}
