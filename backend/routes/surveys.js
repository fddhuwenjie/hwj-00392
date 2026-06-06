const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB, generateShortCode } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDB();
  const rows = db.prepare(`
    SELECT s.*, COUNT(r.id) as response_count
    FROM surveys s
    LEFT JOIN responses r ON s.id = r.survey_id
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `).all();

  const result = rows.map(r => ({
    ...r,
    questions: JSON.parse(r.questions),
    is_paused: r.is_paused === 1
  }));

  res.json(result);
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const row = db.prepare('SELECT * FROM surveys WHERE id = ?').get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: '问卷不存在' });
  }
  res.json({
    ...row,
    questions: JSON.parse(row.questions),
    is_paused: row.is_paused === 1
  });
});

router.get('/short/:code', (req, res) => {
  const db = getDB();
  const row = db.prepare('SELECT * FROM surveys WHERE short_code = ?').get(req.params.code);
  if (!row) {
    return res.status(404).json({ error: '问卷不存在' });
  }
  res.json({
    ...row,
    questions: JSON.parse(row.questions),
    is_paused: row.is_paused === 1
  });
});

router.post('/', (req, res) => {
  const db = getDB();
  const { title, description, questions, display_mode = 'all' } = req.body;

  if (!title || !questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: '参数不完整' });
  }

  const id = uuidv4();
  const shortCode = generateShortCode();

  const info = db.prepare(`
    INSERT INTO surveys (id, title, description, questions, display_mode, short_code)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, title, description || '', JSON.stringify(questions), display_mode, shortCode);

  if (info.changes > 0) {
    res.json({ id, short_code: shortCode });
  } else {
    res.status(500).json({ error: '创建失败' });
  }
});

router.put('/:id', (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT * FROM surveys WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '问卷不存在' });
  }

  if (existing.status === 'published') {
    const { questions } = req.body;
    if (questions && JSON.stringify(JSON.parse(existing.questions)) !== JSON.stringify(questions)) {
      return res.status(400).json({ error: '已发布的问卷不可修改题目，请新建副本' });
    }
  }

  const { title, description, questions, display_mode } = req.body;
  const info = db.prepare(`
    UPDATE surveys
    SET title = ?, description = ?, questions = COALESCE(?, questions),
        display_mode = COALESCE(?, display_mode),
        updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(
    title || existing.title,
    description !== undefined ? description : existing.description,
    questions ? JSON.stringify(questions) : null,
    display_mode || null,
    req.params.id
  );

  if (info.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: '更新失败' });
  }
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  const info = db.prepare('DELETE FROM surveys WHERE id = ?').run(req.params.id);
  if (info.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: '问卷不存在' });
  }
});

router.post('/:id/copy', (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT * FROM surveys WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '问卷不存在' });
  }

  const newId = uuidv4();
  const shortCode = generateShortCode();

  const info = db.prepare(`
    INSERT INTO surveys (id, title, description, questions, status, display_mode, short_code)
    VALUES (?, ?, ?, ?, 'draft', ?, ?)
  `).run(
    newId,
    existing.title + ' (副本)',
    existing.description,
    existing.questions,
    existing.display_mode,
    shortCode
  );

  if (info.changes > 0) {
    res.json({ id: newId, short_code: shortCode });
  } else {
    res.status(500).json({ error: '复制失败' });
  }
});

router.post('/:id/publish', (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT * FROM surveys WHERE id = ?').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '问卷不存在' });
  }

  const { start_time, end_time, max_responses, password } = req.body;
  const shortCode = existing.short_code || generateShortCode();

  const info = db.prepare(`
    UPDATE surveys
    SET status = 'published', start_time = ?, end_time = ?,
        max_responses = ?, password = ?, short_code = ?,
        updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(
    start_time || null,
    end_time || null,
    max_responses || null,
    password || null,
    shortCode,
    req.params.id
  );

  if (info.changes > 0) {
    res.json({ success: true, short_code: shortCode });
  } else {
    res.status(500).json({ error: '发布失败' });
  }
});

router.post('/:id/unpublish', (req, res) => {
  const db = getDB();
  const info = db.prepare(`
    UPDATE surveys SET status = 'draft', updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(req.params.id);

  if (info.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: '问卷不存在' });
  }
});

router.post('/:id/pause', (req, res) => {
  const db = getDB();
  const info = db.prepare(`
    UPDATE surveys SET is_paused = 1, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(req.params.id);

  if (info.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: '问卷不存在' });
  }
});

router.post('/:id/resume', (req, res) => {
  const db = getDB();
  const info = db.prepare(`
    UPDATE surveys SET is_paused = 0, updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(req.params.id);

  if (info.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: '问卷不存在' });
  }
});

router.post('/:id/verify-password', (req, res) => {
  const db = getDB();
  const survey = db.prepare('SELECT password FROM surveys WHERE id = ?').get(req.params.id);
  if (!survey) {
    return res.status(404).json({ error: '问卷不存在' });
  }

  if (!survey.password) {
    return res.json({ valid: true });
  }

  const { password } = req.body;
  res.json({ valid: password === survey.password });
});

module.exports = router;
