import {
  onManageActiveEffect,
  prepareActiveEffectCategories,
} from '../helpers/effects.mjs';

// Новое пространство имён Foundry VTT v13+
const BaseActorSheet = foundry.appv1?.sheets?.ActorSheet ?? ActorSheet;

export class Bpnb_borgActorSheet extends BaseActorSheet {

  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ['bpnb_borg', 'sheet', 'actor'],
      width: 600,
      height: 600,
      tabs: [{
        navSelector: '.sheet-tabs',
        contentSelector: '.sheet-body',
        initial: 'features',
      }],
    });
  }

  get template() {
    return `systems/bpnb-borg-ru/templates/actor/actor-${this.actor.type}-sheet.hbs`;
  }

  getData() {
    const context = super.getData();
    const actorData = context.data;

    context.system = actorData.system;
    context.flags = actorData.flags;

    if (actorData.type === 'character') {
      this._prepareItems(context);
      this._prepareCharacterData(context);
    }

    if (actorData.type === 'npc') {
      this._prepareItems(context);
    }

    context.rollData = context.actor.getRollData();

    context.effects = prepareActiveEffectCategories(
      this.actor.allApplicableEffects()
    );

    return context;
  }

  _prepareCharacterData(context) {}

  _prepareItems(context) {
    const gear = [];
    const features = [];
    const spells = {0:[],1:[],2:[],3:[],4:[],5:[],6:[],7:[],8:[],9:[]};

    for (let i of context.items) {
      i.img = i.img || foundry.documents.Item.DEFAULT_ICON;

      if (i.type === 'item') gear.push(i);
      else if (i.type === 'feature') features.push(i);
      else if (i.type === 'spell') {
        spells[i.system.spellLevel ?? 0].push(i);
      }
    }

    context.gear = gear;
    context.features = features;
    context.spells = spells;
  }

  activateListeners(html) {
    super.activateListeners(html);

    html.on('click', '.item-edit', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      item?.sheet.render(true);
    });

    if (!this.isEditable) return;

    html.on('click', '.item-create', this._onItemCreate.bind(this));

    html.on('click', '.item-delete', (ev) => {
      const li = $(ev.currentTarget).parents('.item');
      const item = this.actor.items.get(li.data('itemId'));
      item.delete();
      li.slideUp(200, () => this.render(false));
    });

    html.on('click', '.effect-control', (ev) => {
      const row = ev.currentTarget.closest('li');
      const doc =
        row.dataset.parentId === this.actor.id
          ? this.actor
          : this.actor.items.get(row.dataset.parentId);
      onManageActiveEffect(ev, doc);
    });

    html.on('click', '.rollable', this._onRoll.bind(this));

    if (this.actor.isOwner) {
      let handler = (ev) => this._onDragStart(ev);
      html.find('li.item').each((i, li) => {
        if (li.classList.contains('inventory-header')) return;
        li.setAttribute('draggable', true);
        li.addEventListener('dragstart', handler, false);
      });
    }
  }

  async _onItemCreate(event) {
    event.preventDefault();
    const header = event.currentTarget;

    const type = header.dataset.type;
    const data = foundry.utils.duplicate(header.dataset);
    const name = `New ${type.capitalize()}`;

    const itemData = {
      name,
      type,
      system: data,
    };

    delete itemData.system["type"];

    return await foundry.documents.Item.implementation.create(itemData, {
      parent: this.actor,
    });
  }

  _onRoll(event) {
    event.preventDefault();
    const element = event.currentTarget;
    const dataset = element.dataset;

    if (dataset.rollType === "item") {
      const id = element.closest('.item').dataset.itemId;
      const item = this.actor.items.get(id);
      return item?.roll();
    }

    if (dataset.roll) {
      const roll = new Roll(dataset.roll, this.actor.getRollData());
      return roll.toMessage({
        speaker: ChatMessage.getSpeaker({actor:this.actor}),
        flavor: dataset.label || "",
        rollMode: game.settings.get('core','rollMode'),
      });
    }
  }
}
