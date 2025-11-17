import { Bpnb_borgActor } from './documents/actor.mjs';
import { Bpnb_borgItem } from './documents/item.mjs';
import { Bpnb_borgActorSheet } from './sheets/actor-sheet.mjs';
import { Bpnb_borgItemSheet } from './sheets/item-sheet.mjs';
import { preloadHandlebarsTemplates } from './helpers/templates.mjs';
import { BPNB_BORG } from './helpers/config.mjs';

Hooks.once('init', function () {
  game.bpnb_borg = {
    Bpnb_borgActor,
    Bpnb_borgItem,
    rollItemMacro,
  };

  CONFIG.BPNB_BORG = BPNB_BORG;

  CONFIG.Combat.initiative = {
    formula: '1d20 + @abilities.agl.mod',
    decimals: 2,
  };

  // Установить документ-классы
  CONFIG.Actor.documentClass = Bpnb_borgActor;
  CONFIG.Item.documentClass = Bpnb_borgItem;

  CONFIG.ActiveEffect.legacyTransferral = false;

  //----------------------------------------------------------------
  //     РЕГИСТРАЦИЯ ЛИСТОВ — НОВЫЙ СПОСОБ (Foundry v10+)
  //----------------------------------------------------------------

  CONFIG.Actor.sheetClasses ??= {};
  CONFIG.Item.sheetClasses ??= {};

  CONFIG.Actor.sheetClasses["bpnb-borg-ru"] = CONFIG.Actor.sheetClasses["bpnb-borg-ru"] ?? {};
  CONFIG.Item.sheetClasses["bpnb-borg-ru"] = CONFIG.Item.sheetClasses["bpnb-borg-ru"] ?? {};

  CONFIG.Actor.sheetClasses["bpnb-borg-ru"]["character"] = {
    id: "bpnb-actor-character",
    label: "BPNB_BORG.SheetLabels.Actor",
    cls: Bpnb_borgActorSheet,
    default: true
  };

  CONFIG.Actor.sheetClasses["bpnb-borg-ru"]["npc"] = {
    id: "bpnb-actor-npc",
    label: "BPNB_BORG.SheetLabels.Actor",
    cls: Bpnb_borgActorSheet,
    default: true
  };

  CONFIG.Item.sheetClasses["bpnb-borg-ru"] = {
    "item": { id:"bpnb-item-item", cls: Bpnb_borgItemSheet, default:true },
    "feature": { id:"bpnb-item-feature", cls: Bpnb_borgItemSheet, default:true },
    "spell": { id:"bpnb-item-spell", cls: Bpnb_borgItemSheet, default:true },
    "weapon": { id:"bpnb-item-weapon", cls: Bpnb_borgItemSheet, default:true },
    "armour": { id:"bpnb-item-armour", cls: Bpnb_borgItemSheet, default:true }
  };

  preloadHandlebarsTemplates();
});

// Helpers
Handlebars.registerHelper("toLowerCase", str => str.toLowerCase());
Handlebars.registerHelper("checkedIf", c => c ? "checked" : "");
Handlebars.registerHelper("xtotal", (roll) =>
  roll.result.replace("+  -", "-").replace("+ -", "-")
);

Hooks.once('ready', () => {
  Hooks.on('hotbarDrop', (bar, data, slot) => createItemMacro(data, slot));
});

async function createItemMacro(data, slot) {
  if (data.type !== 'Item') return;

  if (!data.uuid.includes('Actor.') && !data.uuid.includes('Token.')) {
    ui.notifications.warn('Можно создавать макросы только для предметов актёра');
    return;
  }

  const item = await fromUuid(data.uuid);
  const command = `game.bpnb_borg.rollItemMacro("${data.uuid}");`;

  let macro = game.macros.find(m => m.name === item.name && m.command === command);
  if (!macro) {
    macro = await Macro.create({
      name: item.name,
      type: 'script',
      img: item.img,
      command,
      flags: { 'bpnb_borg.itemMacro': true }
    });
  }
  game.user.assignHotbarMacro(macro, slot);
  return false;
}

function rollItemMacro(uuid) {
  fromUuid(uuid).then(item => {
    if (!item || !item.parent) {
      ui.notifications.warn(`Не найден предмет ${uuid}`);
      return;
    }
    item.roll();
  });
}
