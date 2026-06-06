const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB, generateShortCode } = require('../db');

const router = express.Router();

function cleanupExpiredDeleted(db) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const info = db.prepare(`
    DELETE FROM surveys
    WHERE is_deleted = 1 AND deleted_at IS NOT NULL AND deleted_at < ?
  `).run(thirtyDaysAgo);
  if (info.changes > 0) {
    console.log(`[RecycleBin] Cleaned up ${info.changes} expired deleted surveys`);
  }
  return info.changes;
}

router.get('/', (req, res) => {
  const db = getDB();
  const rows = db.prepare(`
    SELECT s.*, COUNT(r.id) as response_count
    FROM surveys s
    LEFT JOIN responses r ON s.id = r.survey_id
    WHERE s.is_deleted = 0
    GROUP BY s.id
    ORDER BY s.created_at DESC
  `).all();

  const result = rows.map(r => ({
    ...r,
    questions: JSON.parse(r.questions),
    is_paused: r.is_paused === 1,
    show_stats_after_submit: r.show_stats_after_submit === 1
  }));

  res.json(result);
});

router.get('/recycle-bin', (req, res) => {
  const db = getDB();
  cleanupExpiredDeleted(db);

  const rows = db.prepare(`
    SELECT * FROM surveys
    WHERE is_deleted = 1
    ORDER BY deleted_at DESC
  `).all();

  const result = rows.map(r => ({
    ...r,
    questions: JSON.parse(r.questions),
    is_paused: r.is_paused === 1,
    show_stats_after_submit: r.show_stats_after_submit === 1
  }));

  res.json(result);
});

router.post('/recycle-bin/:id/restore', (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT * FROM surveys WHERE id = ? AND is_deleted = 1').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '问卷不在回收站中' });
  }

  const info = db.prepare(`
    UPDATE surveys
    SET is_deleted = 0, deleted_at = NULL, original_status = NULL,
        updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(req.params.id);

  if (info.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: '恢复失败' });
  }
});

router.delete('/recycle-bin/:id', (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT * FROM surveys WHERE id = ? AND is_deleted = 1').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '问卷不在回收站中' });
  }

  const info = db.prepare('DELETE FROM surveys WHERE id = ?').run(req.params.id);
  if (info.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: '永久删除失败' });
  }
});

router.get('/:id', (req, res) => {
  const db = getDB();
  const row = db.prepare('SELECT * FROM surveys WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!row) {
    return res.status(404).json({ error: '问卷不存在' });
  }
  res.json({
    ...row,
    questions: JSON.parse(row.questions),
    is_paused: row.is_paused === 1,
    show_stats_after_submit: row.show_stats_after_submit === 1
  });
});

router.get('/short/:code', (req, res) => {
  const db = getDB();
  const row = db.prepare('SELECT * FROM surveys WHERE short_code = ? AND is_deleted = 0').get(req.params.code);
  if (!row) {
    return res.status(404).json({ error: '问卷不存在' });
  }
  res.json({
    ...row,
    questions: JSON.parse(row.questions),
    is_paused: row.is_paused === 1,
    show_stats_after_submit: row.show_stats_after_submit === 1
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
  const existing = db.prepare('SELECT * FROM surveys WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '问卷不存在' });
  }

  if (existing.status === 'published') {
    const { questions } = req.body;
    if (questions && JSON.stringify(JSON.parse(existing.questions)) !== JSON.stringify(questions)) {
      return res.status(400).json({ error: '已发布的问卷不可修改题目，请新建副本' });
    }
  }

  const { title, description, questions, display_mode, show_stats_after_submit } = req.body;

  const fields = [];
  const params = [];

  fields.push('title = ?');
  params.push(title || existing.title);

  fields.push('description = ?');
  params.push(description !== undefined ? description : existing.description);

  if (questions) {
    fields.push('questions = ?');
    params.push(JSON.stringify(questions));
  }

  if (display_mode) {
    fields.push('display_mode = ?');
    params.push(display_mode);
  }

  if (show_stats_after_submit !== undefined) {
    fields.push('show_stats_after_submit = ?');
    params.push(show_stats_after_submit ? 1 : 0);
  }

  fields.push("updated_at = datetime('now','localtime')");
  params.push(req.params.id);

  const info = db.prepare(`
    UPDATE surveys SET ${fields.join(', ')} WHERE id = ?
  `).run(...params);

  if (info.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: '更新失败' });
  }
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT * FROM surveys WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '问卷不存在' });
  }

  const info = db.prepare(`
    UPDATE surveys
    SET is_deleted = 1,
        deleted_at = datetime('now','localtime'),
        original_status = ?,
        updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(existing.status, req.params.id);

  if (info.changes > 0) {
    res.json({ success: true, soft_deleted: true });
  } else {
    res.status(500).json({ error: '删除失败' });
  }
});

router.post('/:id/copy', (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT * FROM surveys WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '问卷不存在' });
  }

  const newId = uuidv4();
  const shortCode = generateShortCode();

  const info = db.prepare(`
    INSERT INTO surveys (id, title, description, questions, status, display_mode, short_code, show_stats_after_submit)
    VALUES (?, ?, ?, ?, 'draft', ?, ?, ?)
  `).run(
    newId,
    existing.title + ' (副本)',
    existing.description,
    existing.questions,
    existing.display_mode,
    shortCode,
    existing.show_stats_after_submit || 1
  );

  if (info.changes > 0) {
    res.json({ id: newId, short_code: shortCode });
  } else {
    res.status(500).json({ error: '复制失败' });
  }
});

router.post('/:id/publish', (req, res) => {
  const db = getDB();
  const existing = db.prepare('SELECT * FROM surveys WHERE id = ? AND is_deleted = 0').get(req.params.id);
  if (!existing) {
    return res.status(404).json({ error: '问卷不存在' });
  }

  const { start_time, end_time, max_responses, password, scheduled_publish_time, show_stats_after_submit } = req.body;
  const shortCode = existing.short_code || generateShortCode();

  const statsFlag = show_stats_after_submit !== undefined ? (show_stats_after_submit ? 1 : 0) : (existing.show_stats_after_submit || 1);

  if (scheduled_publish_time) {
    const info = db.prepare(`
      UPDATE surveys
      SET scheduled_publish_time = ?, start_time = ?, end_time = ?,
          max_responses = ?, password = ?, short_code = ?,
          show_stats_after_submit = ?,
          updated_at = datetime('now','localtime')
      WHERE id = ?
    `).run(
      scheduled_publish_time,
      start_time || null,
      end_time || null,
      max_responses || null,
      password || null,
      shortCode,
      statsFlag,
      req.params.id
    );
    if (info.changes > 0) {
      res.json({ success: true, short_code: shortCode, scheduled: true, scheduled_publish_time });
    } else {
      res.status(500).json({ error: '定时发布设置失败' });
    }
    return;
  }

  const info = db.prepare(`
    UPDATE surveys
    SET status = 'published', start_time = ?, end_time = ?,
        max_responses = ?, password = ?, short_code = ?,
        scheduled_publish_time = NULL,
        show_stats_after_submit = ?,
        updated_at = datetime('now','localtime')
    WHERE id = ?
  `).run(
    start_time || null,
    end_time || null,
    max_responses || null,
    password || null,
    shortCode,
    statsFlag,
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
    WHERE id = ? AND is_deleted = 0
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
    WHERE id = ? AND is_deleted = 0
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
    WHERE id = ? AND is_deleted = 0
  `).run(req.params.id);

  if (info.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: '问卷不存在' });
  }
});

router.post('/:id/verify-password', (req, res) => {
  const db = getDB();
  const survey = db.prepare('SELECT password FROM surveys WHERE id = ? AND is_deleted = 0').get(req.params.id);
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
