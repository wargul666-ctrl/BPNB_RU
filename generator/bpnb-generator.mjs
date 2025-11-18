/**
 * BPNB RU — ГЕНЕРАТОР ПЕРСОНАЖЕЙ
 * ИСПОЛЬЗУЕТ СТАНДАРТНУЮ АВАТАРКУ FOUNDRY → НИКАКИХ 404!
 * ВСЁ СОЗДАЁТСЯ ПОЛНОСТЬЮ — ЛИСТЫ РАБОТАЮТ!
 */

console.log("BPNB Generator | Загружен");

Hooks.once("ready", () => console.log("BPNB Generator | ready"));

Hooks.on("renderActorDirectory", (app, html) => {
  $(html).find(".bpnb-create-btn").remove();
  const btn = $('<button class="bpnb-create-btn" style="margin-right:8px;"><i class="fas fa-gun"></i> Создать BPNB</button>');
  btn.on("click", () => new BPNBGeneratorApp().render(true));
  $(html).find(".directory-header .header-actions").prepend(btn);
});

class BPNBGeneratorApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "bpnb-generator",
      title: "Генератор — Чёрный порох и Сера",
      template: "systems/bpnb-borg-ru/generator/templates/bpnb-generator-app.hbs",
      width: 540,
      height: 720,
      resizable: true
    });
  }

  async getData() {
    const base = "systems/bpnb-borg-ru/generator/data/";
    const [classes, subclasses, names, backgrounds, traits, gear] = await Promise.all([
      fetch(base + "classes.json?t=" + Date.now()).then(r => r.json()),
      fetch(base + "subclasses.json?t=" + Date.now()).then(r => r.json()),
      fetch(base + "names.json?t=" + Date.now()).then(r => r.json()),
      fetch(base + "backgrounds.json?t=" + Date.now()).then(r => r.json()),
      fetch(base + "traits.json?t=" + Date.now()).then(r => r.json()),
      fetch(base + "gear.json?t=" + Date.now()).then(r => r.json())
    ]);

    const classesWithSubs = classes.map(cls => ({
      ...cls,
      subclasses: subclasses.filter(s => s.class === cls.id)
    }));

    this.generatorData = { classes: classesWithSubs, names, backgrounds, traits, gear };
    return { classes: classesWithSubs };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const updateButton = () => {
      const any = html.find("input[type=checkbox]:checked").length > 0;
      html.find("#random-selected").text(any ? "Случайно из отмеченных" : "Случайно из всех");
    };
    html.find("input[type=checkbox]").on("change", updateButton);
    html.find("#random-all").on("click", () => this._generate(false));
    html.find("#random-selected").on("click", () => this._generate(true));
  }

  async _generate(onlySelected = false) {
    const data = this.generatorData;
    if (!data?.classes?.length) return ui.notifications.error("Данные не загружены!");

    const html = this.element;
    const checkedClassIds = html.find("input.class-checkbox:checked").map((_, el) => el.value).get();

    const pool = onlySelected && checkedClassIds.length > 0
      ? data.classes.filter(c => checkedClassIds.includes(c.id))
      : data.classes;

    if (pool.length === 0) return ui.notifications.warn("Нет архетипов!");

    const cls = pool[Math.floor(Math.random() * pool.length)];
    const subs = cls.subclasses || [];
    const checkedSubIds = html.find(`input.sub-checkbox[data-class="${cls.id}"]:checked`)
      .map((_, el) => el.dataset.subid).get();
    const subPool = checkedSubIds.length > 0 ? subs.filter(s => checkedSubIds.includes(s.id)) : subs;
    const sub = subPool.length > 0 ? subPool[Math.floor(Math.random() * subPool.length)] : null;

    const name = this._randomName(data.names);
    const trait = this._randomItem(data.traits);
    const bg = this._randomItem(data.backgrounds);

    const roll3d6 = () => Array.from({length: 3}, () => Math.floor(Math.random() * 6) + 1).reduce((a, b) => a + b, 0);
    const abilities = {
      str: { value: roll3d6() },
      agl: { value: roll3d6() },
      prs: { value: roll3d6() },
      tgh: { value: roll3d6() }
    };

    const classDisplay = sub ? `${cls.name} (${sub.name})` : cls.name;

    // ← ВОТ ЭТО ГЛАВНОЕ: СТАНДАРТНАЯ АВАТАРКА FOUNDRY — 100% СУЩЕСТВУЕТ!
    const defaultAvatar = "icons/svg/mystery-man.svg";

    const actorData = [{
      name: name,
      type: "character",
      img: defaultAvatar,
      system: {
        health: { value: 10, max: 10 },
        devils_luck: { value: 3, max: 3 },
        spell_cast_amount: { value: 0, max: 0 },
        biography: `<p><strong>Черта:</strong> ${trait}</p><p><strong>Фон:</strong> ${bg}</p>`,
        gp: Math.floor(Math.random() * 11) + 5,
        madness: 0,
        attributes: { level: { value: 1 } },
        class_name: classDisplay,
        subclass: sub?.name || "",
        abilities: abilities
      },
      items: [
        ...(data.gear.common || []).map(n => ({
          name: n,
          type: "item",
          system: { quantity: 1, weight: 0, gp: 0 }
        })),
        ...(data.gear.weapons?.[cls.id] || []).map(w => ({
          name: w,
          type: "weapon",
          system: { damage: "1d4", ranged: false, needs_ammo: false, ammunition: 0 }
        }))
      ]
    }];

    try {
      const created = await Actor.createDocuments(actorData, { renderSheet: true });
      ui.notifications.info(`Создан: ${created[0].name} — ${classDisplay}`);
      this.close();
    } catch (err) {
      ui.notifications.error("Ошибка создания!");
      console.error(err);
    }
  }

  _randomItem(arr) { return arr?.length ? arr[Math.floor(Math.random() * arr.length)] : "Неизвестно"; }
  _randomName(names) {
    const pool = [].concat(names.male || [], names.female || [], names.neutral || []);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : "Безымянный";
  }
}Ы