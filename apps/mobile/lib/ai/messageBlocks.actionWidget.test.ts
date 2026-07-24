import assert from 'node:assert/strict';
import {
  findActionJsonBlocks,
  parseMessageBlocks,
} from './messageBlocks';

const balanceWithCta = JSON.stringify({
  type: 'balance_summary_card',
  variant: 'total',
  label: 'Solde total',
  value_label: '5 240,00 $',
  action: { label: 'Voir les comptes' },
});

const chatAction = JSON.stringify({
  action: 'creer_objectif',
  params: { nom: 'Vacances', montant_cible: 5000 },
  confirmation: "Créer l'objectif Vacances (5 000 $)?",
});

const reply = `Voici tes soldes.\n\n${balanceWithCta}\n\n${chatAction}`;

const actions = findActionJsonBlocks(reply);
assert.equal(actions.length, 1, 'widget CTA action object must not count as chat action');
assert.ok(actions[0]?.includes('creer_objectif'));

const blocks = parseMessageBlocks(reply);
assert.ok(
  blocks.some((block) => block.type === 'balance_summary_card'),
  'balance_summary_card with action CTA must still render as a widget',
);
assert.ok(blocks.some((block) => block.type === 'text'));

console.log('messageBlocks.actionWidget.test.ts: ok');
