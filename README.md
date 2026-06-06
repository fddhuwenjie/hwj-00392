# 在线问卷调查系统

## 项目结构

```
hwj-00392/
├── backend/          # 后端服务 (Node.js + Express + SQLite, 端口 8392)
│   ├── server.js         # 入口文件
│   ├── db.js             # 数据库初始化和种子数据
│   ├── routes/           # API 路由
│   │   ├── surveys.js        # 问卷 CRUD、发布、暂停/恢复
│   │   ├── responses.js      # 答卷提交、查询
│   │   ├── analysis.js       # 数据分析、交叉分析
│   │   ├── export.js         # 导出 CSV/Excel/HTML报告/PDF
│   │   └── templates.js      # 模板管理
│   └── data/             # SQLite 数据库文件目录
└── frontend/         # 前端 (React + Vite + Ant Design, 端口 3392)
    ├── src/
    │   ├── api/index.js      # API 封装
    │   ├── components/       # 公共组件
    │   │   └── PublishModal.jsx  # 发布弹窗
    │   ├── pages/            # 页面
    │   │   ├── Home.jsx          # 首页
    │   │   ├── SurveyList.jsx    # 问卷列表
    │   │   ├── Editor.jsx        # 拖拽式问卷编辑器
    │   │   ├── FillSurvey.jsx    # 问卷填写页面
    │   │   ├── Analysis.jsx      # 数据分析
    │   │   ├── Templates.jsx     # 模板中心
    │   │   └── ResponseDetail.jsx # 答卷详情
    │   ├── App.jsx
    │   ├── main.jsx
    │   └── index.css
    └── vite.config.js
```

## 启动方式

### 方式一：使用启动脚本
```bash
chmod +x start.sh
./start.sh
```

### 方式二：分别启动

**后端（端口 8392）：**
```bash
cd backend
npm install
node server.js
```

**前端（端口 3392）：**
```bash
cd frontend
npm install
npm run dev
```

启动后访问：
- 前端管理台：http://localhost:3392
- 后端 API：http://localhost:8392/api/health

## 功能说明

### 1. 问卷设计
- ✅ 可视化拖拽式编辑器（基于 dnd-kit）
- ✅ 7 种题型：单选、多选、文本填空、评分(1-5星)、矩阵题、排序题、NPS评分
- ✅ 每题可设置必填/选填
- ✅ 分支逻辑（单选题根据答案跳转到指定题目）
- ✅ 问卷展示模式：全部展示 / 一题一页

### 2. 问卷发布
- ✅ 设置开始/结束时间
- ✅ 设置最大回收量
- ✅ 密码保护（可选）
- ✅ 自动生成短链接
- ✅ 二维码（文本模拟显示）
- ✅ 发布后不可修改题目（可新建副本）
- ✅ 支持暂停/恢复收集

### 3. 填写体验
- ✅ 一题一页或全部展示两种模式
- ✅ 进度条显示完成百分比
- ✅ 必填题未答时红框提示
- ✅ 移动端自适应
- ✅ 提交前确认页显示所有已填答案
- ✅ 分支逻辑跳转支持

### 4. 数据分析
- ✅ 实时统计
  - 单选/多选：饼图 + 柱状图 + 百分比
  - 文本：词云 + 样例展示
  - 评分：均值 + 分布直方图
  - NPS：评分 + 推荐者/中立者/贬损者分布
  - 矩阵题：交叉统计表
  - 排序题：平均排名
- ✅ 交叉分析：选择两道题分析相关性
- ✅ 筛选：按题目答案过滤回收数据

### 5. 导出报告
- ✅ 导出原始数据（CSV 格式）
- ✅ 导出原始数据（Excel 格式）
- ✅ 导出分析报告（HTML 带图表）
- ✅ 单份答卷详情查看
- ✅ 单份答卷导出 PDF（HTML 格式）

### 6. 模板系统
- ✅ 预置 5 套常用模板：
  1. 满意度调查
  2. 活动报名
  3. 员工反馈
  4. 产品调研
  5. 考试测验
- ✅ 用户可保存自己的问卷为模板复用
- ✅ 模板分类筛选

## 预置数据

系统首次启动时自动创建：
1. **预置满意度调查问卷**（10道题，涵盖所有题型）
2. **20 份模拟回收数据**（随机生成）
3. **5 套预置模板**

## 技术栈

**后端：**
- Node.js + Express
- better-sqlite3（嵌入式数据库）
- exceljs（Excel 导出）
- json2csv（CSV 导出）
- uuid

**前端：**
- React 18 + Vite
- Ant Design 5
- React Router 6
- Chart.js + react-chartjs-2（图表）
- @dnd-kit（拖拽排序）
- axios（HTTP 请求）
- dayjs（日期处理）
