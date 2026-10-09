import { useEffect, useState } from 'react';
import {
  listBackendFamilyContentBlocks,
  updateBackendFamilyContentBlock
} from '../../../lib/family-content-backend-client';
import { canManageFamilyContent } from '../../../lib/family-permissions';
import type { FamilyEditableContentBlock, FamilyUser } from '../../../lib/family-types';
import { DragonBadge, DragonButton, DragonEmptyState, DragonHero, DragonPanel, DragonStatusMessage } from '../dragon-ui/dragon-ui';
import { FamilyContentEditor } from './family-content-editor';

function getRuleBlocks(blocks: FamilyEditableContentBlock[]) {
  return blocks.filter((block) => block.id.startsWith('family-rule-'));
}

export function FamilyRules({ currentUser }: { currentUser: FamilyUser }) {
  const canEditContent = canManageFamilyContent(currentUser);
  const [contentBlocks, setContentBlocks] = useState<FamilyEditableContentBlock[]>([]);
  const [contentError, setContentError] = useState<string | null>(null);
  const [editingBlock, setEditingBlock] = useState<FamilyEditableContentBlock | null>(null);
  const rules = getRuleBlocks(contentBlocks);

  useEffect(() => {
    const controller = new AbortController();
    setContentError(null);
    listBackendFamilyContentBlocks('rules', controller.signal)
      .then((result) => setContentBlocks(result.items))
      .catch((error) => {
        if (!controller.signal.aborted) setContentError(error instanceof Error ? error.message : 'Правила тимчасово недоступні.');
      });
    return () => controller.abort();
  }, []);

  async function saveContentBlock(block: FamilyEditableContentBlock) {
    const updated = await updateBackendFamilyContentBlock(block);
    setContentBlocks((current) => current.map((item) => (item.id === updated.id ? updated : item)));
    setEditingBlock(null);
  }

  return (
    <section className="space-y-4">
      <DragonHero
        eyebrow="Family code"
        title="Правила сім’ї"
        description="Єдина shared-версія правил Dragon House зберігається в backend і видима всім учасникам."
        className="dh-command-hero"
      >
        <DragonBadge tone="gold">{rules.length || 0} розділів</DragonBadge>
      </DragonHero>

      {contentError ? (
        <DragonStatusMessage tone="error" title="Правила не завантажились">
          {contentError}
        </DragonStatusMessage>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        {rules.map((rule, index) => (
          <DragonPanel key={rule.id} variant="raised" className="p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="dh-command-kicker">Розділ {index + 1}</p>
                <h3 className="mt-1 text-xl font-semibold text-amber-100">{rule.title}</h3>
              </div>
              {canEditContent ? (
                <DragonButton type="button" variant="secondary" onClick={() => setEditingBlock(rule)}>
                  Редагувати
                </DragonButton>
              ) : null}
            </div>
            <ul className="mt-4 grid gap-2 text-sm leading-6 text-stone-200">
              {rule.body
                .split('\n')
                .map((item) => item.trim())
                .filter(Boolean)
                .map((item) => (
                  <li key={item} className="dh-command-list-item px-3 py-2">
                    {item}
                  </li>
                ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-3 text-xs text-stone-400">
              {rule.contact ? <span>Контакт / автор: {rule.contact}</span> : null}
              <span>Оновлено: {new Date(rule.updatedAt).toLocaleString('uk-UA')}</span>
            </div>
            <details className="dh-technical-details">
              <summary>Технічні деталі</summary>
              <p className="mt-2 text-sm">Версія: {rule.version ?? 1}</p>
            </details>
          </DragonPanel>
        ))}
      </div>

      {!rules.length && !contentError ? (
        <DragonEmptyState title="Правила ще не заповнені" description="Коли керівництво додасть розділи, вони з’являться тут." />
      ) : null}

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
