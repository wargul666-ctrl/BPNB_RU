export async function preloadHandlebarsTemplates() {
  const base = "systems/bpnb-borg-ru/templates";

  const templates = [
    `${base}/actor/actor-character-sheet.hbs`,
    `${base}/actor/actor-npc-sheet.hbs`,
    `${base}/item/item-weapon-sheet.hbs`,
    `${base}/item/item-armour-sheet.hbs`,
    `${base}/item/item-item-sheet.hbs`,
    `${base}/item/item-feature-sheet.hbs`,
    `${base}/item/item-spell-sheet.hbs`,
    `${base}/dialogs/attack-roll-dialog.hbs`,
    `${base}/dialogs/defend-dialog.hbs`,
    `${base}/dialogs/roll-dialog.hbs`,
    `${base}/chat/attack-roll-card.hbs`,
    `${base}/chat/defend-roll-card.hbs`
  ];

  const partials = {
    "bpnb-borg-ru.features": `${base}/actor/parts/actor-features.hbs`,
    "bpnb-borg-ru.weapons": `${base}/actor/parts/actor-weapons.hbs`,
    "bpnb-borg-ru.armour": `${base}/actor/parts/actor-armour.hbs`,
    "bpnb-borg-ru.items": `${base}/actor/parts/actor-items.hbs`,
    "bpnb-borg-ru.spells": `${base}/actor/parts/actor-spells.hbs`,
    "bpnb-borg-ru.effects": `${base}/actor/parts/actor-effects.hbs`
  };

  try {
    await foundry.applications.handlebars.loadTemplates(templates);
    console.log("BPNB-RU | Основные шаблоны загружены");
  } catch (e) {
    console.error("BPNB-RU | Ошибка загрузки шаблонов:", e);
  }

  for (const [name, path] of Object.entries(partials)) {
    try {
      const response = await fetch(path);
      const html = await response.text();
      Handlebars.registerPartial(name, html);
      console.log(`BPNB-RU | Partial загружен: ${name}`);
    } catch (e) {
      console.error(`BPNB-RU | Не найден partial: ${path}`, e);
    }
  }

  console.log("BPNB-RU | ВСЕ PARTIALS И ШАБЛОНЫ УСПЕШНО ЗАГРУЖЕНЫ!");
}
