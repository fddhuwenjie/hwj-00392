const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const DB_PATH = path.join(__dirname, 'data', 'survey.db');

let db;

function getDB() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
  }
  return db;
}

function columnExists(tableName, columnName) {
  const cols = db.prepare(`PRAGMA table_info(${tableName})`).all();
  return cols.some(c => c.name === columnName);
}

function migrateTables() {
  if (!columnExists('surveys', 'scheduled_publish_time')) {
    db.exec('ALTER TABLE surveys ADD COLUMN scheduled_publish_time TEXT');
  }
  if (!columnExists('responses', 'quality_score')) {
    db.exec('ALTER TABLE responses ADD COLUMN quality_score INTEGER DEFAULT 100');
  }
  if (!columnExists('responses', 'quality_flags')) {
    db.exec('ALTER TABLE responses ADD COLUMN quality_flags TEXT');
  }
  if (!columnExists('responses', 'duration_seconds')) {
    db.exec('ALTER TABLE responses ADD COLUMN duration_seconds INTEGER DEFAULT 0');
  }
}

function initDB() {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables();
  migrateTables();
  seedData();
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS surveys (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      questions TEXT NOT NULL,
      status TEXT DEFAULT 'draft',
      display_mode TEXT DEFAULT 'all',
      start_time TEXT,
      end_time TEXT,
      max_responses INTEGER,
      password TEXT,
      short_code TEXT UNIQUE,
      is_paused INTEGER DEFAULT 0,
      scheduled_publish_time TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      updated_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS responses (
      id TEXT PRIMARY KEY,
      survey_id TEXT NOT NULL,
      answers TEXT NOT NULL,
      submit_time TEXT DEFAULT (datetime('now','localtime')),
      respondent_info TEXT,
      quality_score INTEGER DEFAULT 100,
      quality_flags TEXT,
      duration_seconds INTEGER DEFAULT 0,
      FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      category TEXT,
      questions TEXT NOT NULL,
      is_builtin INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS collaborators (
      id TEXT PRIMARY KEY,
      survey_id TEXT NOT NULL,
      email TEXT NOT NULL,
      name TEXT,
      permission TEXT DEFAULT 'edit',
      invited_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
      UNIQUE(survey_id, email)
    );

    CREATE TABLE IF NOT EXISTS edit_locks (
      id TEXT PRIMARY KEY,
      survey_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      user_name TEXT,
      locked_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
      UNIQUE(survey_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS operation_logs (
      id TEXT PRIMARY KEY,
      survey_id TEXT NOT NULL,
      user_email TEXT NOT NULL,
      user_name TEXT,
      action TEXT NOT NULL,
      question_id TEXT,
      question_title TEXT,
      detail TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS quota_rules (
      id TEXT PRIMARY KEY,
      survey_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      question_title TEXT,
      answer_value TEXT NOT NULL,
      max_count INTEGER NOT NULL DEFAULT 0,
      current_count INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      survey_id TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS milestone_notified (
      id TEXT PRIMARY KEY,
      survey_id TEXT NOT NULL,
      milestone INTEGER NOT NULL,
      notified_at TEXT DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (survey_id) REFERENCES surveys(id) ON DELETE CASCADE,
      UNIQUE(survey_id, milestone)
    );

    CREATE INDEX IF NOT EXISTS idx_responses_survey ON responses(survey_id);
    CREATE INDEX IF NOT EXISTS idx_surveys_short ON surveys(short_code);
    CREATE INDEX IF NOT EXISTS idx_collaborators_survey ON collaborators(survey_id);
    CREATE INDEX IF NOT EXISTS idx_logs_survey ON operation_logs(survey_id);
    CREATE INDEX IF NOT EXISTS idx_quotas_survey ON quota_rules(survey_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(is_read);
  `);
}

function generateShortCode() {
  return Math.random().toString(36).substring(2, 8);
}

function seedData() {
  const tplCount = db.prepare('SELECT COUNT(*) as cnt FROM templates').get().cnt;
  if (tplCount === 0) {
    seedTemplates();
  }

  const surveyCount = db.prepare('SELECT COUNT(*) as cnt FROM surveys').get().cnt;
  if (surveyCount === 0) {
    seedSatisfactionSurvey();
  }
}

function seedTemplates() {
  const insertTpl = db.prepare(`
    INSERT INTO templates (id, name, description, category, questions, is_builtin)
    VALUES (?, ?, ?, ?, ?, 1)
  `);

  const tpl1Questions = JSON.stringify([
    { id: 'q1', type: 'rating', title: '整体满意度评分', required: true, maxStars: 5 },
    { id: 'q2', type: 'single', title: '您最满意的方面', required: true, options: ['产品质量', '服务态度', '配送速度', '价格优惠', '售后服务'] },
    { id: 'q3', type: 'multi', title: '您希望我们改进的方面（可多选）', required: false, options: ['产品种类', '包装设计', '物流速度', '客服响应', '促销活动'] },
    { id: 'q4', type: 'text', title: '其他建议或意见', required: false }
  ]);

  const tpl2Questions = JSON.stringify([
    { id: 'q1', type: 'single', title: '活动名称', required: true, options: ['产品发布会', '技术沙龙', '用户见面会', '培训课程'] },
    { id: 'q2', type: 'text', title: '您的姓名', required: true },
    { id: 'q3', type: 'text', title: '联系电话', required: true },
    { id: 'q4', type: 'text', title: '电子邮箱', required: false },
    { id: 'q5', type: 'single', title: '参与人数', required: true, options: ['1人', '2人', '3人', '4人及以上'] },
    { id: 'q6', type: 'text', title: '特殊需求或备注', required: false }
  ]);

  const tpl3Questions = JSON.stringify([
    { id: 'q1', type: 'nps', title: '您有多大可能向朋友或同事推荐我们公司？', required: true },
    { id: 'q2', type: 'single', title: '您对当前工作环境满意吗？', required: true, options: ['非常满意', '满意', '一般', '不满意', '非常不满意'] },
    { id: 'q3', type: 'multi', title: '您认为公司哪些方面做得好（可多选）', required: false, options: ['团队氛围', '薪酬福利', '职业发展', '工作内容', '管理方式'] },
    { id: 'q4', type: 'rating', title: '对直属领导的评分', required: true, maxStars: 5 },
    { id: 'q5', type: 'text', title: '您对公司的建议', required: false }
  ]);

  const tpl4Questions = JSON.stringify([
    { id: 'q1', type: 'text', title: '产品名称/型号', required: true },
    { id: 'q2', type: 'single', title: '您使用该产品多久了？', required: true, options: ['不到1个月', '1-6个月', '6-12个月', '1年以上'] },
    { id: 'q3', type: 'matrix', title: '请对以下方面评分', required: true, rows: ['产品功能', '易用性', '稳定性', '界面设计', '性价比'], cols: ['很差', '较差', '一般', '较好', '很好'] },
    { id: 'q4', type: 'multi', title: '您最常使用的功能（可多选）', required: false, options: ['核心功能A', '核心功能B', '扩展功能C', '数据分析', '报表导出'] },
    { id: 'q5', type: 'text', title: '您最希望增加的功能', required: false }
  ]);

  const tpl5Questions = JSON.stringify([
    { id: 'q1', type: 'single', title: '1+1等于几？', required: true, options: ['1', '2', '3', '4'] },
    { id: 'q2', type: 'single', title: '中国的首都是？', required: true, options: ['上海', '广州', '北京', '深圳'] },
    { id: 'q3', type: 'multi', title: '以下哪些是编程语言（多选）', required: true, options: ['JavaScript', 'Python', 'HTML', 'Java', 'CSS'] },
    { id: 'q4', type: 'single', title: '地球是行星还是恒星？', required: true, options: ['行星', '恒星', '卫星', '彗星'] },
    { id: 'q5', type: 'text', title: '请简述您的答题思路', required: false }
  ]);

  const tx = db.transaction(() => {
    insertTpl.run(uuidv4(), '满意度调查', '适用于产品/服务满意度收集', '满意度', tpl1Questions);
    insertTpl.run(uuidv4(), '活动报名', '适用于各类活动报名登记', '报名', tpl2Questions);
    insertTpl.run(uuidv4(), '员工反馈', '适用于企业内部员工满意度调查', '内部', tpl3Questions);
    insertTpl.run(uuidv4(), '产品调研', '适用于产品使用体验和功能调研', '产品', tpl4Questions);
    insertTpl.run(uuidv4(), '考试测验', '适用于知识考核和测验', '考试', tpl5Questions);
  });
  tx();
}

function seedSatisfactionSurvey() {
  const surveyId = uuidv4();
  const shortCode = generateShortCode();

  const questions = JSON.stringify([
    {
      id: 'q1',
      type: 'single',
      title: '1. 您是通过什么渠道了解我们产品的？',
      required: true,
      options: ['朋友推荐', '搜索引擎', '社交媒体', '广告投放', '线下门店', '其他'],
      branching: null
    },
    {
      id: 'q2',
      type: 'nps',
      title: '2. 您有多大可能向朋友或同事推荐我们的产品？（0分完全不可能，10分非常可能）',
      required: true,
      branching: null
    },
    {
      id: 'q3',
      type: 'rating',
      title: '3. 请对我们产品的整体满意度评分',
      required: true,
      maxStars: 5,
      branching: null
    },
    {
      id: 'q4',
      type: 'matrix',
      title: '4. 请对以下各维度进行评分',
      required: true,
      rows: ['产品质量', '服务态度', '物流配送', '包装外观', '价格合理性', '售后支持'],
      cols: ['非常不满意', '不满意', '一般', '满意', '非常满意'],
      branching: null
    },
    {
      id: 'q5',
      type: 'multi',
      title: '5. 您最喜欢我们产品的哪些特点？（可多选）',
      required: true,
      options: ['功能强大', '操作简单', '界面美观', '性能稳定', '价格实惠', '客服专业', '更新及时'],
      branching: null
    },
    {
      id: 'q6',
      type: 'sort',
      title: '6. 请按重要性对以下因素排序（最重要排第一）',
      required: true,
      options: ['产品质量', '价格', '品牌知名度', '售后服务', '外观设计', '功能丰富度'],
      branching: null
    },
    {
      id: 'q7',
      type: 'single',
      title: '7. 您未来是否会继续购买我们的产品？',
      required: true,
      options: ['肯定会', '可能会', '不确定', '可能不会', '肯定不会'],
      branching: { q7_option_3: 'q9' }
    },
    {
      id: 'q8',
      type: 'text',
      title: '8. 如果选择"可能不会"或"肯定不会"，请告诉我们原因',
      required: false,
      branching: null
    },
    {
      id: 'q9',
      type: 'text',
      title: '9. 您对我们有什么建议或期待？',
      required: false,
      branching: null
    },
    {
      id: 'q10',
      type: 'text',
      title: '10. 请留下您的联系方式（选填，方便我们联系您发放礼品）',
      required: false,
      branching: null
    }
  ]);

  const insertSurvey = db.prepare(`
    INSERT INTO surveys (id, title, description, questions, status, display_mode, start_time, end_time, max_responses, short_code, is_paused)
    VALUES (?, ?, ?, ?, 'published', 'all', ?, ?, 1000, ?, 0)
  `);

  const now = new Date();
  const startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const endTime = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  insertSurvey.run(surveyId, '用户满意度调查问卷', '感谢您抽出宝贵时间参与我们的满意度调查，您的反馈对我们非常重要！', questions, startTime, endTime, shortCode);

  seedResponses(surveyId);
}

function seedResponses(surveyId) {
  const insertResp = db.prepare(`
    INSERT INTO responses (id, survey_id, answers, respondent_info)
    VALUES (?, ?, ?, ?)
  `);

  const channelOptions = ['朋友推荐', '搜索引擎', '社交媒体', '广告投放', '线下门店', '其他'];
  const willBuyOptions = ['肯定会', '可能会', '不确定', '可能不会', '肯定不会'];
  const matrixCols = ['非常不满意', '不满意', '一般', '满意', '非常满意'];
  const featureOptions = ['功能强大', '操作简单', '界面美观', '性能稳定', '价格实惠', '客服专业', '更新及时'];
  const sortOptions = ['产品质量', '价格', '品牌知名度', '售后服务', '外观设计', '功能丰富度'];

  const randomPick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const randomMultiPick = (arr, min = 2) => {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, min + Math.floor(Math.random() * (arr.length - min)));
  };
  const randomSort = (arr) => [...arr].sort(() => Math.random() - 0.5);
  const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

  const textResponses = [
    '整体体验很好，希望继续保持！',
    '产品质量不错，客服也很耐心。',
    '建议增加更多颜色选择。',
    '物流速度可以再快一些。',
    '性价比很高，会推荐给朋友。',
    '界面设计很漂亮，用起来很舒服。',
    '希望能推出更多优惠活动。',
    '功能很实用，满足日常需求。',
    '售后服务很到位，点赞！',
    '继续加油，期待更好的产品！'
  ];

  const contactInfo = [
    '138****1234',
    'user@example.com',
    '159****5678',
    'customer@email.com',
    '',
    '186****9012',
    '',
    'test@demo.com',
    '137****3456',
    ''
  ];

  const tx = db.transaction(() => {
    for (let i = 0; i < 20; i++) {
      const q7Answer = randomPick(willBuyOptions);
      const q8Answer = (q7Answer === '可能不会' || q7Answer === '肯定不会') ? randomPick(textResponses) : '';

      const answers = JSON.stringify({
        q1: randomPick(channelOptions),
        q2: randomInt(0, 10),
        q3: randomInt(3, 5),
        q4: {
          '产品质量': randomPick(matrixCols),
          '服务态度': randomPick(matrixCols),
          '物流配送': randomPick(matrixCols),
          '包装外观': randomPick(matrixCols),
          '价格合理性': randomPick(matrixCols),
          '售后支持': randomPick(matrixCols)
        },
        q5: randomMultiPick(featureOptions, 2),
        q6: randomSort(sortOptions),
        q7: q7Answer,
        q8: q8Answer,
        q9: Math.random() > 0.4 ? randomPick(textResponses) : '',
        q10: contactInfo[i % contactInfo.length]
      });

      const respondentInfo = JSON.stringify({
        submitOrder: i + 1,
        source: Math.random() > 0.5 ? 'mobile' : 'pc'
      });

      const submitTime = new Date(Date.now() - (20 - i) * 3600 * 1000).toISOString();

      const respId = uuidv4();
      insertResp.run(respId, surveyId, answers, respondentInfo);
      db.prepare('UPDATE responses SET submit_time = ? WHERE id = ?').run(submitTime, respId);
    }
  });
  tx();
}

module.exports = { initDB, getDB, generateShortCode };
