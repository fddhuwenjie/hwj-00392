const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');

const router = express.Router();

router.get('/:surveyId', (req, res) => {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM quota_rules WHERE survey_id = ? ORDER BY created_at DESC').all(req.params.surveyId);
  const updated = rows.map(r => ({
    ...r,
    current_count: getCurrentCount(db, req.params.surveyId, r.question_id, r.answer_value)
  }));
  res.json(updated);
});

function getCurrentCount(db, surveyId, questionId, answerValue) {
  const rows = db.prepare('SELECT answers FROM responses WHERE survey_id = ?').all(surveyId);
  let count = 0;
  rows.forEach(r => {
    try {
      const answers = JSON.parse(r.answers);
      const val = answers[questionId];
      if (Array.isArray(val)) {
        if (val.includes(answerValue)) count++;
      } else if (val === answerValue) {
        count++;
      }
    } catch (e) {}
  });
  return count;
}

router.post('/:surveyId', (req, res) => {
  const db = getDB();
  const { question_id, question_title, answer_value, max_count } = req.body;
  if (!question_id || !answer_value || max_count === undefined) {
    return res.status(400).json({ error: '参数不完整' });
  }
  const id = uuidv4();
  db.prepare(`
    INSERT INTO quota_rules (id, survey_id, question_id, question_title, answer_value, max_count)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, req.params.surveyId, question_id, question_title || '', answer_value, parseInt(max_count));
  const rule = db.prepare('SELECT * FROM quota_rules WHERE id = ?').get(id);
  res.json({ ...rule, current_count: getCurrentCount(db, req.params.surveyId, question_id, answer_value) });
});

router.put('/:surveyId/:ruleId', (req, res) => {
  const db = getDB();
  const { max_count, answer_value } = req.body;
  const existing = db.prepare('SELECT * FROM quota_rules WHERE id = ? AND survey_id = ?').get(req.params.ruleId, req.params.surveyId);
  if (!existing) {
    return res.status(404).json({ error: '配额规则不存在' });
  }
  db.prepare(`
    UPDATE quota_rules SET max_count = COALESCE(?, max_count), answer_value = COALESCE(?, answer_value)
    WHERE id = ?
  `).run(max_count !== undefined ? parseInt(max_count) : null, answer_value || null, req.params.ruleId);
  const rule = db.prepare('SELECT * FROM quota_rules WHERE id = ?').get(req.params.ruleId);
  res.json({ ...rule, current_count: getCurrentCount(db, req.params.surveyId, rule.question_id, rule.answer_value) });
});

router.delete('/:surveyId/:ruleId', (req, res) => {
  const db = getDB();
  const info = db.prepare('DELETE FROM quota_rules WHERE id = ? AND survey_id = ?').run(req.params.ruleId, req.params.surveyId);
  if (info.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: '配额规则不存在' });
  }
});

module.exports = { router, getCurrentCount };
