const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDB();
  const { page = 1, pageSize = 20, type, is_read } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);

  let whereClause = 'WHERE 1=1';
  const params = [];
  if (type) {
    whereClause += ' AND type = ?';
    params.push(type);
  }
  if (is_read !== undefined && is_read !== '') {
    whereClause += ' AND is_read = ?';
    params.push(parseInt(is_read));
  }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM notifications ${whereClause}`).get(...params).cnt;
  const rows = db.prepare(`
    SELECT * FROM notifications ${whereClause}
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);

  const unreadCount = db.prepare('SELECT COUNT(*) as cnt FROM notifications WHERE is_read = 0').get().cnt;

  res.json({ list: rows, total, unread_count: unreadCount, page: parseInt(page), pageSize: parseInt(pageSize) });
});

router.post('/:id/read', (req, res) => {
  const db = getDB();
  const info = db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ?').run(req.params.id);
  res.json({ success: info.changes > 0 });
});

router.post('/read-all', (req, res) => {
  const db = getDB();
  const info = db.prepare('UPDATE notifications SET is_read = 1 WHERE is_read = 0').run();
  res.json({ updated: info.changes });
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  const info = db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id);
  res.json({ success: info.changes > 0 });
});

router.delete('/', (req, res) => {
  const db = getDB();
  const { only_read = true } = req.body;
  let query = 'DELETE FROM notifications';
  if (only_read) query += ' WHERE is_read = 1';
  const info = db.prepare(query).run();
  res.json({ deleted: info.changes });
});

function addNotification(db, { survey_id, type, title, content }) {
  const id = uuidv4();
  db.prepare(`
    INSERT INTO notifications (id, survey_id, type, title, content)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, survey_id || null, type, title, content || null);
  return id;
}

module.exports = { router, addNotification };
