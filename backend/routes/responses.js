const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');

const router = express.Router();

router.post('/', (req, res) => {
  const db = getDB();
  const { survey_id, answers, respondent_info } = req.body;

  if (!survey_id || !answers) {
    return res.status(400).json({ error: '参数不完整' });
  }

  const survey = db.prepare('SELECT * FROM surveys WHERE id = ?').get(survey_id);
  if (!survey) {
    return res.status(404).json({ error: '问卷不存在' });
  }

  if (survey.status !== 'published') {
    return res.status(400).json({ error: '问卷未发布' });
  }

  if (survey.is_paused === 1) {
    return res.status(400).json({ error: '问卷已暂停收集' });
  }

  const now = new Date();
  if (survey.start_time && new Date(survey.start_time) > now) {
    return res.status(400).json({ error: '问卷尚未开始' });
  }
  if (survey.end_time && new Date(survey.end_time) < now) {
    return res.status(400).json({ error: '问卷已结束' });
  }

  if (survey.max_responses) {
    const count = db.prepare('SELECT COUNT(*) as cnt FROM responses WHERE survey_id = ?').get(survey_id).cnt;
    if (count >= survey.max_responses) {
      return res.status(400).json({ error: '已达到最大回收量' });
    }
  }

  const id = uuidv4();
  const info = db.prepare(`
    INSERT INTO responses (id, survey_id, answers, respondent_info)
    VALUES (?, ?, ?, ?)
  `).run(id, survey_id, JSON.stringify(answers), respondent_info ? JSON.stringify(respondent_info) : null);

  if (info.changes > 0) {
    res.json({ id, success: true });
  } else {
    res.status(500).json({ error: '提交失败' });
  }
});

router.get('/survey/:surveyId', (req, res) => {
  const db = getDB();
  const { page = 1, pageSize = 20, filters } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  let whereClause = 'WHERE survey_id = ?';
  const params = [req.params.surveyId];

  if (filters) {
    try {
      const filterObj = JSON.parse(filters);
      Object.entries(filterObj).forEach(([qId, value]) => {
        if (value && Array.isArray(value) && value.length > 0) {
          whereClause += ` AND json_extract(answers, '$.${qId}') IN (${value.map(() => '?').join(',')})`;
          params.push(...value);
        } else if (value && !Array.isArray(value)) {
          whereClause += ` AND json_extract(answers, '$.${qId}') = ?`;
          params.push(value);
        }
      });
    } catch (e) {
    }
  }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM responses ${whereClause}`).get(...params).cnt;

  const rows = db.prepare(`
    SELECT * FROM responses ${whereClause}
    ORDER BY submit_time DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  const list = rows.map(r => ({
    ...r,
    answers: JSON.parse(r.answers),
    respondent_info: r.respondent_info ? JSON.parse(r.respondent_info) : null
  }));

  res.json({ list, total, page: parseInt(page), pageSize: parseInt(pageSize) });
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const row = db.prepare('SELECT * FROM responses WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: '答卷不存在' });
  }
  res.json({
    ...row,
    answers: JSON.parse(row.answers),
    respondent_info: row.respondent_info ? JSON.parse(row.respondent_info) : null
  });
});

module.exports = router;
