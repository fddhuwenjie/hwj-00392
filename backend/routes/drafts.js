const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');

const router = express.Router();

function getRespondentIdentifier(req) {
  const identifier = req.headers['x-respondent-id']
    || req.query.respondent_id
    || req.body?.respondent_identifier;
  if (identifier) return String(identifier);
  const ua = req.headers['user-agent'] || 'unknown';
  const ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
  return `${ip}_${ua.substring(0, 50)}`;
}

router.post('/', (req, res) => {
  const db = getDB();
  const { survey_id, answers } = req.body;
  const respondent_identifier = getRespondentIdentifier(req);

  if (!survey_id || !answers) {
    return res.status(400).json({ error: '参数不完整' });
  }

  const survey = db.prepare('SELECT * FROM surveys WHERE id = ? AND is_deleted = 0').get(survey_id);
  if (!survey) {
    return res.status(404).json({ error: '问卷不存在' });
  }

  const existing = db.prepare(
    'SELECT * FROM drafts WHERE survey_id = ? AND respondent_identifier = ?'
  ).get(survey_id, respondent_identifier);

  if (existing) {
    db.prepare(`
      UPDATE drafts
      SET answers = ?, updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(JSON.stringify(answers), existing.id);
    res.json({ id: existing.id, updated: true });
  } else {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO drafts (id, survey_id, respondent_identifier, answers)
      VALUES (?, ?, ?, ?)
    `).run(id, survey_id, respondent_identifier, JSON.stringify(answers));
    res.json({ id, updated: false });
  }
});

router.get('/survey/:surveyId', (req, res) => {
  const db = getDB();
  const respondent_identifier = getRespondentIdentifier(req);
  const row = db.prepare(`
    SELECT * FROM drafts
    WHERE survey_id = ? AND respondent_identifier = ?
  `).get(req.params.surveyId, respondent_identifier);

  if (!row) {
    return res.json(null);
  }

  res.json({
    ...row,
    answers: JSON.parse(row.answers)
  });
});

router.get('/', (req, res) => {
  const db = getDB();
  const respondent_identifier = getRespondentIdentifier(req);
  const rows = db.prepare(`
    SELECT d.*, s.title as survey_title, s.status as survey_status, s.is_paused as survey_paused
    FROM drafts d
    LEFT JOIN surveys s ON d.survey_id = s.id
    WHERE d.respondent_identifier = ? AND s.is_deleted = 0
    ORDER BY d.updated_at DESC
  `).all(respondent_identifier);

  const result = rows.map(r => ({
    ...r,
    answers: JSON.parse(r.answers),
    survey_paused: r.survey_paused === 1
  }));

  res.json(result);
});

router.delete('/survey/:surveyId', (req, res) => {
  const db = getDB();
  const respondent_identifier = getRespondentIdentifier(req);
  const info = db.prepare(`
    DELETE FROM drafts
    WHERE survey_id = ? AND respondent_identifier = ?
  `).run(req.params.surveyId, respondent_identifier);

  res.json({ deleted: info.changes > 0 });
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  const respondent_identifier = getRespondentIdentifier(req);
  const info = db.prepare(`
    DELETE FROM drafts
    WHERE id = ? AND respondent_identifier = ?
  `).run(req.params.id, respondent_identifier);

  if (info.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: '草稿不存在' });
  }
});

module.exports = { router, getRespondentIdentifier };
