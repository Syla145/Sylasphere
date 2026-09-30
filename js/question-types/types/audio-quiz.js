(function () {
  'use strict';
  const Kit = window.SylasphereTypeKit;

  window.SylasphereTypes.register({
    type: 'audio-quiz',
    label: 'Audio-Quiz',
    icon: '♪',
    // v35: Erklärung für Spieler und Moderatoren (Neu-Karte, ?, Editor, spielmodi.html)
    help: {
      group: 'Musik & Audio',
      short: 'Hör genau hin und wähle die passende Antwort.',
      steps: [
        'Hör dir den Clip an.',
        'Tippe auf die richtige Antwort.'
      ],
      scoring: 'Richtig = volle Punkte, falsch = 0.',
      moderator: 'Für Songs, Geräusche, Stimmen oder Filmzitate. Vorbereiten: eine kurze Audiodatei (MP3) und 2–6 Antworten. Tipp: Lautstärke vorher testen und klären, wo der Ton läuft (Beamer-Boxen oder Handys).'
    },

    defaults: () => ({ options: Kit.defaultOptions(), correctAnswer: 'a', audio: './assets/demo-tone.mp3', audioLabel: 'Audio-Hinweis' }),

    normalize(q) {
      q.options = Kit.normalizeOptions(q.options || q.answers);
      if (q.correctAnswer == null && q.correct != null) q.correctAnswer = q.correct;
      q.audio = String(q.audio ?? q.audioUrl ?? q.sound ?? '');
      q.audioLabel = String(q.audioLabel ?? 'Audio-Hinweis');
    },

    validate(q, report) {
      Kit.validateOptions(q, report, { needsCorrect: true });
      if (!String(q.audio || '').trim()) report.error('audio', 'Audio-Quiz benötigt eine Audioquelle.');
      else Kit.validateMedia(q, 'audio', 'audio', report);
    },

    score(q, answer, { base }) {
      const correct = Kit.correctOption(q);
      const hit = Boolean(correct && String(answer ?? '') === String(correct.id));
      return { points: hit ? base : 0, detail: hit ? 'Richtig' : 'Falsch' };
    },

    solutionText(q) { const option = Kit.correctOption(q); return option ? option.text : String(q.correctAnswer ?? ''); },
    answerLabel(q, answer) { return Kit.optionById(q, answer)?.text || String(answer ?? ''); },

    render(q, container, ctx) {
      const correct = Kit.correctOption(q);
      Kit.renderChoice(q, container, ctx, { media: 'audio', winners: correct ? [correct.id] : [] });
    },

    editor(q, ui, box) {
      const grid = ui.div('dynamic-grid');
      grid.append(
        Kit.mediaField(q, ui, 'audio', 'Audioquelle', 'audio', './assets/musik/clip.mp3'),
        Kit.textField(q, ui, 'audioLabel', 'Audio-Label', 'z. B. Song-Snippet')
      );
      box.append(grid);
      Kit.choiceEditor(q, ui, box, 'correct');
    },
    stats: Kit.choiceStats
  });
})();
