/**
 * BPNB RU — ГЕНЕРАТОР ПЕРСОНАЖЕЙ
 * ДИАГНОСТИКА ХУКА + КНОПКА
 */

console.log("BPNB Generator | Модуль загружен!");

Hooks.once("ready", () => {
  console.log("BPNB Generator | ready сработал!");
});

// ТЕСТИРУЕМ ВСЕ ХУКИ
Hooks.on("renderActorDirectory", (app, html, data) => {
  console.log("BPNB Generator | renderActorDirectory сработал! app:", app.constructor.name, "html:", html);
  const $html = $(html);
  $html.find(".bpnb-create-actor").remove();

  const btn = $(`<button class="bpnb-create-actor control-button" style="margin-right: 8px;"><i class="fas fa-gun"></i> Создать BPNB</button>`);
  btn.on("click", () => {
    console.log("BPNB Generator | Кнопка нажата!");
    new BPNBGeneratorApp().render(true);
  });

  const headerActions = $html.find(".directory-header .header-actions");
  console.log("BPNB Generator | .header-actions найден:", headerActions.length);
  if (headerActions.length) {
    headerActions.prepend(btn);
    console.log("BPNB Generator | Кнопка вставлена в .header-actions");
  } else {
    const createBtn = $html.find("button.create-document");
    console.log("BPNB Generator | .create-document найден:", createBtn.length);
    if (createBtn.length) {
      createBtn.after(btn);
      console.log("BPNB Generator | Кнопка вставлена после .create-document");
    } else {
      $html.find(".directory-header").prepend(btn);
      console.log("BPNB Generator | Кнопка вставлена в .directory-header");
    }
  }
});

// АЛЬТЕРНАТИВНЫЙ ХУК — renderSidebarTab
Hooks.on("renderSidebarTab", (app, html, data) => {
  if (app.name !== "actors") return;
  console.log("BPNB Generator | renderSidebarTab сработал для actors!");
  const $html = $(html);
  $html.find(".bpnb-create-actor").remove();

  const btn = $(`<button class="bpnb-create-actor control-button" style="margin-right: 8px;"><i class="fas fa-gun"></i> Создать BPNB</button>`);
  btn.on("click", () => new BPNBGeneratorApp().render(true));

  const headerActions = $html.find(".directory-header .header-actions");
  if (headerActions.length) {
    headerActions.prepend(btn);
    console.log("BPNB Generator | Кнопка вставлена в .header-actions (renderSidebarTab)");
  } else {
    $html.find(".directory-header").prepend(btn);
  }
});

class BPNBGeneratorApp extends FormApplication {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "bpnb-generator",
      title: "Генератор — Чёрный порох и Сера",
      template: "systems/bpnb-borg-ru/generator/templates/bpnb-generator-app.hbs",
      width: 460,
      height: "auto",
      closeOnSubmit: false
    });
  }

  async getData() {
    console.log("BPNB Generator | getData() вызван");
    try {
      const base = "systems/bpnb-borg-ru/generator/data/";
      const [classes, subclasses, names, backgrounds, traits, gear] = await Promise.all([
        this._loadJson(base + "classes.json"),
        this._loadJson(base + "subclasses.json"),
        this._loadJson(base + "names.json"),
        this._loadJson(base + "backgrounds.json"),
        this._loadJson(base + "traits.json"),
        this._loadJson(base + "gear.json")
      ]);
      console.log("BPNB Generator | Данные загружены:", { classes: classes.length, subclasses: subclasses.length });
      return { classes, subclasses, names, backgrounds, traits, gear };
    } catch (err) {
      console.error("BPNB Generator | Ошибка загрузки JSON", err);
      return { classes: [], subclasses: [], names: {}, backgrounds: [], traits: [], gear: {} };
    }
  }

  async _loadJson(url) {
    try {
      const response = await fetch(url + "?t=" + Date.now());
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (err) {
      console.error(`BPNB Generator | Ошибка загрузки ${url}`, err);
      return [];
    }
  }

  activateListeners(html) {
    super.activateListeners(html);
    console.log("BPNB Generator | activateListeners сработал");

    const $checkboxes = html.find(".archetype-checkbox");
    const $random = html.find("#bpnb-random");
    const $create = html.find("#bpnb-create");
    const $preview = html.find("#bpnb-preview");

    $random.prop("disabled", false);
    $create.prop("disabled", false);

    $checkboxes.on("change", () => {
      const checked = $checkboxes.filter(":checked").length;
      $random.text(checked > 0 ? "Случайно из отмеченных" : "Случайно из всех");
    });

    $random.on("click", () => this._createRandomCharacter(html));
    $create.on("click", () => this._createRandomCharacter(html));
  }

  async _createRandomCharacter(html) {
    const $checkboxes = html.find(".archetype-checkbox");
    const $checked = $checkboxes.filter(":checked");
    let clsId;

    if ($checked.length > 0) {
      const $rand = $checked[Math.floor(Math.random() * $checked.length)];
      clsId = $rand.val();
    } else {
      const cls = this.object.classes[Math.floor(Math.random() * this.object.classes.length)];
      clsId = cls.id;
    }

    const cls = this.object.classes.find(c => c.id === clsId);
    if (!cls) return ui.notifications.warn("Архетип не найден!");

    const subs = this.object.subclasses.filter(s => s.class === clsId);
    const sub = subs.length ? subs[Math.floor(Math.random() * subs.length)] : null;

    const name = this._randomName();
    const trait = this._randomItem(this.object.traits);
    const bg = this._randomItem(this.object.backgrounds);

    const roll3d6 = () => Array.from({length: 3}, () => Math.floor(Math.random() * 6) + 1).reduce((a, b) => a + b, 0);
    const abilities = { str: { value: roll3d6() }, agl: { value: roll3d6() }, prs: { value: roll3d6() }, tgh: { value: roll3d6() } };

    const items = [];
    (this.object.gear.common || []).forEach(n => items.push({ name: n, type: "item", system: { quantity: 1, weight: 0, gp: 0 } }));
    (this.object.gear.weapons?.[clsId] || []).forEach(n => items.push({ name: n, type: "weapon", system: { damage: "1d4", ranged: false, needs_ammo: false, ammunition: 0, gp: 0 } }));

    const classDisplay = sub ? `${cls.name} (${sub.name})` : cls.name;
    const bioText = `**Черта:** ${trait}\n**Фон:** ${bg}`;

    const actorData = {
      name,
      type: "character",
      system: {
        health: { value: 10, min: 0, max: 10 },
        devils_luck: { value: 0, min: 0, max: 10 },
        spell_cast_amount: { value: 0, min: 0, max: 0 },
        biography: bioText,
        gp: 0,
        attributes: { level: { value: 1 } },
        class_name: classDisplay,
        subclass: sub?.name || "",
        madness: 0,
        abilities
      },
      items
    };

    try {
      const actor = await Actor.create(actorData, { renderSheet: true });
      ui.notifications.info(`Создан: ${actor.name} — ${classDisplay}`);
      this.close();
    } catch (err) {
      ui.notifications.error("Ошибка создания");
      console.error(err);
    }
  }

  _randomItem(arr) { return arr.length ? arr[Math.floor(Math.random() * arr.length)] : ""; }
  _randomName() {
    const pool = [].concat(this.object.names.male || [], this.object.names.female || [], this.object.names.neutral || []);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : "Безымянный";
  }

  _updateObject() {}
}