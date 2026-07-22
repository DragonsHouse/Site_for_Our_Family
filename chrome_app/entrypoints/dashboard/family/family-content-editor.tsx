import { useState } from 'react';
import type { FamilyEditableContentBlock } from '../../../lib/family-types';

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const offsetMs = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function fromDateTimeLocal(value: string, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date.toISOString();
}

export function FamilyContentEditor({
  block,
  onClose,
  onSave
}: {
  block: FamilyEditableContentBlock;
  onClose: () => void;
  onSave: (block: FamilyEditableContentBlock) => void;
}) {
  const [title, setTitle] = useState(block.title);
  const [body, setBody] = useState(block.body);
  const [contact, setContact] = useState(block.contact ?? '');
  const [updatedAt, setUpdatedAt] = useState(() => toDateTimeLocal(block.updatedAt));

  function save() {
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle || !cleanBody) return;
    onSave({
      ...block,
      title: cleanTitle,
      body: cleanBody,
      contact: contact.trim() || null,
      updatedAt: fromDateTimeLocal(updatedAt, block.updatedAt)
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4">
      <section className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-red-950/80 bg-[#111111] p-5 shadow-2xl shadow-red-950/40">
        <div className="flex flex-col gap-3 border-b border-slate-800 pb-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-300">Family content</p>
            <h3 className="mt-1 text-xl font-semibold text-white">Редагувати блок</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-200 hover:bg-slate-900"
          >
            Закрити
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            />
          </label>

          <label className="block">
            <span className="mb-1 block text-sm text-slate-300">Body</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={8}
              className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm leading-6 text-slate-100"
            />
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Contact / author</span>
              <input
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-sm text-slate-300">Updated at</span>
              <input
                type="datetime-local"
                value={updatedAt}
                onChange={(event) => setUpdatedAt(event.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
              />
            </label>
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-800 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 px-4 py-2 text-sm text-slate-200 hover:bg-slate-900"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={!title.trim() || !body.trim()}
            className="rounded-xl bg-gradient-to-r from-red-700 to-amber-500 px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            Save
          </button>
        </div>
      </section>
    </div>
  );
}
