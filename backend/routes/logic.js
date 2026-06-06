const express = require('express');
const { getDB } = require('../db');

const router = express.Router();

router.get('/:surveyId/validate', (req, res) => {
  const db = getDB();
  const survey = db.prepare('SELECT questions FROM surveys WHERE id = ?').get(req.params.surveyId);
  if (!survey) {
    return res.status(404).json({ error: '问卷不存在' });
  }
  const questions = JSON.parse(survey.questions);
  const conflicts = [];
  const branches = [];
  const questionIds = questions.map(q => q.id);
  const qIndexMap = {};
  questions.forEach((q, i) => { qIndexMap[q.id] = i; });

  questions.forEach((q, qIdx) => {
    if (q.type === 'single' && q.branching) {
      const visitedInPath = new Set();
      Object.entries(q.branching).forEach(([branchKey, targetId]) => {
        const optionIdx = parseInt(branchKey.split('_').pop());
        const optionText = q.options?.[optionIdx] || `选项${optionIdx + 1}`;
        branches.push({
          fromQuestionId: q.id,
          fromQuestionTitle: q.title,
          fromOption: optionText,
          toQuestionId: targetId,
          toQuestionTitle: questions.find(x => x.id === targetId)?.title || '未知题目'
        });

        if (!questionIds.includes(targetId)) {
          conflicts.push({
            type: 'missing_target',
            severity: 'error',
            message: `题"${q.title}"的分支"${optionText}"跳转到不存在的题目`,
            questionId: q.id
          });
        } else if (qIndexMap[targetId] <= qIdx) {
          conflicts.push({
            type: 'backward_jump',
            severity: 'warning',
            message: `题"${q.title}"的分支"${optionText}"跳转回前面的题目，可能造成循环`,
            questionId: q.id
          });
        }
      });
    }
  });

  const detectCycles = () => {
    const cycles = [];
    const dfs = (startId, currentId, path) => {
      if (path.includes(currentId)) {
        if (currentId === startId && path.length > 1) {
          cycles.push([...path, currentId]);
        }
        return;
      }
      const q = questions.find(x => x.id === currentId);
      if (!q || !q.branching) return;
      path.push(currentId);
      Object.values(q.branching).forEach(targetId => {
        dfs(startId, targetId, path);
      });
      path.pop();
    };
    questions.forEach(q => dfs(q.id, q.id, []));
    return cycles;
  };

  const cycles = detectCycles();
  cycles.forEach(cycle => {
    const titles = cycle.map(id => questions.find(q => q.id === id)?.title || id).join(' → ');
    conflicts.push({
      type: 'cycle',
      severity: 'error',
      message: `检测到循环跳转: ${titles}`,
      questionId: cycle[0]
    });
  });

  const reachable = new Set();
  const traverse = (idx) => {
    if (idx >= questions.length) return;
    const q = questions[idx];
    if (reachable.has(q.id)) return;
    reachable.add(q.id);
    if (q.branching) {
      Object.values(q.branching).forEach(targetId => {
        const targetIdx = qIndexMap[targetId];
        if (targetIdx !== undefined) traverse(targetIdx);
      });
    }
    traverse(idx + 1);
  };
  traverse(0);

  questions.forEach((q, idx) => {
    if (idx > 0 && !reachable.has(q.id)) {
      conflicts.push({
        type: 'unreachable',
        severity: 'warning',
        message: `题"${q.title}"可能无法通过正常流程到达`,
        questionId: q.id
      });
    }
  });

  res.json({ branches, conflicts, questions: questions.map(q => ({ id: q.id, title: q.title, type: q.type })) });
});

router.post('/:surveyId/simulate', (req, res) => {
  const db = getDB();
  const survey = db.prepare('SELECT questions FROM surveys WHERE id = ?').get(req.params.surveyId);
  if (!survey) {
    return res.status(404).json({ error: '问卷不存在' });
  }
  const questions = JSON.parse(survey.questions);
  const { answers } = req.body;
  if (!answers) {
    return res.status(400).json({ error: '请提供模拟答案' });
  }

  const qIndexMap = {};
  questions.forEach((q, i) => { qIndexMap[q.id] = i; });

  const path = [];
  let idx = 0;
  const maxSteps = questions.length * 3;
  let steps = 0;

  while (idx < questions.length && steps < maxSteps) {
    steps++;
    const q = questions[idx];
    path.push({
      questionId: q.id,
      questionTitle: q.title,
      answer: answers[q.id] !== undefined ? answers[q.id] : null,
      index: idx
    });

    let nextIdx = idx + 1;
    if (q.type === 'single' && q.branching) {
      const userAnswer = answers[q.id];
      if (userAnswer !== undefined && userAnswer !== null) {
        const optionIdx = q.options?.indexOf(userAnswer);
        if (optionIdx >= 0) {
          const branchKey = `${q.id}_option_${optionIdx}`;
          const targetId = q.branching[branchKey];
          if (targetId && qIndexMap[targetId] !== undefined) {
            nextIdx = qIndexMap[targetId];
          }
        }
      }
    }

    if (nextIdx <= idx && nextIdx !== idx + 1) {
      path.push({ warning: '检测到循环或回退，模拟终止' });
      break;
    }
    idx = nextIdx;
  }

  res.json({ path, totalQuestions: questions.length, visitedCount: path.filter(p => p.questionId).length });
});

module.exports = router;
