/**
 * BPNB RU — ГЕНЕРАТОР ПЕРСОНАЖЕЙ
 * ОДНА КНОПКА | РАБОТАЕТ НА FOUNDRY V12–V14 | НИКАКИХ ДУБЛЕЙ
 */

console.log("BPNB Generator | Загружен");

// ← ТОЛЬКО ОДИН ХУК — БОЛЬШЕ НИЧЕГО НЕ ДОБАВЛЯЕМ!
Hooks.on("renderActorDirectory", (app, html) => {
  // Удаляем все возможные старые кнопки (от старой версии и от нас)
  $(html).find(".bpnb-create-btn").remove();

  const btn = $(`<button class="bpnb-create-btn" style="margin-right:8px;"><i class="fas fa-gun"></i> Создать BPNB</button>`);
  btn.on("click", () => new BPNBGeneratorApp().render(true));

  // Вставляем строго в .header-actions — именно туда, где была оригинальная кнопка
  $(html).find(".directory-header .header-actions").prepend(btn);
});

// ← СОВРЕМЕННЫЙ ApplicationV2 — БЕЗ ОШИБОК V1!
class BPNBGeneratorApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "bpnb-generator",
    window: {
      title: "Генератор — Чёрный порох и Сера",
      icon: "fas fa-gun",
      resizable: true
    },
    position: { width: 540, height: 760 }
  };

  // Загружаем все JSON-данные
  async _prepareContext() {
    const base = "systems/bpnb-borg-ru/generator/data/";
    try {
      const [classes, subclasses, names, backgrounds, traits, gear] = await Promise.all([
        fetch(`${base}classes.json?t=${Date.now()}`).then(r => r.json()),
        fetch(`${base}subclasses.json?t=${Date.now()}`).then(r => r.json()),
        fetch(`${base}names.json?t=${Date.now()}`).then(r => r.json()),
        fetch(`${base}backgrounds.json?t=${Date.now()}`).then(r => r.json()),
        fetch(`${base}traits.json?t=${Date.now()}`).then(r => r.json()),
        fetch(`${base}gear.json?t=${Date.now()}`).then(r => r.json())
      ]);

      const classesWithSubs = classes.map(cls => ({
        ...cls,
        subclasses: subclasses.filter(s => s.class === cls.id)
      }));

      // Сохраняем в this для _generate
      this.genData = { classes: classesWithSubs, names, backgrounds, traits, gear };

      return { classes: classesWithSubs };
    } catch (e) {
      ui.notifications.error("Не удалось загрузить данные генератора");
      console.error(e);
      return { classes: [] };
    }
  }

  // Подключаем события после рендера
  _onRender() {
    const html = this.element;

    const updateButtonText = () => {
      const checked = html.querySelectorAll("input[type=checkbox]:checked").length;
      const btn = html.querySelector("#random-selected");
      if (btn) btn.textContent = checked ? "Случайно из отмеченных" : "Случайно из всех";
    };

    html.querySelectorAll("input[type=checkbox]").forEach(ch => ch.addEventListener("change", updateButtonText));
    html.querySelector("#random-all")?.addEventListener("click", () => this._generate(false));
    html.querySelector("#random-selected")?.addEventListener("click", () => this._generate(true));

    updateButtonText();
  }

  // Основная функция создания персонажа
  async _generate(onlySelected = false) {
    const data = this.genData;
    if (!data?.classes?.length) return ui.notifications.error("Нет данных классов!");

    const checkedIds = Array.from(this.element.querySelectorAll("input.class-checkbox:checked"))
      .map(el => el.value);

    const pool = onlySelected && checkedIds.length
      ? data.classes.filter(c => checkedIds.includes(c.id))
      : data.classes;

    if (!pool.length) return ui.notifications.warn("Выбери хотя бы один архетип!");

    const cls = pool[Math.floor(Math.random() * pool.length)];
    const sub = cls.subclasses?.length
      ? cls.subclasses[Math.floor(Math.random() * cls.subclasses.length)]
      : null;

    const name = this._randomName(data.names);
    const trait = this._randomItem(data.traits);
    const background = this._randomItem(data.backgrounds);

    const roll3d6 = () => Array.from({length: 3}, () => Math.floor(Math.random() * 6) + 1).reduce((a, b) => a + b, 0);

    const actorData = {
      name,
      type: "character",
      img: "icons/svg/mystery-man.svg",
      system: {
        health: { value: 10, max: 10 },
        devils_luck: { value: 3, max: 3 },
        biography: `**Черта:** ${trait}\n**Фон:** ${background}`,
        gp: Math.floor(Math.random() * 11) + 5,
        class_name: sub ? `${cls.name} (${sub.name})` : cls.name,
        subclass: sub?.name || "",
        abilities: {
          str: { value: roll3d6() },
          agl: { value: roll3d6() },
          prs: { value: roll3d6() },
          tgh: { value: roll3d6() }
        }
      },
      items: [
        ...(data.gear.common || []).map(n => ({ name: n, type: "item", system: { quantity: 1 } })),
        ...(data.gear.weapons?.[cls.id] || []).map(w => ({ name: w, type: "weapon", system: { damage: "1d4" } }))
      ]
    };

    try {
      const actor = await Actor.create(actorData, { renderSheet: true });
      ui.notifications.info(`Создан: ${actor.name} — ${actor.system.class_name}`);
      this.close();
    } catch (err) {
      ui.notifications.error("Ошибка создания персонажа!");
      console.error(err);
    }
  }

  _randomItem(arr) { return arr?.length ? arr[Math.floor(Math.random() * arr.length)] : ""; }
  _randomName(names) {
    const pool = [...(names.male || []), ...(names.female || []), ...(names.neutral || [])];
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : "Безымянный";
  }
}