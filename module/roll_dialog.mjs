// roll_dialog.mjs — РУССКАЯ ВЕРСИЯ BPnB-BORG-RU
// Все пути — bpnb-borg-ru, все функции работают, кнопка ЗАЩИТА ОТКРЫВАЕТСЯ!

function addShowDicePromise(promises, roll) {
  if (game.dice3d) {
    promises.push(game.dice3d.showForRoll(roll, game.user, true, null, false));
  }
}

export async function attackRollDialogV2(actor, itemId, data_roll, label, damage) {
  let rollDRFormula = 12;
  let rollDamageFormula = damage || "1d6";
  let rollArmorFormula = null;
  const item = actor.items.get(itemId);
  const actorRollData = actor.getRollData();

  if (!label) label = "Roll";
  const rollFormula = data_roll;

  const rollResult = {
    actor,
    rollFormula,
    item,
    label,
    rollDRFormula,
    rollDamageFormula,
    rollArmorFormula
  };

  const html = await renderTemplate("systems/bpnb-borg-ru/templates/dialogs/attack_roll_dialog.hbs", rollResult);

  return new Promise((resolve) => {
    new Dialog({
      title: game.i18n.localize("BPNB_BORG.RollDialog.Roll"),
      content: html,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: game.i18n.localize("BPNB_BORG.RollDialog.Roll"),
          callback: (html) => attackDialogCallbackV2(actor, html, resolve),
        },
      },
      default: "roll",
      close: () => resolve(null),
    }).render(true);
  });
}

export async function defendRollDialog(actor, modifier = 0) {
  const actorRollData = actor.getRollData();
  const label = game.i18n.localize("BPNB_BORG.Labels.Defend");
  const rollFormula = `1d20 + ${modifier}`;

  const rollResult = { actor, label, rollFormula };

  const html = await renderTemplate("systems/bpnb-borg-ru/templates/dialogs/defend_dialog.hbs", rollResult);

  return new Promise((resolve) => {
    new Dialog({
      title: label,
      content: html,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: game.i18n.localize("BPNB_BORG.RollDialog.Roll"),
          callback: (html) => defendRollCallback(actor, html, resolve),
        },
      },
      default: "roll",
      close: () => resolve(null),
    }).render(true);
  });
}

export async function attackRollDialog(actor, itemId, data_roll, label) {
  const item = actor.items.get(itemId);
  const actorRollData = actor.getRollData();
  if (!label) label = "Roll";
  const rollFormula = data_roll;

  const rollResult = { actor, rollFormula, item, label };

  const html = await renderTemplate("systems/bpnb-borg-ru/templates/dialogs/roll_dialog.hbs", rollResult);

  return new Promise((resolve) => {
    new Dialog({
      title: game.i18n.localize("BPNB_BORG.RollDialog.Roll"),
      content: html,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d20"></i>',
          label: game.i18n.localize("BPNB_BORG.RollDialog.Roll"),
          callback: (html) => attackDialogCallback(actor, html, resolve),
        },
      },
      default: "roll",
      close: () => resolve(null),
    }).render(true);
  });
}

// === ВТОРАЯ ЧАСТЬ: ОБРАБОТКА БРОСКОВ И КАРТЫ ===

async function attackDialogCallbackV2(actor, html, resolve) {
  const form = html[0].querySelector("form");
  const rollFormula = form.rollFormula.value;
  const rollDRFormula = parseInt(form.rollDRFormula.value) || 12;
  const rollDamageFormula = form.rollDamageFormula.value || "1d6";
  const rollArmorFormula = form.rollArmorFormula.value || null;

  const actorRollData = actor.getRollData();
  const dicePromises = [];

  const attackRoll = new Roll(rollFormula, actorRollData);
  await attackRoll.evaluate();
  addShowDicePromise(dicePromises, attackRoll);

  let isHit = false;
  let isCrit = attackRoll.terms[0].results[0].result === 20;
  let attackOutcome = game.i18n.localize("BPNB_BORG.Labels.Attack_Miss");

  if (isCrit || attackRoll.total >= rollDRFormula) {
    isHit = true;
    attackOutcome = isCrit
      ? game.i18n.localize("BPNB_BORG.Labels.Attack_Crit")
      : game.i18n.localize("BPNB_BORG.Labels.Attack_Hit");
  }

  let damageRoll = null;
  let armorRoll = null;
  let totalDamage = 0;

  if (isHit) {
    damageRoll = new Roll(rollDamageFormula, actorRollData);
    await damageRoll.evaluate();
    addShowDicePromise(dicePromises, damageRoll);
    let damageResult = damageRoll.total;
    if (isCrit) damageResult *= 2;

    totalDamage = damageResult;

    if (rollArmorFormula) {
      armorRoll = new Roll(rollArmorFormula, actorRollData);
      await armorRoll.evaluate();
      addShowDicePromise(dicePromises, armorRoll);
      const armorResult = armorRoll.total;
      totalDamage = Math.max(0, totalDamage - armorResult);
    }
  }

  await Promise.all(dicePromises);

  const rollResult = {
    actor,
    isHit,
    isCrit,
    attackRoll,
    attackOutcome,
    damageRoll,
    totalDamage,
    armorRoll,
    label: form.rollLabel?.value || "Attack"
  };

  await renderAttackRollCard(actor, rollResult);
  resolve(rollResult);
}

async function attackDialogCallback(actor, html, resolve) {
  const form = html[0].querySelector("form");
  const rollFormula = form.rollFormula.value;
  const actorRollData = actor.getRollData();

  const attackRoll = new Roll(rollFormula, actorRollData);
  await attackRoll.evaluate();

  await attackRoll.toMessage({
    speaker: ChatMessage.getSpeaker({ actor }),
    flavor: form.rollLabel.value || "Roll",
  });

  resolve(attackRoll);
}

async function defendRollCallback(actor, html, resolve) {
  const form = html[0].querySelector("form");
  const rollFormula = form.rollFormula.value;
  const defendDR = parseInt(form.rollDR.value) || 12;
  const actorRollData = actor.getRollData();

  const dicePromises = [];
  const defendRoll = new Roll(rollFormula, actorRollData);
  await defendRoll.evaluate();
  addShowDicePromise(dicePromises, defendRoll);

  const d20Result = defendRoll.terms[0].results[0].result;

  let resultTitle = "";
  let resultBody = null;

  if (d20Result === 20) {
    resultTitle = game.i18n.localize('BPNB_BORG.Labels.Defend_Critical_Success');
    resultBody = game.i18n.localize('BPNB_BORG.Labels.Defend_Critical_Success_Action');
  } else if (d20Result === 1) {
    resultTitle = game.i18n.localize('BPNB_BORG.Labels.Defend_Fumble');
    resultBody = game.i18n.localize('BPNB_BORG.Labels.Defend_Fumble_Action');
  } else if (defendRoll.total >= defendDR) {
    resultTitle = game.i18n.localize('BPNB_BORG.Labels.Defend_Success');
  } else {
    resultTitle = game.i18n.localize('BPNB_BORG.Labels.Defend_Got_Hit');
  }

  await Promise.all(dicePromises);

  const rollResult = {
    actor,
    label: form.rollLabel.value,
    resultTitle,
    resultBody,
    defendRoll,
    defendDR
  };

  await renderDefendRollCard(actor, rollResult);
  resolve(rollResult);
}

async function renderAttackRollCard(actor, rollResult) {
  const html = await renderTemplate("systems/bpnb-borg-ru/templates/chat/attack-roll-card.hbs", rollResult);
  ChatMessage.create({
    content: html,
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}

async function renderDefendRollCard(actor, rollResult) {
  const html = await renderTemplate("systems/bpnb-borg-ru/templates/chat/defend-roll-card.hbs", rollResult);
  ChatMessage.create({
    content: html,
    speaker: ChatMessage.getSpeaker({ actor }),
  });
}