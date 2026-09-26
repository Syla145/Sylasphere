(function () {
  'use strict';

  /*
   * Design-Vorschau (v29) – vorschau.html
   * ------------------------------------------------------------------
   * Zeigt ein Theme mit Beispielfrage, Rangliste (lange Namen, Stufen-Abzeichen),
   * Übergang, Sound-Paket und Siegerehrung. Im Editor als Rahmen eingebettet
   * (?theme=<id>&embed=1), sonst mit Auswahl oben rechts.
   */
  const App = window.SchmobinApp;
  const Themes = window.SylasphereThemes;
  const esc = value => App.escapeHTML(value);
  const $ = id => document.getElementById(id);
  const PLAYERS = [
    { id: 'a', name: 'Bernadette-Sophie Langername', avatar: '🦁', score: 1240, account: true, xp: 2400 },
    { id: 'b', name: 'Max', avatar: '🦊', score: 1180, account: true, xp: 180 },
    { id: 'c', name: 'Quizkönigin Clara', avatar: '🐸', score: 960 },
    { id: 'd', name: 'Ömer', avatar: '🤖', score: 720, account: true, xp: 60 },
    { id: 'e', name: 'Jo', avatar: '🐧', score: 400 }
  ];
  const QUESTION = { id: 'preview', type: 'multiple-choice', text: 'Wie heißt die Hauptstadt von Australien?', category: 'Geografie', points: 100, timer: 20, options: [{ id: 'a', text: 'Sydney' }, { id: 'b', text: 'Canberra' }, { id: 'c', text: 'Melbourne' }, { id: 'd', text: 'Perth' }], correctOptionId: 'b' };

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    const params = new URLSearchParams(location.search);
    if (params.get('embed')) document.body.classList.add('is-embed');
    const select = $('preview-theme');
    select.innerHTML = Themes.list().map(t => `<option value="${esc(t.id)}">${esc(t.name)}</option>`).join('');
    select.value = Themes.current();
    select.addEventListener('change', () => { const url = new URL(location.href); url.searchParams.set('theme', select.value); location.replace(url.href); });
    await window.SylasphereTypes?.ready;
    renderQuestion();
    renderRanking();
    describe();
    document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => show(b.dataset.view)));
    document.querySelector('[data-action="transition"]').addEventListener('click', () => Themes.transition({ kind: 'round', kicker: 'Runde 2 von 3', title: 'Geografie', sub: 'Frage 5 von 12', round: 2, question: 5, total: 12 }));
    document.querySelector('[data-action="sounds"]').addEventListener('click', playSounds);
    show(params.get('view') === 'ceremony' ? 'ceremony' : 'question');
  }

  function describe() {
    const theme = Themes.get(Themes.current());
    const fx = Themes.fx();
    const parts = [theme?.description, fx.sounds ? 'eigene Sounds' : 'Standard-Sounds', fx.transition ? 'eigener Übergang' : 'Standard-Übergang', fx.ceremony ? 'eigene Siegerehrung' : 'Standard-Siegerehrung'];
    $('preview-desc').textContent = `${theme?.name || ''}: ${parts.filter(Boolean).join(' · ')}`;
  }

  function renderQuestion() {
    const host = $('preview-q');
    try {
      const question = window.SchmobinQuiz.normalizeQuiz({ quiz: { title: 'Vorschau', rounds: [{ questions: [QUESTION] }] } }).quiz.rounds[0].questions[0];
      window.SchmobinRenderers.renderPlayer(question, host, { currentAnswer: 'b', readOnly: true, reveal: true, playerId: 'b' });
    }
    catch (error) { host.innerHTML = `<h2 class="question-title">${esc(QUESTION.text)}</h2>`; }
  }

  function renderRanking() {
    $('preview-ranking').innerHTML = PLAYERS.map((p, i) => `<div class="leader-row ${p.id === 'b' ? 'is-me' : ''}" data-rank="${i + 1}"><span>${i + 1}</span><span class="avatar small">${esc(p.avatar)}</span><strong>${esc(p.name)}${window.SylasphereProgress?.badge(p) || ''}</strong><span class="leader-score">${i === 1 ? '<em>+100</em>' : ''}<b>${p.score} P</b></span></div>`).join('');
  }

  function show(view) {
    const ceremony = view === 'ceremony';
    $('preview-question').hidden = ceremony;
    $('preview-ceremony').hidden = !ceremony;
    document.querySelectorAll('[data-view]').forEach(b => b.classList.toggle('btn--primary', b.dataset.view === view));
    if (ceremony) {
      $('preview-ceremony').innerHTML = `<div class="panel panel-pad">${Themes.ceremony(PLAYERS, { role: 'spectator', eyebrow: 'Finale', title: `🏆 ${esc(PLAYERS[0].name)} gewinnt!` })}</div>`;
      window.SylasphereSfx?.play('fanfare');
    }
  }

  function playSounds() {
    const sfx = window.SylasphereSfx;
    if (!sfx) return;
    if (!sfx.enabled()) sfx.setEnabled(true);
    const list = [['open', 0], ['tick', 900], ['tick', 1400], ['last', 1900], ['lock', 2500], ['buzz', 3300], ['correct', 4200], ['wrong', 5200], ['reveal', 6300], ['transition', 7500], ['fanfare', 9000]];
    list.forEach(([name, at]) => setTimeout(() => sfx.play(name), at));
    App.toast('Sounds: Frage offen, Countdown, geschlossen, Buzzer, richtig, falsch, Auflösung, Übergang, Finale', 'info');
  }
})();
