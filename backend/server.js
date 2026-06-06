const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB, getDB } = require('./db');
const { addNotification } = require('./routes/notifications');

const surveyRoutes = require('./routes/surveys');
const responseRoutes = require('./routes/responses');
const analysisRoutes = require('./routes/analysis');
const templateRoutes = require('./routes/templates');
const exportRoutes = require('./routes/export');
const collaborationRoutes = require('./routes/collaboration');
const logicRoutes = require('./routes/logic');
const quotaRoutes = require('./routes/quotas').router;
const qualityRoutes = require('./routes/quality').router;
const notificationRoutes = require('./routes/notifications').router;

const app = express();
const PORT = 8392;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

initDB();

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

app.use('/api/surveys', surveyRoutes);
app.use('/api/responses', responseRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/collaboration', collaborationRoutes);
app.use('/api/logic', logicRoutes);
app.use('/api/quotas', quotaRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/notifications', notificationRoutes);

function startScheduler() {
  const db = getDB();

  setInterval(() => {
    try {
      const now = new Date();
      const drafts = db.prepare(`
        SELECT * FROM surveys
        WHERE status = 'draft' AND scheduled_publish_time IS NOT NULL
      `).all();
      drafts.forEach(s => {
        if (s.scheduled_publish_time && new Date(s.scheduled_publish_time) <= now) {
          db.prepare(`
            UPDATE surveys SET status = 'published', scheduled_publish_time = NULL, updated_at = datetime('now','localtime')
            WHERE id = ?
          `).run(s.id);
          addNotification(db, {
            survey_id: s.id,
            type: 'scheduled_publish',
            title: '问卷已定时发布',
            content: `问卷"${s.title}"已按照预定时间自动发布`
          });
          console.log(`[Scheduler] Published survey ${s.id} on schedule`);
        }
      });
    } catch (e) {
      console.error('[Scheduler] Scheduled publish error:', e.message);
    }
  }, 30 * 1000);

  setInterval(() => {
    try {
      const surveys = db.prepare(`
        SELECT s.*, COUNT(r.id) as response_count
        FROM surveys s LEFT JOIN responses r ON s.id = r.survey_id
        WHERE s.status = 'published'
        GROUP BY s.id
      `).all();
      const milestones = [10, 50, 100, 500, 1000, 5000];
      surveys.forEach(s => {
        milestones.forEach(m => {
          if (s.response_count >= m) {
            const notified = db.prepare('SELECT * FROM milestone_notified WHERE survey_id = ? AND milestone = ?').get(s.id, m);
            if (!notified) {
              db.prepare(`
                INSERT INTO milestone_notified (id, survey_id, milestone)
                VALUES (?, ?, ?)
              `).run(require('uuid').v4(), s.id, m);
              addNotification(db, {
                survey_id: s.id,
                type: 'milestone',
                title: '回收里程碑达成!',
                content: `问卷"${s.title}"已收集${m}份答卷!`
              });
              console.log(`[Scheduler] Milestone ${m} reached for survey ${s.id}`);
            }
          }
        });
      });
    } catch (e) {
      console.error('[Scheduler] Milestone check error:', e.message);
    }
  }, 60 * 1000);

  const runDailySummary = () => {
    try {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const startOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate()).toISOString();
      const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();

      const surveys = db.prepare('SELECT * FROM surveys').all();
      surveys.forEach(s => {
        const yesterdayCount = db.prepare(`
          SELECT COUNT(*) as cnt FROM responses
          WHERE survey_id = ? AND submit_time >= ? AND submit_time < ?
        `).get(s.id, startOfDay, endOfDay).cnt;

        const beforeYesterdayCount = db.prepare(`
          SELECT COUNT(*) as cnt FROM responses
          WHERE survey_id = ? AND submit_time < ?
        `).get(s.id, startOfDay).cnt;

        if (yesterdayCount > 0 || beforeYesterdayCount > 0) {
          const totalCount = yesterdayCount + beforeYesterdayCount;
          const completionRate = s.max_responses ? ((totalCount / s.max_responses) * 100).toFixed(1) : null;
          addNotification(db, {
            survey_id: s.id,
            type: 'daily_summary',
            title: '每日数据摘要',
            content: `问卷"${s.title}"昨日新增${yesterdayCount}份，累计${totalCount}份${completionRate ? `，完成率${completionRate}%` : ''}`
          });
        }
      });

      console.log(`[Scheduler] Daily summary generated at ${new Date().toISOString()}`);
    } catch (e) {
      console.error('[Scheduler] Daily summary error:', e.message);
    }
  };

  const scheduleDailySummary = () => {
    const now = new Date();
    const nextRun = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 5, 0);
    const delay = nextRun - now;
    setTimeout(() => {
      runDailySummary();
      setInterval(runDailySummary, 24 * 60 * 60 * 1000);
    }, delay);
    console.log(`[Scheduler] Daily summary scheduled in ${(delay / 60000).toFixed(0)} minutes`);
  };

  scheduleDailySummary();

  setInterval(() => {
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
      const info = db.prepare(`
        DELETE FROM edit_locks WHERE locked_at < ?
      `).run(fiveMinutesAgo);
      if (info.changes > 0) {
        console.log(`[Scheduler] Cleaned ${info.changes} expired edit locks`);
      }
    } catch (e) {
      console.error('[Scheduler] Lock cleanup error:', e.message);
    }
  }, 60 * 1000);
}

app.listen(PORT, () => {
  console.log(`Survey backend server running on port ${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
  startScheduler();
});
