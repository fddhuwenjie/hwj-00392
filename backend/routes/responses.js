const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');
const { getCurrentCount } = require('./quotas');
const { analyzeQuality } = require('./quality');
const { addNotification } = require('./notifications');

const router = express.Router();

router.post('/', (req, res) => {
  const db = getDB();
  const { survey_id, answers, respondent_info, duration_seconds } = req.body;

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

  const quotaRules = db.prepare('SELECT * FROM quota_rules WHERE survey_id = ?').all(survey_id);
  for (const rule of quotaRules) {
    const userAnswer = answers[rule.question_id];
    const matches = Array.isArray(userAnswer) ? userAnswer.includes(rule.answer_value) : userAnswer === rule.answer_value;
    if (matches) {
      const current = getCurrentCount(db, survey_id, rule.question_id, rule.answer_value);
      if (current >= rule.max_count) {
        return res.status(400).json({
          error: `该类别已满: "${rule.answer_value}"已达上限${rule.max_count}份`,
          quota_full: true,
          rule_id: rule.id
        });
      }
    }
  }

  const id = uuidv4();
  const tempResp = { answers: JSON.stringify(answers), duration_seconds: duration_seconds || 0 };
  const { score, flags } = analyzeQuality(survey, tempResp);

  const info = db.prepare(`
    INSERT INTO responses (id, survey_id, answers, respondent_info, quality_score, quality_flags, duration_seconds)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    survey_id,
    JSON.stringify(answers),
    respondent_info ? JSON.stringify(respondent_info) : null,
    score,
    JSON.stringify(flags),
    duration_seconds || 0
  );

  if (info.changes > 0) {
    const totalCount = db.prepare('SELECT COUNT(*) as cnt FROM responses WHERE survey_id = ?').get(survey_id).cnt;
    const milestones = [10, 50, 100, 500, 1000, 5000];
    milestones.forEach(m => {
      if (totalCount === m) {
        const notified = db.prepare('SELECT * FROM milestone_notified WHERE survey_id = ? AND milestone = ?').get(survey_id, m);
        if (!notified) {
          db.prepare(`
            INSERT INTO milestone_notified (id, survey_id, milestone)
            VALUES (?, ?, ?)
          `).run(uuidv4(), survey_id, m);
          addNotification(db, {
            survey_id,
            type: 'milestone',
            title: '回收里程碑达成!',
            content: `问卷"${survey.title}"已收集${m}份答卷!`
          });
        }
      }
    });
    res.json({ id, success: true, quality_score: score, quality_flags: flags });
  } else {
    res.status(500).json({ error: '提交失败' });
  }
});

router.get('/survey/:surveyId', (req, res) => {
  const db = getDB();
  const { page = 1, pageSize = 20, filters, min_quality, max_quality } = req.query;

  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  let whereClause = 'WHERE survey_id = ?';
  const params = [req.params.surveyId];

  if (min_quality !== undefined && min_quality !== '') {
    whereClause += ' AND quality_score >= ?';
    params.push(parseInt(min_quality));
  }
  if (max_quality !== undefined && max_quality !== '') {
    whereClause += ' AND quality_score <= ?';
    params.push(parseInt(max_quality));
  }

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
    respondent_info: r.respondent_info ? JSON.parse(r.respondent_info) : null,
    quality_flags: r.quality_flags ? JSON.parse(r.quality_flags) : []
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
    respondent_info: row.respondent_info ? JSON.parse(row.respondent_info) : null,
    quality_flags: row.quality_flags ? JSON.parse(row.quality_flags) : []
  });
});

router.delete('/survey/:surveyId/batch', (req, res) => {
  const db = getDB();
  const { ids, min_quality } = req.body;
  let deleted = 0;
  if (ids && ids.length > 0) {
    const placeholders = ids.map(() => '?').join(',');
    const info = db.prepare(`DELETE FROM responses WHERE survey_id = ? AND id IN (${placeholders})`).run(req.params.surveyId, ...ids);
    deleted = info.changes;
  } else if (min_quality !== undefined) {
    const info = db.prepare('DELETE FROM responses WHERE survey_id = ? AND quality_score < ?').run(req.params.surveyId, parseInt(min_quality));
    deleted = info.changes;
  }
  res.json({ deleted });
});

module.exports = router;
