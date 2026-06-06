const express = require('express');
const { Parser } = require('json2csv');
const ExcelJS = require('exceljs');
const { getDB } = require('../db');

const router = express.Router();

router.get('/csv/:surveyId', (req, res) => {
  const db = getDB();
  const survey = db.prepare('SELECT * FROM surveys WHERE id = ? AND is_deleted = 0').get(req.params.surveyId);
  if (!survey) {
    return res.status(404).json({ error: '问卷不存在' });
  }

  const questions = JSON.parse(survey.questions);
  const responses = db.prepare('SELECT * FROM responses WHERE survey_id = ? ORDER BY submit_time').all(req.params.surveyId);

  const fields = ['序号', '提交时间'];
  questions.forEach(q => fields.push(q.title));

  const data = responses.map((r, idx) => {
    const answers = JSON.parse(r.answers);
    const row = {
      '序号': idx + 1,
      '提交时间': r.submit_time
    };
    questions.forEach(q => {
      const val = answers[q.id];
      if (Array.isArray(val)) {
        row[q.title] = val.join('、');
      } else if (typeof val === 'object' && val !== null) {
        row[q.title] = Object.entries(val).map(([k, v]) => `${k}:${v}`).join('；');
      } else {
        row[q.title] = val !== undefined ? val : '';
      }
    });
    return row;
  });

  try {
    const json2csv = new Parser({ fields });
    const csv = json2csv.parse(data);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="survey_${req.params.surveyId}.csv"`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    res.status(500).json({ error: '导出失败' });
  }
});

router.get('/excel/:surveyId', async (req, res) => {
  try {
    const db = getDB();
    const survey = db.prepare('SELECT * FROM surveys WHERE id = ? AND is_deleted = 0').get(req.params.surveyId);
    if (!survey) {
      return res.status(404).json({ error: '问卷不存在' });
    }

    const questions = JSON.parse(survey.questions);
    const responses = db.prepare('SELECT * FROM responses WHERE survey_id = ? ORDER BY submit_time').all(req.params.surveyId);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('问卷数据');

    const headers = ['序号', '提交时间', ...questions.map(q => q.title)];
    worksheet.addRow(headers);
    worksheet.getRow(1).font = { bold: true };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    responses.forEach((r, idx) => {
      const answers = JSON.parse(r.answers);
      const row = [idx + 1, r.submit_time];
      questions.forEach(q => {
        const val = answers[q.id];
        if (Array.isArray(val)) {
          row.push(val.join('、'));
        } else if (typeof val === 'object' && val !== null) {
          row.push(Object.entries(val).map(([k, v]) => `${k}:${v}`).join('；'));
        } else {
          row.push(val !== undefined ? val : '');
        }
      });
      worksheet.addRow(row);
    });

    worksheet.columns.forEach((col, idx) => {
      col.width = Math.max(headers[idx].length * 2, 15);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="survey_${req.params.surveyId}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '导出失败', detail: err.message });
  }
});

router.get('/report/:surveyId', async (req, res) => {
  try {
    const db = getDB();
    const survey = db.prepare('SELECT * FROM surveys WHERE id = ? AND is_deleted = 0').get(req.params.surveyId);
    if (!survey) {
      return res.status(404).json({ error: '问卷不存在' });
    }

    const questions = JSON.parse(survey.questions);
    const responses = db.prepare('SELECT * FROM responses WHERE survey_id = ?').all(req.params.surveyId);
    const answerData = responses.map(r => ({ ...r, answers: JSON.parse(r.answers) }));

    const analysisData = {};
    questions.forEach(q => {
      analysisData[q.id] = analyzeQuestion(q, answerData);
    });

    const html = generateReportHtml(survey, questions, analysisData, responses.length);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="report_${req.params.surveyId}.html"`);
    res.send(html);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: '生成报告失败', detail: err.message });
  }
});

router.get('/response/pdf/:responseId', async (req, res) => {
  try {
    const db = getDB();
    const response = db.prepare('SELECT * FROM responses WHERE id = ?').get(req.params.responseId);
    if (!response) {
      return res.status(404).json({ error: '答卷不存在' });
    }

    const survey = db.prepare('SELECT * FROM surveys WHERE id = ? AND is_deleted = 0').get(response.survey_id);
    if (!survey) {
      return res.status(404).json({ error: '问卷不存在' });
    }
    const questions = JSON.parse(survey.questions);
    const answers = JSON.parse(response.answers);

    let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>答卷详情 - ${response.id.substring(0, 8)}</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 20px; color: #333; }
h1 { color: #1890ff; border-bottom: 2px solid #1890ff; padding-bottom: 10px; }
h2 { color: #555; font-size: 18px; }
.q-block { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 8px; }
.q-title { font-weight: bold; margin-bottom: 8px; color: #333; }
.q-answer { color: #1890ff; font-size: 15px; }
.q-answer .rating { color: #fadb14; }
.meta { color: #888; font-size: 13px; margin-bottom: 20px; }
</style>
</head>
<body>
<h1>${survey.title}</h1>
<div class="meta">
  <p>答卷ID: ${response.id.substring(0, 8)}...</p>
  <p>提交时间: ${response.submit_time}</p>
</div>`;

    questions.forEach((q, idx) => {
      const ans = answers[q.id];
      let display = '-';
      if (ans !== undefined && ans !== null && ans !== '') {
        if (q.type === 'rating') {
          display = '<span class="rating">' + '★'.repeat(parseInt(ans)) + '☆'.repeat((q.maxStars || 5) - parseInt(ans)) + '</span>';
        } else if (q.type === 'nps') {
          display = ans + ' 分';
        } else if (Array.isArray(ans)) {
          display = ans.join('、');
        } else if (typeof ans === 'object' && ans !== null) {
          display = Object.entries(ans).map(([k, v]) => `<div style="margin-left:20px">${k}: ${v}</div>`).join('');
        } else {
          display = String(ans);
        }
      }
      html += `<div class="q-block">
        <div class="q-title">${q.title}</div>
        <div class="q-answer">${display}</div>
      </div>`;
    });

    html += '</body></html>';

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="response_${req.params.responseId}.html"`);
    res.send(html);
  } catch (err) {
    res.status(500).json({ error: '导出失败', detail: err.message });
  }
});

function analyzeQuestion(question, responses) {
  const answers = responses.map(r => r.answers[question.id]).filter(a => a !== undefined && a !== null && a !== '');
  const result = { type: question.type, total: answers.length };

  switch (question.type) {
    case 'single':
      const sCounts = {};
      question.options.forEach(o => sCounts[o] = 0);
      answers.forEach(a => { if (sCounts[a] !== undefined) sCounts[a]++; });
      result.counts = sCounts;
      result.options = question.options;
      break;
    case 'multi':
      const mCounts = {};
      question.options.forEach(o => mCounts[o] = 0);
      answers.forEach(arr => { if (Array.isArray(arr)) arr.forEach(a => { if (mCounts[a] !== undefined) mCounts[a]++; }); });
      result.counts = mCounts;
      result.options = question.options;
      break;
    case 'rating':
      let rSum = 0; let rCount = 0;
      answers.forEach(a => { const n = parseInt(a); if (!isNaN(n)) { rSum += n; rCount++; } });
      result.average = rCount > 0 ? (rSum / rCount).toFixed(2) : 0;
      break;
    case 'nps':
      let prom = 0, pass = 0, detr = 0;
      answers.forEach(a => {
        const n = parseInt(a);
        if (!isNaN(n)) {
          if (n >= 9) prom++;
          else if (n >= 7) pass++;
          else detr++;
        }
      });
      const npsTotal = prom + pass + detr;
      result.promoters = prom; result.passives = pass; result.detractors = detr;
      result.nps_score = npsTotal > 0 ? (((prom - detr) / npsTotal) * 100).toFixed(2) : 0;
      break;
    case 'text':
      result.samples = answers.filter(a => typeof a === 'string' && a.length > 0).slice(0, 10);
      break;
    case 'matrix':
      const mxResult = {};
      question.rows.forEach(row => {
        mxResult[row] = {};
        question.cols.forEach(col => mxResult[row][col] = 0);
      });
      answers.forEach(a => {
        if (typeof a === 'object' && a !== null) {
          Object.entries(a).forEach(([row, col]) => {
            if (mxResult[row] && mxResult[row][col] !== undefined) mxResult[row][col]++;
          });
        }
      });
      result.matrix = mxResult;
      result.rows = question.rows;
      result.cols = question.cols;
      break;
  }
  return result;
}

function generateReportHtml(survey, questions, analysisData, totalResponses) {
  let html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${survey.title} - 数据分析报告</title>
<style>
body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1100px; margin: 40px auto; padding: 20px; color: #333; }
h1 { color: #1890ff; border-bottom: 3px solid #1890ff; padding-bottom: 15px; }
.summary { background: #f0f5ff; padding: 20px; border-radius: 10px; margin: 20px 0; }
.summary-item { display: inline-block; margin-right: 40px; }
.summary-item .num { font-size: 32px; font-weight: bold; color: #1890ff; }
.summary-item .label { color: #666; font-size: 14px; }
.q-section { margin: 30px 0; padding: 20px; background: #fff; border: 1px solid #eee; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
.q-title { font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #333; }
.bar-chart { display: flex; align-items: flex-end; height: 200px; margin: 20px 0; gap: 10px; }
.bar-item { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-end; }
.bar { width: 100%; background: linear-gradient(180deg, #1890ff, #40a9ff); border-radius: 4px 4px 0 0; min-height: 2px; position: relative; }
.bar .count { position: absolute; top: -20px; font-size: 12px; color: #666; width: 100%; text-align: center; }
.bar-label { font-size: 12px; color: #666; margin-top: 8px; text-align: center; word-break: break-all; }
.pie-legend { display: flex; flex-wrap: wrap; gap: 15px; margin-top: 15px; }
.pie-legend-item { display: flex; align-items: center; gap: 5px; }
.pie-color { width: 14px; height: 14px; border-radius: 3px; }
.score-box { display: inline-block; padding: 15px 30px; background: linear-gradient(135deg, #ffd700, #ffed4e); border-radius: 8px; font-size: 28px; font-weight: bold; color: #8b6914; }
.text-samples { background: #fafafa; padding: 15px; border-radius: 6px; }
.text-samples p { margin: 5px 0; color: #555; font-size: 14px; }
.matrix-table { width: 100%; border-collapse: collapse; margin-top: 10px; }
.matrix-table th, .matrix-table td { border: 1px solid #ddd; padding: 8px; text-align: center; }
.matrix-table th { background: #f5f5f5; }
</style>
</head>
<body>
<h1>${survey.title} - 数据分析报告</h1>
<div class="summary">
  <div class="summary-item"><div class="num">${totalResponses}</div><div class="label">总回收数</div></div>
  <div class="summary-item"><div class="num">${questions.length}</div><div class="label">题目数</div></div>
  <div class="summary-item"><div class="num">${survey.updated_at || survey.created_at}</div><div class="label">报告生成时间</div></div>
</div>`;

  const colors = ['#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1', '#13c2c2', '#eb2f96', '#fa8c16'];

  questions.forEach((q, idx) => {
    const analysis = analysisData[q.id] || {};
    html += `<div class="q-section">
      <div class="q-title">${idx + 1}. ${q.title} <span style="color:#999;font-weight:normal;font-size:13px">[${getTypeName(q.type)}]</span></div>`;

    if (analysis.type === 'single' || analysis.type === 'multi') {
      const total = Object.values(analysis.counts || {}).reduce((a, b) => a + b, 0);
      html += `<div class="bar-chart">`;
      (analysis.options || []).forEach((opt, i) => {
        const count = analysis.counts[opt] || 0;
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
        const height = total > 0 ? (count / Math.max(...Object.values(analysis.counts))) * 180 : 0;
        html += `<div class="bar-item">
          <div class="bar" style="height:${height}px;background:${colors[i % colors.length]}"><span class="count">${count} (${pct}%)</span></div>
          <div class="bar-label">${opt}</div>
        </div>`;
      });
      html += `</div><div class="pie-legend">`;
      (analysis.options || []).forEach((opt, i) => {
        const count = analysis.counts[opt] || 0;
        const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
        html += `<div class="pie-legend-item"><div class="pie-color" style="background:${colors[i % colors.length]}"></div>${opt}: ${count} (${pct}%)</div>`;
      });
      html += `</div>`;
    } else if (analysis.type === 'rating') {
      html += `<div class="score-box">⭐ ${analysis.average || 0}</div><span style="margin-left:20px;color:#666">平均评分（满分5星）</span>`;
    } else if (analysis.type === 'nps') {
      html += `<div class="score-box" style="background:${parseFloat(analysis.nps_score) >= 0 ? 'linear-gradient(135deg, #52c41a, #95de64)' : 'linear-gradient(135deg, #f5222d, #ff7875)'};color:#fff">${analysis.nps_score || 0}</div><span style="margin-left:20px;color:#666">NPS 评分</span>`;
      html += `<p style="margin-top:15px">推荐者(9-10分): ${analysis.promoters || 0}人 | 中立者(7-8分): ${analysis.passives || 0}人 | 贬损者(0-6分): ${analysis.detractors || 0}人</p>`;
    } else if (analysis.type === 'text' && analysis.samples) {
      html += `<div class="text-samples"><strong>有效回答 ${analysis.total} 条，示例：</strong>`;
      analysis.samples.forEach(s => { html += `<p>• ${s}</p>`; });
      html += `</div>`;
    } else if (analysis.type === 'matrix' && analysis.matrix) {
      html += `<table class="matrix-table"><tr><th></th>`;
      (analysis.cols || []).forEach(col => { html += `<th>${col}</th>`; });
      html += `</tr>`;
      (analysis.rows || []).forEach(row => {
        html += `<tr><td>${row}</td>`;
        (analysis.cols || []).forEach(col => {
          html += `<td>${analysis.matrix[row][col] || 0}</td>`;
        });
        html += `</tr>`;
      });
      html += `</table>`;
    } else if (analysis.type === 'sort') {
      html += `<p>（排序题统计）</p>`;
    }

    html += `</div>`;
  });

  html += '</body></html>';
  return html;
}

function getTypeName(type) {
  const map = {
    single: '单选题', multi: '多选题', text: '填空题', rating: '评分题',
    nps: 'NPS评分', matrix: '矩阵题', sort: '排序题'
  };
  return map[type] || type;
}

module.exports = router;
