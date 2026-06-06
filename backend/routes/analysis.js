const express = require('express');
const { getDB } = require('../db');

const router = express.Router();

function getAllResponses(surveyId) {
  const db = getDB();
  const rows = db.prepare('SELECT * FROM responses WHERE survey_id = ?').all(surveyId);
  return rows.map(r => ({
    ...r,
    answers: JSON.parse(r.answers),
    respondent_info: r.respondent_info ? JSON.parse(r.respondent_info) : null
  }));
}

router.get('/survey/:surveyId', (req, res) => {
  const db = getDB();
  const survey = db.prepare('SELECT * FROM surveys WHERE id = ?').get(req.params.surveyId);
  if (!survey) {
    return res.status(404).json({ error: '问卷不存在' });
  }

  const questions = JSON.parse(survey.questions);
  const responses = getAllResponses(req.params.surveyId);

  const stats = {};

  questions.forEach(q => {
    stats[q.id] = calculateQuestionStats(q, responses);
  });

  res.json({
    survey_id: req.params.surveyId,
    total_responses: responses.length,
    stats
  });
});

function calculateQuestionStats(question, responses) {
  const answers = responses.map(r => r.answers[question.id]).filter(a => a !== undefined && a !== null && a !== '');

  switch (question.type) {
    case 'single':
      return calcSingle(question, answers);
    case 'multi':
      return calcMulti(question, answers);
    case 'text':
      return calcText(answers);
    case 'rating':
      return calcRating(answers, question.maxStars || 5);
    case 'nps':
      return calcNPS(answers);
    case 'matrix':
      return calcMatrix(question, answers);
    case 'sort':
      return calcSort(question, answers);
    default:
      return { type: question.type, total: answers.length };
  }
}

function calcSingle(question, answers) {
  const counts = {};
  question.options.forEach(opt => counts[opt] = 0);
  answers.forEach(a => {
    if (counts[a] !== undefined) counts[a]++;
  });

  const total = answers.length;
  const percentages = {};
  Object.keys(counts).forEach(k => {
    percentages[k] = total > 0 ? parseFloat(((counts[k] / total) * 100).toFixed(2)) : 0;
  });

  return {
    type: 'single',
    total,
    counts,
    percentages,
    options: question.options
  };
}

function calcMulti(question, answers) {
  const counts = {};
  question.options.forEach(opt => counts[opt] = 0);
  answers.forEach(arr => {
    if (Array.isArray(arr)) {
      arr.forEach(a => {
        if (counts[a] !== undefined) counts[a]++;
      });
    }
  });

  const totalSelections = Object.values(counts).reduce((a, b) => a + b, 0);
  const totalResponses = answers.length;
  const percentages = {};
  Object.keys(counts).forEach(k => {
    percentages[k] = totalResponses > 0 ? parseFloat(((counts[k] / totalResponses) * 100).toFixed(2)) : 0;
  });

  return {
    type: 'multi',
    total_responses: totalResponses,
    total_selections: totalSelections,
    counts,
    percentages,
    options: question.options
  };
}

function calcText(answers) {
  const wordMap = {};
  const stopWords = ['的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好', '自己', '这', 'the', 'a', 'an', 'is', 'are', 'of', 'in', 'on', 'to', 'for', 'and', 'or', 'with', 'i', 'you', 'it', 'we', 'they', 'that', 'this', 'be', 'have', 'has'];

  answers.forEach(text => {
    if (typeof text === 'string') {
      const words = text.split(/[\s,，。.!！?？;；:：、\(\)（）【】\[\]《》""''`]+/).filter(w => w.length >= 2);
      words.forEach(w => {
        const lower = w.toLowerCase();
        if (!stopWords.includes(lower)) {
          wordMap[lower] = (wordMap[lower] || 0) + 1;
        }
      });
    }
  });

  const wordCloud = Object.entries(wordMap)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 50);

  return {
    type: 'text',
    total: answers.length,
    word_cloud: wordCloud,
    samples: answers.filter(a => typeof a === 'string' && a.length > 0).slice(0, 20)
  };
}

function calcRating(answers, maxStars) {
  const counts = {};
  for (let i = 1; i <= maxStars; i++) counts[i] = 0;

  let sum = 0;
  let validCount = 0;
  answers.forEach(a => {
    const num = parseInt(a);
    if (!isNaN(num) && num >= 1 && num <= maxStars) {
      counts[num]++;
      sum += num;
      validCount++;
    }
  });

  const avg = validCount > 0 ? parseFloat((sum / validCount).toFixed(2)) : 0;
  const percentages = {};
  Object.keys(counts).forEach(k => {
    percentages[k] = validCount > 0 ? parseFloat(((counts[k] / validCount) * 100).toFixed(2)) : 0;
  });

  return {
    type: 'rating',
    total: validCount,
    average: avg,
    counts,
    percentages,
    max_stars: maxStars
  };
}

function calcNPS(answers) {
  let promoters = 0;
  let passives = 0;
  let detractors = 0;
  let validCount = 0;
  let sum = 0;

  const counts = {};
  for (let i = 0; i <= 10; i++) counts[i] = 0;

  answers.forEach(a => {
    const num = parseInt(a);
    if (!isNaN(num) && num >= 0 && num <= 10) {
      counts[num]++;
      sum += num;
      validCount++;
      if (num >= 9) promoters++;
      else if (num >= 7) passives++;
      else detractors++;
    }
  });

  const nps = validCount > 0 ? parseFloat((((promoters - detractors) / validCount) * 100).toFixed(2)) : 0;
  const avg = validCount > 0 ? parseFloat((sum / validCount).toFixed(2)) : 0;

  return {
    type: 'nps',
    total: validCount,
    average: avg,
    nps_score: nps,
    promoters,
    passives,
    detractors,
    counts,
    promoter_pct: validCount > 0 ? parseFloat(((promoters / validCount) * 100).toFixed(2)) : 0,
    passive_pct: validCount > 0 ? parseFloat(((passives / validCount) * 100).toFixed(2)) : 0,
    detractor_pct: validCount > 0 ? parseFloat(((detractors / validCount) * 100).toFixed(2)) : 0
  };
}

function calcMatrix(question, answers) {
  const result = {};
  question.rows.forEach(row => {
    result[row] = {};
    question.cols.forEach(col => {
      result[row][col] = 0;
    });
  });

  let validCount = 0;
  answers.forEach(a => {
    if (typeof a === 'object' && a !== null) {
      let hasValid = false;
      Object.entries(a).forEach(([row, col]) => {
        if (result[row] && result[row][col] !== undefined) {
          result[row][col]++;
          hasValid = true;
        }
      });
      if (hasValid) validCount++;
    }
  });

  return {
    type: 'matrix',
    total: validCount,
    rows: question.rows,
    cols: question.cols,
    counts: result
  };
}

function calcSort(question, answers) {
  const rankingSums = {};
  const counts = {};
  question.options.forEach(opt => {
    rankingSums[opt] = 0;
    counts[opt] = 0;
  });

  let validCount = 0;
  answers.forEach(arr => {
    if (Array.isArray(arr)) {
      arr.forEach((opt, idx) => {
        if (rankingSums[opt] !== undefined) {
          rankingSums[opt] += (idx + 1);
          counts[opt]++;
        }
      });
      validCount++;
    }
  });

  const avgRanks = {};
  Object.keys(rankingSums).forEach(k => {
    avgRanks[k] = counts[k] > 0 ? parseFloat((rankingSums[k] / counts[k]).toFixed(2)) : 0;
  });

  const sortedOptions = question.options
    .map(opt => ({ option: opt, avg_rank: avgRanks[opt] }))
    .sort((a, b) => a.avg_rank - b.avg_rank);

  return {
    type: 'sort',
    total: validCount,
    options: question.options,
    avg_ranks: avgRanks,
    sorted_options: sortedOptions
  };
}

router.get('/cross/:surveyId', (req, res) => {
  const db = getDB();
  const { q1, q2 } = req.query;

  if (!q1 || !q2) {
    return res.status(400).json({ error: '需要指定两个题目ID' });
  }

  const survey = db.prepare('SELECT * FROM surveys WHERE id = ?').get(req.params.surveyId);
  if (!survey) {
    return res.status(404).json({ error: '问卷不存在' });
  }

  const questions = JSON.parse(survey.questions);
  const question1 = questions.find(q => q.id === q1);
  const question2 = questions.find(q => q.id === q2);

  if (!question1 || !question2) {
    return res.status(400).json({ error: '题目不存在' });
  }

  const responses = getAllResponses(req.params.surveyId);

  const result = {};
  const options1 = question1.options || [''];
  const options2 = question2.options || [''];

  options1.forEach(opt1 => {
    result[opt1] = {};
    options2.forEach(opt2 => {
      result[opt1][opt2] = 0;
    });
    result[opt1].__total = 0;
  });
  result.__total = {};
  options2.forEach(opt2 => {
    result.__total[opt2] = 0;
  });
  result.__total.__total = 0;

  responses.forEach(r => {
    const a1 = r.answers[q1];
    const a2 = r.answers[q2];
    if (a1 !== undefined && a2 !== undefined) {
      const answers1 = Array.isArray(a1) ? a1 : [a1];
      const answers2 = Array.isArray(a2) ? a2 : [a2];

      answers1.forEach(ans1 => {
        if (result[ans1]) {
          answers2.forEach(ans2 => {
            if (result[ans1][ans2] !== undefined) {
              result[ans1][ans2]++;
              result[ans1].__total++;
              result.__total[ans2]++;
              result.__total.__total++;
            }
          });
        }
      });
    }
  });

  res.json({
    question1: { id: q1, title: question1.title, options: options1 },
    question2: { id: q2, title: question2.title, options: options2 },
    matrix: result,
    total_responses: responses.length
  });
});

module.exports = router;
