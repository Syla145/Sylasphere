(function () {
  'use strict';

  /*
   * Editor-Datenlogik (v30) – ohne DOM, damit sie in Node getestet werden kann
   * ------------------------------------------------------------------
   * Arbeitet direkt auf dem normalisierten Quiz ({ quiz: { rounds: [{ questions: [] }] } }).
   * Auswahl (selection): { kind: 'quiz' } | { kind: 'round', ri } | { kind: 'question', ri, qi }
   * Das Datenformat der Quizze bleibt unverändert.
   */
  const uid = prefix => (window.SchmobinApp?.uid ? window.SchmobinApp.uid(prefix) : `${prefix}_${Math.random().toString(36).slice(2, 10)}`);
  const clone = value => JSON.parse(JSON.stringify(value));
  const rounds = state => state?.quiz?.rounds || [];

  /** Alle Fragen der Reihe nach: [{ ri, qi, question, n }] (n = fortlaufende Nummer ab 1) */
  function flat(state) {
    const out = [];
    rounds(state).forEach((round, ri) => (round.questions || []).forEach((question, qi) => out.push({ ri, qi, question, n: out.length + 1 })));
    return out;
  }
  const total = state => flat(state).length;
  function questionAt(state, sel) { return sel?.kind === 'question' ? rounds(state)[sel.ri]?.questions?.[sel.qi] || null : null; }
  /** Laufende Nummer einer Frage (1 …) */
  function numberOf(state, ri, qi) { return flat(state).find(x => x.ri === ri && x.qi === qi)?.n || 0; }

  /** Auswahl gültig halten (nach Löschen/Verschieben) */
  function clampSelection(state, sel) {
    const rs = rounds(state);
    if (!sel || sel.kind === 'quiz' || !rs.length) return { kind: 'quiz' };
    const ri = Math.max(0, Math.min(rs.length - 1, Number(sel.ri) || 0));
    if (sel.kind === 'round') return { kind: 'round', ri };
    const qs = rs[ri].questions || [];
    if (!qs.length) return { kind: 'round', ri };
    return { kind: 'question', ri, qi: Math.max(0, Math.min(qs.length - 1, Number(sel.qi) || 0)) };
  }
  /** Auswahl einer Frage über ihre ID (bleibt nach Verschieben erhalten) */
  function selectionById(state, id) {
    const hit = flat(state).find(x => x.question.id === id);
    return hit ? { kind: 'question', ri: hit.ri, qi: hit.qi } : null;
  }
  /** vorige/nächste Frage über Rundengrenzen hinweg (delta −1/+1) */
  function step(state, sel, delta) {
    const list = flat(state);
    if (!list.length) return sel;
    let index = sel?.kind === 'question' ? list.findIndex(x => x.ri === sel.ri && x.qi === sel.qi) : -1;
    if (index < 0) {
      // Runde/Quiz gewählt: erste Frage dieser Runde bzw. des Quiz
      const first = sel?.kind === 'round' ? list.find(x => x.ri === sel.ri) : list[0];
      return first ? { kind: 'question', ri: first.ri, qi: first.qi } : sel;
    }
    index = Math.max(0, Math.min(list.length - 1, index + delta));
    return { kind: 'question', ri: list[index].ri, qi: list[index].qi };
  }

  // ---------------------------------------------------------------- Verschieben
  /** Frage von (ri, qi) an Position toIndex in Runde toRi (Index bezogen auf die Liste VOR dem Entfernen) */
  function moveQuestion(state, ri, qi, toRi, toIndex) {
    const rs = rounds(state);
    const from = rs[ri]?.questions;
    const target = rs[toRi]?.questions;
    if (!from || !target || qi < 0 || qi >= from.length) return null;
    let index = Math.max(0, Math.min(target.length, Number(toIndex)));
    const [question] = from.splice(qi, 1);
    if (ri === toRi && index > qi) index -= 1;
    target.splice(index, 0, question);
    return { kind: 'question', ri: toRi, qi: index };
  }
  /** Alt+↑/↓: eine Position hoch/runter, am Rundenrand in die Nachbarrunde */
  function nudgeQuestion(state, ri, qi, delta) {
    const rs = rounds(state);
    const qs = rs[ri]?.questions || [];
    if (delta < 0) {
      if (qi > 0) return moveQuestion(state, ri, qi, ri, qi - 1);
      if (ri > 0) return moveQuestion(state, ri, qi, ri - 1, rs[ri - 1].questions.length);
    } else {
      if (qi < qs.length - 1) return moveQuestion(state, ri, qi, ri, qi + 2);
      if (ri < rs.length - 1) return moveQuestion(state, ri, qi, ri + 1, 0);
    }
    return { kind: 'question', ri, qi };
  }
  function moveRound(state, ri, toIndex) {
    const rs = rounds(state);
    if (ri < 0 || ri >= rs.length) return null;
    let index = Math.max(0, Math.min(rs.length, Number(toIndex)));
    const [round] = rs.splice(ri, 1);
    if (index > ri) index -= 1;
    rs.splice(index, 0, round);
    return { kind: 'round', ri: index };
  }

  // ---------------------------------------------------------------- Duplizieren, Löschen, Einfügen
  function freshIds(question) {
    question.id = uid('q');
    if (Array.isArray(question.cards)) question.cards = question.cards.map(card => Object.assign({}, card, { id: uid('card') }));
    return question;
  }
  function duplicateQuestion(state, ri, qi) {
    const qs = rounds(state)[ri]?.questions;
    if (!qs?.[qi]) return null;
    const copy = freshIds(clone(qs[qi]));
    copy.text = `${copy.text} (Kopie)`;
    qs.splice(qi + 1, 0, copy);
    return { kind: 'question', ri, qi: qi + 1 };
  }
  function deleteQuestion(state, ri, qi) {
    const qs = rounds(state)[ri]?.questions;
    if (!qs?.[qi]) return null;
    qs.splice(qi, 1);
    return clampSelection(state, qs.length ? { kind: 'question', ri, qi: Math.min(qi, qs.length - 1) } : { kind: 'round', ri });
  }
  function duplicateRound(state, ri) {
    const rs = rounds(state);
    if (!rs[ri]) return null;
    const copy = clone(rs[ri]);
    copy.id = uid('round');
    copy.title = `${copy.title} (Kopie)`;
    copy.questions.forEach(freshIds);
    rs.splice(ri + 1, 0, copy);
    return { kind: 'round', ri: ri + 1 };
  }
  function deleteRound(state, ri) {
    const rs = rounds(state);
    if (!rs[ri]) return null;
    rs.splice(ri, 1);
    return rs.length ? { kind: 'round', ri: Math.min(ri, rs.length - 1) } : { kind: 'quiz' };
  }
  function addRound(state, afterRi) {
    const rs = rounds(state);
    const index = Number.isInteger(afterRi) ? afterRi + 1 : rs.length;
    rs.splice(index, 0, { id: uid('round'), title: `Runde ${rs.length + 1}`, pointsMultiplier: 1, questions: [] });
    return { kind: 'round', ri: index };
  }
  /** Neue Frage hinter der Auswahl einfügen (Frage → dahinter, Runde → ans Ende, Quiz → letzte Runde) */
  function insertQuestion(state, sel, question) {
    const rs = rounds(state);
    if (!rs.length) rs.push({ id: uid('round'), title: 'Runde 1', pointsMultiplier: 1, questions: [] });
    let ri = rs.length - 1, index = rs[ri].questions.length;
    if (sel?.kind === 'question' && rs[sel.ri]) { ri = sel.ri; index = sel.qi + 1; }
    else if (sel?.kind === 'round' && rs[sel.ri]) { ri = sel.ri; index = rs[ri].questions.length; }
    const previous = rs[ri].questions[index - 1];
    if (previous?.category && !question.category) question.category = previous.category;
    rs[ri].questions.splice(index, 0, question);
    return { kind: 'question', ri, qi: index };
  }
  /** Typwechsel: Fragetext, Thema, Punkte, Timer und ID bleiben, alles Typ-Spezifische kommt neu */
  const KEEP_ON_TYPE_CHANGE = ['id', 'category', 'text', 'points', 'timer'];
  function changeType(state, ri, qi, fresh) {
    const qs = rounds(state)[ri]?.questions;
    if (!qs?.[qi]) return null;
    KEEP_ON_TYPE_CHANGE.forEach(key => { if (qs[qi][key] !== undefined) fresh[key] = qs[qi][key]; });
    qs[qi] = fresh;
    return { kind: 'question', ri, qi };
  }

  // ---------------------------------------------------------------- Prüfung → ⚠️ in der Gliederung
  /**
   * Ordnet die Meldungen aus dem Quiz-Check den Fragen/Runden zu.
   * → { questions: Map('ri:qi' → [{ kind, message, field }]), rounds: Map(ri → [...]), quiz: [...] }
   */
  function issues(validation) {
    const out = { questions: new Map(), rounds: new Map(), quiz: [] };
    const add = (map, key, item) => { if (!map.has(key)) map.set(key, []); map.get(key).push(item); };
    [...(validation?.errors || []).map(x => ({ ...x, kind: 'error' })), ...(validation?.warnings || []).map(x => ({ ...x, kind: 'warning' }))].forEach(item => {
      const q = /^quiz\.rounds\[(\d+)\]\.questions\[(\d+)\](?:\.(.+))?$/.exec(item.path || '');
      if (q) { add(out.questions, `${q[1]}:${q[2]}`, { kind: item.kind, message: item.message, field: q[3] || '' }); return; }
      const r = /^quiz\.rounds\[(\d+)\]/.exec(item.path || '');
      if (r) { add(out.rounds, Number(r[1]), { kind: item.kind, message: item.message, field: '' }); return; }
      out.quiz.push({ kind: item.kind, message: item.message, field: item.path || '' });
    });
    return out;
  }

  /** Kurzer Text für eine Gliederungszeile */
  function preview(text, max = 60) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    if (!clean) return '(ohne Fragetext)';
    return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
  }

  // ---------------------------------------------------------------- Antwort-Kennungen
  /** Nächste freie Kennung (a, b, c … z, a2 …) – bestehende Kennungen bleiben unverändert */
  function nextOptionId(options) {
    const used = new Set((options || []).map(o => String(o.id)));
    for (let round = 1; round < 50; round++) {
      for (let i = 0; i < 26; i++) {
        const id = String.fromCharCode(97 + i) + (round > 1 ? round : '');
        if (!used.has(id)) return id;
      }
    }
    return uid('o');
  }

  window.SylasphereEditorModel = {
    flat, total, questionAt, numberOf, clampSelection, selectionById, step,
    moveQuestion, nudgeQuestion, moveRound, duplicateQuestion, deleteQuestion, duplicateRound, deleteRound, addRound, insertQuestion,
    changeType, KEEP_ON_TYPE_CHANGE, issues, preview, nextOptionId
  };
})();
