const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDB } = require('../db');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getDB();
  const rows = db.prepare(`
    SELECT * FROM templates
    ORDER BY is_builtin DESC, created_at DESC
  `).all();

  const result = rows.map(r => ({
    ...r,
    questions: JSON.parse(r.questions),
    is_builtin: r.is_builtin === 1
  }));

  res.json(result);
});

router.post('/', (req, res) => {
  const db = getDB();
  const { name, description, category, questions } = req.body;

  if (!name || !questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: '参数不完整' });
  }

  const id = uuidv4();
  const info = db.prepare(`
    INSERT INTO templates (id, name, description, category, questions, is_builtin)
    VALUES (?, ?, ?, ?, ?, 0)
  `).run(id, name, description || '', category || '', JSON.stringify(questions));

  if (info.changes > 0) {
    res.json({ id, success: true });
  } else {
    res.status(500).json({ error: '创建失败' });
  }
});

router.delete('/:id', (req, res) => {
  const db = getDB();
  const tpl = db.prepare('SELECT * FROM templates WHERE id = ?').get(req.params.id);
  if (!tpl) {
    return res.status(404).json({ error: '模板不存在' });
  }
  if (tpl.is_builtin === 1) {
    return res.status(400).json({ error: '预置模板不可删除' });
  }

  const info = db.prepare('DELETE FROM templates WHERE id = ?').run(req.params.id);
  if (info.changes > 0) {
    res.json({ success: true });
  } else {
    res.status(500).json({ error: '删除失败' });
  }
});

module.exports = router;
