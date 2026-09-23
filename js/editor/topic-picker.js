(function () {
  'use strict';

  /*
   * Themen-Auswahl für den Editor (v15)
   * Knopf mit aktuellem Thema → Aufklappliste mit Suche:
   *   „In diesem Quiz“ (bereits verwendete/eigene Themen) + „Bibliothek“
   *   + „Neues Thema anlegen“, wenn die Suche nichts Passendes findet.
   */
  const Topics = () => window.SylasphereTopics;
  let openPicker = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function chip(topic, name) {
    const span = el('span', 'topic-chip');
    span.style.setProperty('--cat-hue', String(topic.hue));
    span.append(el('span', 'topic-chip-icon', topic.icon), el('span', 'topic-chip-name', name || topic.name));
    return span;
  }
  function close() {
    if (!openPicker) return;
    openPicker.popover.remove();
    openPicker.button.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', openPicker.outside, true);
    openPicker = null;
  }

  /**
   * options: {
   *   value: aktueller Themenname,
   *   quizTopics(): [Namen] – Themen, die im Quiz vorkommen/definiert sind,
   *   onSelect(name): Thema übernehmen,
   *   onCreate(name): neues eigenes Thema anlegen (danach wird onSelect aufgerufen)
   * }
   */
  function create(options) {
    const wrap = el('div', 'topic-picker');
    const button = el('button', 'topic-picker-btn');
    button.type = 'button';
    button.setAttribute('aria-haspopup', 'listbox');
    button.setAttribute('aria-expanded', 'false');
    const renderButton = value => {
      button.replaceChildren();
      if (value) button.append(chip(Topics().resolve(value), value));
      else button.append(el('span', 'topic-picker-placeholder', 'Thema wählen …'));
      button.append(el('span', 'topic-picker-caret', '▾'));
    };
    renderButton(options.value);

    button.addEventListener('click', () => {
      if (openPicker?.button === button) return close();
      close();
      const popover = el('div', 'topic-popover');
      popover.setAttribute('role', 'listbox');
      const search = el('input', 'input topic-search');
      search.type = 'search'; search.placeholder = 'Thema suchen oder neu eingeben'; search.autocomplete = 'off';
      const list = el('div', 'topic-list');
      popover.append(search, list);

      const choose = name => { close(); renderButton(name); options.onSelect(name); };
      const renderList = () => {
        const term = Topics().key(search.value);
        const matches = name => !term || Topics().key(name).includes(term);
        const quizNames = Array.from(new Set(options.quizTopics().filter(Boolean)));
        const quizKeys = new Set(quizNames.map(Topics().key));
        const libraryNames = Topics().library().map(t => t.name).filter(name => !quizKeys.has(Topics().key(name)));
        list.replaceChildren();
        const section = (title, names) => {
          const visible = names.filter(matches);
          if (!visible.length) return;
          list.append(el('div', 'topic-list-title', title));
          const grid = el('div', 'topic-grid');
          visible.forEach(name => {
            const item = el('button', 'topic-option');
            item.type = 'button'; item.setAttribute('role', 'option');
            if (Topics().key(name) === Topics().key(options.value)) item.classList.add('is-selected');
            item.append(chip(Topics().resolve(name), name));
            item.addEventListener('click', () => choose(name));
            grid.append(item);
          });
          list.append(grid);
        };
        section('In diesem Quiz', quizNames);
        section('Bibliothek', libraryNames);
        const typed = search.value.trim();
        const exists = typed && [...quizNames, ...Topics().library().map(t => t.name)].some(name => Topics().key(name) === Topics().key(typed));
        if (typed && !exists && !/[.#$\[\]\/]/.test(typed)) {
          const add = el('button', 'topic-create btn btn--small btn--primary', `＋ „${typed}“ als eigenes Thema anlegen`);
          add.type = 'button';
          add.addEventListener('click', () => { options.onCreate(typed); choose(typed); });
          list.append(add);
        }
        if (!list.children.length) list.append(el('div', 'microcopy', 'Keine Treffer.'));
      };
      search.addEventListener('input', renderList);
      search.addEventListener('keydown', event => {
        if (event.key === 'Escape') { close(); button.focus(); }
        if (event.key === 'Enter') { event.preventDefault(); list.querySelector('.topic-option, .topic-create')?.click(); }
      });
      renderList();
      wrap.append(popover);
      button.setAttribute('aria-expanded', 'true');
      const outside = event => { if (!wrap.contains(event.target)) close(); };
      document.addEventListener('pointerdown', outside, true);
      openPicker = { button, popover, outside };
      search.focus();
    });

    wrap.append(button);
    return wrap;
  }

  window.SylasphereTopicPicker = { create, chip, close };
})();
