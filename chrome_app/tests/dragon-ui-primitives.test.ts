import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { createElement as h, type ReactElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  DragonBadge,
  DragonButton,
  DragonCheckbox,
  DragonInput,
  DragonPanel,
  DragonStatusMessage,
  DragonToggle,
  DragonTooltip
} from '../entrypoints/dashboard/dragon-ui/components/primitives.ts';

const primitiveSource = readFileSync(new URL('../entrypoints/dashboard/dragon-ui/components/primitives.ts', import.meta.url), 'utf8');
const primitiveStyles = readFileSync(new URL('../entrypoints/dashboard/dragon-ui/styles/primitives.css', import.meta.url), 'utf8');
const rememberMeSource = readFileSync(new URL('../entrypoints/dashboard/auth/RememberMeCheckbox.tsx', import.meta.url), 'utf8');
const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

describe('Dragon UI primitives', () => {
  it('renders DragonButton variants, loading and disabled semantics', () => {
    const html = renderToStaticMarkup(
      h(
        DragonButton,
        {
          variant: 'danger',
          loading: true,
          leadingIcon: '!',
          disabled: false
        },
        'Delete'
      )
    );

    assert.match(html, /dh-dragon-button-danger/);
    assert.match(html, /is-loading/);
    assert.match(html, /disabled=""/);
    assert.match(html, /aria-busy="true"/);
    assert.match(html, /dh-dragon-button-icon/);
  });

  it('preserves DragonButton click behavior for real buttons', () => {
    let clicked = false;
    const element = DragonButton({
      children: 'Save',
      onClick: () => {
        clicked = true;
      }
    }) as ReactElement<{ onClick: () => void }>;

    element.props.onClick();

    assert.equal(clicked, true);
    assert.equal(element.type, 'button');
  });

  it('renders disabled DragonButton links as unavailable links', () => {
    const html = renderToStaticMarkup(
      h(
        DragonButton,
        {
          href: '/dashboard.html',
          disabled: true
        },
        'Open'
      )
    );

    assert.match(html, /href="\/dashboard.html"/);
    assert.match(html, /aria-disabled="true"/);
    assert.match(html, /tabindex="-1"/);
  });

  it('connects DragonInput label, description, error and native props', () => {
    const html = renderToStaticMarkup(
      h(DragonInput, {
        id: 'keeper-name',
        label: 'Keeper name',
        description: 'Shown to other guardians',
        error: 'Required',
        required: true,
        disabled: true,
        name: 'keeper',
        autoComplete: 'username',
        leadingVisual: '@'
      })
    );

    assert.match(html, /for="keeper-name"/);
    assert.match(html, /id="keeper-name-description"/);
    assert.match(html, /id="keeper-name-error"/);
    assert.match(html, /aria-invalid="true"/);
    assert.match(html, /aria-describedby="keeper-name-description keeper-name-error"/);
    assert.match(html, /required=""/);
    assert.match(html, /disabled=""/);
    assert.match(html, /autoComplete="username"/);
  });

  it('renders DragonCheckbox labels, descriptions, errors and checked state', () => {
    const html = renderToStaticMarkup(
      h(DragonCheckbox, {
        id: 'remember',
        label: 'Remember me',
        description: 'Keep this device signed in',
        error: 'Choose explicitly',
        checked: true,
        name: 'remember'
      })
    );

    assert.match(html, /type="checkbox"/);
    assert.match(html, /checked=""/);
    assert.match(html, /id="remember-description"/);
    assert.match(html, /id="remember-error"/);
    assert.match(html, /aria-describedby="remember-description remember-error"/);
  });

  it('supports practical indeterminate checkbox behavior in the primitive implementation', () => {
    assert.match(primitiveSource, /inputRef\.current\.indeterminate = indeterminate/);
  });

  it('renders DragonToggle with switch semantics', () => {
    const html = renderToStaticMarkup(
      h(DragonToggle, {
        id: 'sound',
        label: 'Ambient sound',
        description: 'Enable quiet room sound',
        checked: true
      })
    );

    assert.match(html, /role="switch"/);
    assert.match(html, /checked=""/);
    assert.match(html, /dh-dragon-toggle/);
  });

  it('renders DragonBadge tones and compact size', () => {
    const html = renderToStaticMarkup(
      h(
        'div',
        null,
        h(DragonBadge, { tone: 'warning', compact: true }, 'Pending'),
        h(DragonBadge, { tone: 'permission' }, 'Can edit')
      )
    );

    assert.match(html, /dh-dragon-badge-warning/);
    assert.match(html, /dh-dragon-badge-permission/);
    assert.match(html, /dh-dragon-badge-compact/);
  });

  it('renders DragonPanel semantic elements and heading relationships', () => {
    const html = renderToStaticMarkup(
      h(
        DragonPanel,
        {
          as: 'article',
          variant: 'critical',
          title: 'Gate warning',
          description: 'The gate is sealed',
          headingLevel: 3
        },
        'Panel body'
      )
    );

    assert.match(html, /^<article/);
    assert.match(html, /dh-dragon-panel-critical/);
    assert.match(html, /aria-labelledby=/);
    assert.match(html, /aria-describedby=/);
    assert.match(html, /<h3/);
  });

  it('renders DragonTooltip with described trigger and tooltip role', () => {
    const html = renderToStaticMarkup(h(DragonTooltip, { label: 'More detail' }, h('button', { type: 'button' }, 'i')));

    assert.match(html, /aria-describedby=/);
    assert.match(html, /role="tooltip"/);
    assert.match(html, /More detail/);
  });

  it('renders DragonStatusMessage live-region behavior by tone', () => {
    const errorHtml = renderToStaticMarkup(h(DragonStatusMessage, { tone: 'error', title: 'Failed' }, 'Try again'));
    const loadingHtml = renderToStaticMarkup(h(DragonStatusMessage, { tone: 'loading' }, 'Loading'));

    assert.match(errorHtml, /role="alert"/);
    assert.match(errorHtml, /aria-live="assertive"/);
    assert.match(loadingHtml, /role="status"/);
    assert.match(loadingHtml, /aria-busy="true"/);
  });

  it('keeps primitive styles token-driven and wired through the existing Dragon UI surface', () => {
    assert.match(primitiveStyles, /var\(--dragon-/);
    assert.match(primitiveStyles, /var\(--dh-/);
    assert.match(primitiveStyles, /color-mix/);
    assert.doesNotMatch(primitiveStyles, /#[0-9a-fA-F]{3,8}/);
    assert.match(rememberMeSource, /<DragonCheckbox/);
    assert.match(packageJson.scripts['test:auth-source'], /tests\/dragon-ui-primitives\.test\.ts/);
  });
});
