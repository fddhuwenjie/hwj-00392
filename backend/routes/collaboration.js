const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');

const router = express.Router();

router.get('/:surveyId/collaborators', (req, res) => {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM collaborators WHERE survey_id = ? ORDER BY invited_at DESC').all(req.params.surveyId);
  res.json(rows);
});

router.post('/:surveyId/collaborators', (req, res) => {
  const db = getDB();
  const { email, name, permission = 'edit' } = req.body;
  if (!email) {
    return res.status(400).json({ error: '邮箱不能为空' });
  }
  if (!['edit', 'view'].includes(permission)) {
    return res.status(400).json({ error: '权限类型无效' });
  }
  try {
    const id = uuidv4();
    db.prepare(`
      INSERT INTO collaborators (id, survey_id, email, name, permission)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, req.params.surveyId, email, name || email.split('@')[0], permission);
    res.json({ id, success: true });
  } catch (e) {
    if (e.message && e.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '该邮箱已被邀请' });
    }
    res.status(500).json({ error: '添加失败' });
  }
});

router.put('/:surveyId/collaborators/:collabId', (req, res) => {
  const db = getDB();
  const { permission } = req.body;
  if (!['edit', 'view'].includes(permission)) {
    return res.status(400).json({ error: '权限类型无效' });
  }
  const info = db.prepare('UPDATE collaborators SET permission = ? WHERE id = ? AND survey_id = ?').run(permission, req.params.collabId, req.params.surveyId);
  if (info.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: '协作者不存在' });
  }
});

router.delete('/:surveyId/collaborators/:collabId', (req, res) => {
  const db = getDB();
  const info = db.prepare('DELETE FROM collaborators WHERE id = ? AND survey_id = ?').run(req.params.collabId, req.params.surveyId);
  if (info.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(404).json({ error: '协作者不存在' });
  }
});

router.get('/:surveyId/locks', (req, res) => {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM edit_locks WHERE survey_id = ?').all(req.params.surveyId);
  res.json(rows);
});

router.post('/:surveyId/locks', (req, res) => {
  const db = getDB();
  const { question_id, user_email, user_name } = req.body;
  if (!question_id || !user_email) {
    return res.status(400).json({ error: '参数不完整' });
  }
  const existing = db.prepare('SELECT * FROM edit_locks WHERE survey_id = ? AND question_id = ?').get(req.params.surveyId, question_id);
  if (existing) {
    if (existing.user_email === user_email) {
      db.prepare('UPDATE edit_locks SET locked_at = datetime(\'now\',\'localtime\') WHERE id = ?').run(existing.id);
      return res.json({ locked: true, lock: existing });
    }
    return res.json({ locked: false, lock: existing, message: `${existing.user_name || existing.user_email}正在编辑` });
  }
  const id = uuidv4();
  db.prepare(`
    INSERT INTO edit_locks (id, survey_id, question_id, user_email, user_name)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, req.params.surveyId, question_id, user_email, user_name || user_email.split('@')[0]);
  const lock = db.prepare('SELECT * FROM edit_locks WHERE id = ?').get(id);
  res.json({ locked: true, lock });
});

router.delete('/:surveyId/locks/:questionId', (req, res) => {
  const db = getDB();
  const { user_email } = req.body || {};
  let query = 'DELETE FROM edit_locks WHERE survey_id = ? AND question_id = ?';
  const params = [req.params.surveyId, req.params.questionId];
  if (user_email) {
    query += ' AND user_email = ?';
    params.push(user_email);
  }
  const info = db.prepare(query).run(...params);
  res.json({ success: info.changes > 0 });
});

router.get('/:surveyId/logs', (req, res) => {
  const db = getDB();
  const { page = 1, pageSize = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  const total = db.prepare('SELECT COUNT(*) as cnt FROM operation_logs WHERE survey_id = ?').get(req.params.surveyId).cnt;
  const rows = db.prepare(`
    SELECT * FROM operation_logs WHERE survey_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(req.params.surveyId, parseInt(pageSize), offset);
  res.json({ list: rows, total, page: parseInt(page), pageSize: parseInt(pageSize) });
});

router.post('/:surveyId/logs', (req, res) => {
  const db = getDB();
  const { user_email, user_name, action, question_id, question_title, detail } = req.body;
  if (!user_email || !action) {
    return res.status(400).json({ error: '参数不完整' });
  }
  const id = uuidv4();
  db.prepare(`
    INSERT INTO operation_logs (id, survey_id, user_email, user_name, action, question_id, question_title, detail)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, req.params.surveyId, user_email, user_name || user_email.split('@')[0], action, question_id || null, question_title || null, detail || null);
  res.json({ id, success: true });
});

module.exports = router;
