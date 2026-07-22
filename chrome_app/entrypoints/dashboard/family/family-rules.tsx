import { useState } from 'react';
import { canManageFamilyContent } from '../../../lib/family-permissions';
import {
  DEFAULT_FAMILY_CONTENT_BLOCKS,
  readFamilyContentBlocks,
  saveFamilyContentBlock
} from '../../../lib/family-repositories';
import type { FamilyEditableContentBlock, FamilyUser } from '../../../lib/family-types';
import { FamilyContentEditor } from './family-content-editor';

const RULE_BLOCK_IDS = DEFAULT_FAMILY_CONTENT_BLOCKS
  .filter((block) => block.id.startsWith('family-rule-'))
  .map((block) => block.id);

function getRuleBlocks(blocks: FamilyEditableContentBlock[]) {
  return RULE_BLOCK_IDS.map((id) => blocks.find((block) => block.id === id)).filter(
    (block): block is FamilyEditableContentBlock => Boolean(block)
  );
}

export function FamilyRules({ currentUser }: { currentUser: FamilyUser }) {
  const canEditContent = canManageFamilyContent(currentUser);
  const [contentBlocks, setContentBlocks] = useState<FamilyEditableContentBlock[]>(() => readFamilyContentBlocks());
  const [editingBlock, setEditingBlock] = useState<FamilyEditableContentBlock | null>(null);
  const rules = getRuleBlocks(contentBlocks);

  function saveContentBlock(block: FamilyEditableContentBlock) {
    setContentBlocks(saveFamilyContentBlock(block, currentUser.nickname));
    setEditingBlock(null);
  }

  return (
    <section className="rounded-2xl border border-red-950/70 bg-slate-950/75 p-5">
      <h2 className="text-lg font-semibold text-white">Правила сім’ї</h2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {rules.map((rule) => (
          <article key={rule.id} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-amber-100">{rule.title}</h3>
              {canEditContent ? (
                <button
                  type="button"
                  onClick={() => setEditingBlock(rule)}
                  className="shrink-0 rounded-lg border border-amber-500/50 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/10"
                >
                  Редагувати
                </button>
              ) : null}
            </div>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-slate-300">
              {rule.body
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean)
                .map((item) => (
                  <li key={item}>{item}</li>
                ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
              {rule.contact ? <span>Контакт / автор: {rule.contact}</span> : null}
              <span>Оновлено: {new Date(rule.updatedAt).toLocaleString('uk-UA')}</span>
            </div>
          </article>
        ))}
      </div>

      {editingBlock ? (
        <FamilyContentEditor
          block={editingBlock}
          onClose={() => setEditingBlock(null)}
          onSave={saveContentBlock}
        />
      ) : null}
    </section>
  );
}
