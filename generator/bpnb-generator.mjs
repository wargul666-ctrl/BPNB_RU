/**
 * systems/bpnb-borg-ru/generator/bpnb-generator.mjs
 * Исправленная версия генератора — устойчивее к namespace-изменениям Foundry v13+
 *
 * Основные изменения:
 * - Используем foundry.applications.FormApplication если доступно,
 *   в противном случае падаем обратно на глобальную FormApplication.
 * - Создание Actor выполняется через предпочтительный API (implementation.create), с fallback-ами.
 * - Улучшено логирование и обработка ошибок.
 */

console.log("BPNB Generator | Загружен (патч v13+)");

const AppForm = foundry?.applications?.FormApplication ?? (typeof FormApplication !== "undefined" ? FormApplication : undefined);
const AppDialog = foundry?.applications?.Dialog ?? (typeof Dialog !== "undefined" ? Dialog : undefined);

function _createActorSafe(actorData, options = {}) {
  // Try the recommended v13+ API first, then fall back to other available methods.
  // Возвращает Promise<Actor>
  try {
    // recommended: Actor.implementation.create({...})
    if (typeof Actor !== "undefined" && Actor?.implementation?.create) {
      return Actor.implementation.create(actorData, options);
    }
  } catch (ignored) {}

  try {
    // fallback: foundry.documents.Actor?.implementation?.create
    if (foundry?.documents?.Actor?.implementation?.create) {
      return foundry.documents.Actor.implementation.create(actorData, options);
    }
  } catch (ignored) {}

  try {
    // fallback older: Actor.create(...)
    if (typeof Actor !== "undefined" && typeof Actor.create === "function") {
      return Actor.create(actorData, options);
    }
  } catch (ignored) {}

  try {
    // last-resort: game.actors.create(...)
    if (game?.actors && typeof game.actors.create === "function") {
      return game.actors.create(actorData, options);
    }
  } catch (ignored) {}

  return Promise.reject(new Error("No available Actor creation API found"));
}

Hooks.once("ready", () => {
  console.log("BPNB Generator | ready");
});

/* -------------------------
   Вставляем кнопку в панель Actors (совместимо для v13+)
   ------------------------- */
Hooks.on("renderSidebarTab", (app, html) => {
  // вставляем только в панель актёров (id = "actors")
  if (app?.id !== "actors") return;

  try {
    console.log("BPNB Generator | Sidebar actors tab detected");

    const $html = $(html);

    // Удаляем предыдущую кнопку, если она осталась
    $html.find(".bpnb-create-actor").remove();

    const btn = $(
      `<button class="bpnb-create-actor control-button" style="margin-right:8px;">
         <i class="fas fa-dice-d20"></i> Создать BP&B
       </button>`
    );

    btn.on("click", (ev) => {
      ev.preventDefault();
      // Открываем приложение генератора (в асинхронной обёртке — чтобы можно было ловить ошибки)
      (async () => {
        try {
          const app = new BPNBGeneratorApp();
          await app.render(true);
        } catch (err) {
          console.error("BPNB Generator | Ошибка при открытии генератора", err);
          ui.notifications.error("Не удалось открыть генератор. Смотри консоль.");
        }
      })();
    });

    // Вставляем в header actions, если есть; иначе в начало вкладки
    const headerActions = $html.find(".directory-header .header-actions");
    if (headerActions.length) headerActions.prepend(btn);
    else $html.find(".directory-header").prepend(btn);

  } catch (err) {
    console.error("BPNB Generator | Ошибка при вставке кнопки в SidebarTab", err);
  }
});

/* -------------------------
   Форма / приложение генератора
   ------------------------- */
class BPNBGeneratorApp extends (AppForm || FormApplication) {
  static get defaultOptions() {
    // mergeObject может быть namespaced, используем foundry.utils.mergeObject если доступно
    const merge = foundry?.utils?.mergeObject ?? (typeof mergeObject !== "undefined" ? mergeObject : (a, b) => Object.assign({}, a, b));
    return merge(super.defaultOptions ?? {}, {
      id: "bpnb-generator",
      title: "Генератор персонажей — Чёрный порох & Сера (RU)",
      template: "systems/bpnb-borg-ru/generator/templates/bpnb-generator-app.hbs",
      width: 520,
      height: "auto",
      closeOnSubmit: false
    });
  }

  /** Загружаем данные (JSON) и сохраняем в this.dataCache / this.object */
  async getData(options) {
    // Если уже загружено — вернуть
    if (this.dataCache) return this.dataCache;

    const base = "systems/bpnb-borg-ru/generator/data/";
    const files = {
      classes: "classes.json",
      subclasses: "subclasses.json",
      names: "names.json",
      backgrounds: "backgrounds.json",
      traits: "traits.json",
      gear: "gear.json"
    };

    const out = {};
    for (const [k, f] of Object.entries(files)) {
      try {
        const resp = await fetch(base + f + "?t=" + Date.now());
        if (!resp.ok) {
          console.warn(`BPNB Generator | Не удалось загрузить ${f}: HTTP ${resp.status}`);
          out[k] = (k === "names") ? {} : [];
        } else {
          out[k] = await resp.json();
        }
      } catch (err) {
        console.error("BPNB Generator | Ошибка загрузки JSON", f, err);
        out[k] = (k === "names") ? {} : [];
      }
    }

    // кешируем
    this.dataCache = out;
    // также выставим object для удобства
    this.object = out;
    return out;
  }

  activateListeners(html) {
    super.activateListeners(html);
    this.$html = html;

    // элементы
    this.$class = html.find("#bpnb-class-select");
    this.$subclass = html.find("#bpnb-subclass-select");
    this.$random = html.find("#bpnb-random");
    this.$create = html.find("#bpnb-create");
    this.$preview = html.find("#bpnb-preview");

    // заполнение селектов (если данные уже загружены)
    this._populateClassSelect().catch(err => console.error("BPNB Generator | _populateClassSelect error:", err));

    // события
    if (this.$class && this.$class.length) {
      this.$class.on("change", () => {
        this._populateSubclasses();
        this._updatePreview();
      });
    }
    if (this.$subclass && this.$subclass.length) {
      this.$subclass.on("change", () => this._updatePreview());
    }

    if (this.$random && this.$random.length) {
      this.$random.on("click", async (ev) => {
        ev.preventDefault();
        await this._doRandom();
      });
    }

    if (this.$create && this.$create.length) {
      this.$create.on("click", async (ev) => {
        ev.preventDefault();
        await this._createFromSelection();
      });
    }
  }

  /* -------------------------
     Заполнить селект классов
     ------------------------- */
  async _populateClassSelect() {
    const data = await this.getData();
    const classes = data.classes || [];
    if (!this.$class || !this.$class.length) return;
    this.$class.empty();
    classes.forEach(c => {
      this.$class.append(`<option value="${c.id}">${c.name}</option>`);
    });
    // после заполнения классов — заполнить подклассы для текущего класса
    this._populateSubclasses();
    this._updatePreview();
  }

  /* -------------------------
     Заполнить селект подклассов в зависимости от выбранного класса
     ------------------------- */
  _populateSubclasses() {
    if (!this.$class || !this.$subclass) return;
    const classId = this.$class.val();
    const subs = (this.dataCache.subclasses || []).filter(s => s.class === classId);
    this.$subclass.empty();
    if (!subs.length) {
      this.$subclass.append(`<option value="">- отсутствует -</option>`);
      return;
    }
    subs.forEach(s => this.$subclass.append(`<option value="${s.id}">${s.name}</option>`));
  }

  _updatePreview() {
    if (!this.$class || !this.$subclass || !this.$preview) return;
    const classId = this.$class.val();
    const subId = this.$subclass.val();
    const cls = (this.dataCache.classes || []).find(c => c.id === classId);
    const sub = (this.dataCache.subclasses || []).find(s => s.id === subId);
    const txt = `Класс: ${cls ? cls.name : "-"}\nПодкласс: ${sub ? sub.name : "-"}`;
    this.$preview.text(txt);
  }

  /* -------------------------
     Случайный выбор класса и подкласса
     ------------------------- */
  async _doRandom() {
    await this.getData();
    const classes = this.dataCache.classes || [];
    if (!classes.length) return;
    const cls = classes[Math.floor(Math.random() * classes.length)];
    if (this.$class) {
      this.$class.val(cls.id).trigger("change");
    }

    // выбрать случайный подкласс
    const subs = (this.dataCache.subclasses || []).filter(s => s.class === cls.id);
    if (subs.length) {
      const s = subs[Math.floor(Math.random() * subs.length)];
      if (this.$subclass) this.$subclass.val(s.id).trigger("change");
    } else {
      if (this.$subclass) this.$subclass.val("");
    }
    this._updatePreview();
  }

  /* -------------------------
     Создать персонажа на основе текущего выбора
     ------------------------- */
  async _createFromSelection() {
    await this.getData();

    const classId = this.$class ? this.$class.val() : null;
    const subId = this.$subclass ? this.$subclass.val() : null;

    const cls = (this.dataCache.classes || []).find(c => c.id === classId);
    const sub = (this.dataCache.subclasses || []).find(s => s.id === subId);

    if (!cls) {
      ui.notifications?.warn("Выберите класс!");
      return;
    }

    // Имя — из names.json
    const name = this._randomName();

    // Черта/фон
    const trait = this._randomItem(this.dataCache.traits || []);
    const bg = this._randomItem(this.dataCache.backgrounds || []);

    // Характеристики — 3d6 каждая
    const roll3d6 = () => Array.from({ length: 3 }, () => Math.floor(Math.random() * 6) + 1).reduce((a, b) => a + b, 0);
    const abilities = {
      str: { value: roll3d6() },
      agl: { value: roll3d6() },
      prs: { value: roll3d6() },
      tgh: { value: roll3d6() }
    };

    // Инвентарь — common + class-specific
    const items = [];
    (this.dataCache.gear?.common || []).forEach(n => {
      items.push({
        name: n,
        type: "item",
        system: { description: "", gp: 0, quantity: 1, weight: 0 }
      });
    });
    const classWeapons = (this.dataCache.gear?.weapons?.[cls.id]) || [];
    classWeapons.forEach(n => {
      items.push({
        name: n,
        type: "weapon",
        system: { description: "", gp: 0, damage: "1d4", ranged: false, needs_ammo: false, ammunition: 0 }
      });
    });

    // Подготовка данных актёра
    const actorData = {
      name,
      type: "character",
      system: {
        health: { value: 10, min: 0, max: 10 },
        devils_luck: { value: 0, min: 0, max: 10 },
        spell_cast_amount: { value: 0, min: 0, max: 0 },
        biography: `**Подкласс:** ${sub ? sub.name : "-"}\n**Черта:** ${trait}\n**Фон:** ${bg}`,
        gp: 0,
        attributes: { level: { value: 1 } },
        class_name: cls.name || "",
        subclass: sub ? sub.name : "",
        madness: 0,
        abilities
      },
      items
    };

    try {
      const actor = await _createActorSafe(actorData, { renderSheet: true });
      ui.notifications?.info(`Создан персонаж: ${actor.name} — ${cls.name}${sub ? " / " + sub.name : ""}`);
      this.close();
    } catch (err) {
      console.error("BPNB Generator | Ошибка создания актёра", err);
      ui.notifications?.error("Ошибка создания персонажа. Смотри консоль.");
    }
  }

  _randomItem(arr) {
    return (arr && arr.length) ? arr[Math.floor(Math.random() * arr.length)] : "";
  }

  _randomName() {
    const names = this.dataCache.names || {};
    const pool = [].concat(names.male || [], names.female || [], names.neutral || []);
    return pool.length ? pool[Math.floor(Math.random() * pool.length)] : "Безымянный";
  }

  // FormApplication требует реализации _updateObject, но нам не нужно её использовать
  async _updateObject(event, formData) {
    return;
  }
}
