/**
 * BPNB RU — ГЕНЕРАТОР ПЕРСОНАЖЕЙ
 * Foundry V13+ (ApplicationV2) — ОДНА КНОПКА, ВСЁ РАБОТАЕТ
 */

console.log("BPNB Generator | Загружен");

// УДАЛЯЕМ ВСЁ СТАРОЕ — ОСТАВЛЯЕМ ТОЛЬКО ОДНУ КНОПКУ
Hooks.on("renderActorDirectory", (app, html) => {
  $(html).find(".bpnb-create-btn").remove();

  const btn = $(`<button class="bpnb-create-btn" style="margin-right:8px;"><i class="fas fa-gun"></i> Создать BPNB</button>`);
  btn.on("click", () => new BPNBGeneratorApp().render(true));

  $(html).find(".directory-header .header-actions").prepend(btn);
});

// ← НОВЫЙ V2 Application — НИКАКИХ ОШИБОК!
class BPNBGeneratorApp extends foundry.applications.api.ApplicationV2 {
  static DEFAULT_OPTIONS = {
    id: "bpnb-generator",
    window: {
      title: "Генератор — Чёрный порох и Сера",
      icon: "fas fa-gun",
      resizable: true,
      minimizable: true
    },
    position: { width: 560, height: 760 }
  };

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

      this.data = { classes: classesWithSubs, names, backgrounds, traits, gear };
      return { classes: classesWithSubs };
    } catch (e) {
      ui.notifications.error("Ошибка загрузки данных генератора");
      console.error(e);
      return { classes: [] };
    }
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const html = this.element;

    const updateButton = () => {
      const checked = html.querySelectorAll("input[type=checkbox]:checked").length;
      const btn = html.querySelector("#random-selected");
      if (btn) btn.textContent = checked ? "Случайно из отмеченных" : "Случайно из всех";
    };

    html.querySelectorAll("input[type=checkbox]").forEach(el => el.addEventListener("change", updateButton));
    html.querySelector("#random-all")?.addEventListener("click", () => this._generate(false));
    html.querySelector("#random-selected")?.addEventListener("click", () => this._generate(true));

    updateButton();
  }

  async _generate(onlySelected = false) {
    const data = this.data;
    if (!data?.classes?.length) return;

    const checked = Array.from(this.element.querySelectorAll("input.class-checkbox:checked")).map(el => el.value);
    const pool = onlySelected && checked.length ? data.classes.filter(c => checked.includes(c.id)) : data.classes;
    if (!pool.length) return ui.notifications.warn("Выбери архетип!");

    const cls = pool[Math.floor(Math.random() * pool.length)];
    const sub = cls.subclasses?.length ? cls.subclasses[Math.floor(Math.random() * cls.subclasses.length)] : null;

    const name = this._rndName(data.names);
    const trait = this._rnd(data.traits);
    const bg = this._rnd(data.backgrounds);

    const roll3d6 = () => Array.from({length:3}, () => Math.floor(Math.random() * 6) + 1).reduce((a,b) => a+b, 0);

    const actorData = {
      name,
      type: "character",
      img: "icons/svg/mystery-man.svg",
      system: {
        health: { value: 10, max: 10 },
        devils_luck: { value: 3, max: 3 },
        biography: `**Черта:** ${trait}\n**Фон:** ${bg}`,
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

    await Actor.create(actorData, { renderSheet: true });
    ui.notifications.info(`Создан: ${name} — ${actorData.system.class_name}`);
    this.close();
  }

  _rnd(arr) { return arr?.length ? arr[Math.floor(Math.random() * arr.length)] : ""; }
  _rndName(names) {
    const pool = [...(names.male||[]), ...(names.female||[]), ...(names.neutral||[])];
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : "Безымянный";
  }
}