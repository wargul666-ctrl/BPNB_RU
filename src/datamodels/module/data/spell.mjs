import Bpnb_borgItemBase from "./item-base.mjs";

export default class Bpnb_borgSpell extends Bpnb_borgItemBase {

  static defineSchema() {
    const fields = foundry.data.fields;
    const schema = super.defineSchema();

    schema.spellLevel = new fields.NumberField({ required: true, nullable: false, integer: true, initial: 1, min: 1, max: 9 });

    return schema;
  }
}