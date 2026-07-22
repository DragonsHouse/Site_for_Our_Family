import { useState } from 'react';
import { RECRUITMENT_SETTINGS } from '../../../lib/family-data';
import { canManageFamilyContent } from '../../../lib/family-permissions';
import { readFamilyContentBlocks, saveFamilyContentBlock } from '../../../lib/family-repositories';
import type { FamilyEditableContentBlock, FamilyUser } from '../../../lib/family-types';
import { FamilyContentEditor } from './family-content-editor';

function getRecruitmentBlock(blocks: FamilyEditableContentBlock[]) {
  const block = blocks.find((item) => item.id === 'recruitment-info');
  if (!block) throw new Error('Missing recruitment content block');
  return block;
}

export function RecruitmentPanel({ currentUser }: { currentUser: FamilyUser }) {
  const canManage = canManageFamilyContent(currentUser);
  const [contentBlocks, setContentBlocks] = useState<FamilyEditableContentBlock[]>(() => readFamilyContentBlocks());
  const [editingBlock, setEditingBlock] = useState<FamilyEditableContentBlock | null>(null);
  const recruitmentBlock = getRecruitmentBlock(contentBlocks);

  function saveContentBlock(block: FamilyEditableContentBlock) {
    setContentBlocks(saveFamilyContentBlock(block, currentUser.nickname));
    setEditingBlock(null);
  }

  return (
    <section className="rounded-2xl border border-red-950/70 bg-slate-950/75 p-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">{recruitmentBlock.title}</h2>
          <p className="mt-1 text-sm text-slate-400">Поточний статус набору, вимоги та контакт керівництва.</p>
        </div>
        {canManage ? (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            Можна редагувати текст, контакт і дату оновлення.
          </div>
        ) : null}
      </div>
      <div className="mt-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
        <div className="text-xs uppercase tracking-[0.22em] text-amber-300">Статус</div>
        <div className="mt-1 text-2xl font-semibold text-white">
          {RECRUITMENT_SETTINGS.isOpen ? 'Набір відкритий' : 'Набір закритий'}
        </div>
        <p className="mt-3 whitespace-pre-line text-sm leading-6 text-slate-300">{recruitmentBlock.body}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <h3 className="font-semibold text-white">Вимоги</h3>
            <ul className="mt-2 space-y-2 text-sm text-slate-300">
              {RECRUITMENT_SETTINGS.requirements.map((item) => (
                <li key={item} className="rounded-xl border border-slate-800 bg-slate-950/70 px-3 py-2">
                  {item}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm">
            <div className="text-slate-500">Контакт / автор</div>
            <div className="mt-1 text-slate-100">{recruitmentBlock.contact}</div>
            <div className="mt-3 text-slate-500">Оновлено</div>
            <div className="mt-1 text-slate-100">{new Date(recruitmentBlock.updatedAt).toLocaleDateString('uk-UA')}</div>
            {canManage ? (
              <button
                type="button"
                onClick={() => setEditingBlock(recruitmentBlock)}
                className="mt-4 rounded-lg border border-amber-500/50 px-3 py-1.5 text-xs text-amber-100 hover:bg-amber-500/10"
              >
                Редагувати
              </button>
            ) : null}
          </div>
        </div>
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
