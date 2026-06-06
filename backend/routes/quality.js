const express = require('express');
const { getDB } = require('../db');

const router = express.Router();

function isNonsenseText(text) {
  if (!text || typeof text !== 'string') return false;
  const trimmed = text.trim().toLowerCase();
  if (trimmed.length < 2) return true;
  const nonsensePatterns = [
    /^[asdfghjkl;']+$/,
    /^[qwertyuiop]+$/,
    /^[zxcvbnm,.\/]+$/,
    /^[1234567890]+$/,
    /^(.)\1{2,}$/,
    /^[абвгдеёжзийклмнопрстуфхцчшщъыьэюя]+$/,
  ];
  for (const pattern of nonsensePatterns) {
    if (pattern.test(trimmed)) return true;
  }
  return false;
}

function analyzeQuality(survey, response) {
  const questions = JSON.parse(survey.questions);
  const answers = JSON.parse(response.answers);
  let score = 100;
  const flags = [];

  const choiceCounts = {};
  let choiceQCount = 0;
  let textQCount = 0;
  let nonsenseTextCount = 0;

  questions.forEach(q => {
    const answer = answers[q.id];
    if (['single', 'multi', 'rating', 'nps', 'sort'].includes(q.type)) {
      choiceQCount++;
      const key = JSON.stringify(answer);
      choiceCounts[key] = (choiceCounts[key] || 0) + 1;
    }
    if (q.type === 'text') {
      textQCount++;
      if (isNonsenseText(answer)) {
        nonsenseTextCount++;
      }
    }
  });

  if (choiceQCount >= 3) {
    const mostCommon = Math.max(...Object.values(choiceCounts));
    if (mostCommon === choiceQCount) {
      score -= 30;
      flags.push('straight_line');
    } else if (mostCommon / choiceQCount >= 0.7) {
      score -= 15;
      flags.push('mostly_same_answer');
    }
  }

  const duration = response.duration_seconds || 0;
  const estimatedSeconds = questions.length * 8;
  if (duration > 0 && duration < estimatedSeconds * 0.3) {
    score -= 30;
    flags.push('too_fast');
  } else if (duration > 0 && duration < estimatedSeconds * 0.5) {
    score -= 15;
    flags.push('fast');
  }

  if (textQCount > 0 && nonsenseTextCount === textQCount) {
    score -= 25;
    flags.push('all_nonsense_text');
  } else if (textQCount > 0 && nonsenseTextCount / textQCount >= 0.5) {
    score -= 15;
    flags.push('some_nonsense_text');
  }

  const emptyCount = Object.values(answers).filter(v => v === undefined || v === null || v === '' || (Array.isArray(v) && v.length === 0)).length;
  const totalQ = questions.length;
  if (questions.filter(q => !q.required).length < totalQ) {
    const requiredEmpty = questions.filter(q => q.required).filter(q => {
      const a = answers[q.id];
      return a === undefined || a === null || a === '' || (Array.isArray(a) && a.length === 0);
    }).length;
    if (requiredEmpty > 0) {
      score -= 10 * requiredEmpty;
      flags.push('missing_required');
    }
  }

  score = Math.max(0, Math.min(100, score));
  return { score, flags };
}

router.post('/survey/:surveyId/analyze', (req, res) => {
  const db = getDB();
  const survey = db.prepare('SELECT questions FROM surveys WHERE id = ?').get(req.params.surveyId);
  if (!survey) {
    return res.status(404).json({ error: '问卷不存在' });
  }
  const responses = db.prepare('SELECT * FROM responses WHERE survey_id = ?').all(req.params.surveyId);
  const results = responses.map(r => {
    const { score, flags } = analyzeQuality(survey, r);
    db.prepare('UPDATE responses SET quality_score = ?, quality_flags = ? WHERE id = ?').run(score, JSON.stringify(flags), r.id);
    return { response_id: r.id, score, flags };
  });
  res.json({ total: results.length, results });
});

router.get('/survey/:surveyId/stats', (req, res) => {
  const db = getDB();
  const rows = db.prepare('SELECT quality_score, quality_flags FROM responses WHERE survey_id = ?').all(req.params.surveyId);
  const distribution = { excellent: 0, good: 0, medium: 0, poor: 0, bad: 0 };
  let avgScore = 0;
  rows.forEach(r => {
    const s = r.quality_score ?? 100;
    avgScore += s;
    if (s >= 90) distribution.excellent++;
    else if (s >= 75) distribution.good++;
    else if (s >= 60) distribution.medium++;
    else if (s >= 40) distribution.poor++;
    else distribution.bad++;
  });
  avgScore = rows.length > 0 ? (avgScore / rows.length).toFixed(1) : 0;
  res.json({ total: rows.length, avg_score: parseFloat(avgScore), distribution });
});

router.post('/survey/:surveyId/delete-low-quality', (req, res) => {
  const db = getDB();
  const { min_score = 60 } = req.body;
  const info = db.prepare('DELETE FROM responses WHERE survey_id = ? AND quality_score < ?').run(req.params.surveyId, parseInt(min_score));
  res.json({ deleted: info.changes });
});

module.exports = { router, analyzeQuality };
