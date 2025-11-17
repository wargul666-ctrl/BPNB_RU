import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';

const BaseItemSheet = foundry.appv1?.sheets?.ItemSheet ?? ItemSheet;

export class Bpnb_borgItemSheet extends BaseItemSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['bpnb_borg','sheet','item'],
      width: 520,
      height: 480,
      tabs: [{
        navSelector: '.sheet-tabs',
        contentSelector: '.sheet-body',
        initial: 'description'
      }]
    });
  }

  get template() {
    return `systems/bpnb-borg-ru/templates/item/item-${this.item.type}-sheet.hbs`;
  }

  getData() {
    const context = super.getData();
    const itemData = context.data;

    context.system = itemData.system;
    context.flags = itemData.flags;
    context.rollData = this.item.getRollData();
    context.effects = prepareActiveEffectCategories(this.item.effects);

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.on("click", ".effect-control", (ev) =>
      onManageActiveEffect(ev, this.item)
    );
  }
}
