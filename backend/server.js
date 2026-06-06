const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDB, getDB } = require('./db');

const surveyRoutes = require('./routes/surveys');
const responseRoutes = require('./routes/responses');
const analysisRoutes = require('./routes/analysis');
const templateRoutes = require('./routes/templates');
const exportRoutes = require('./routes/export');

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

app.listen(PORT, () => {
  console.log(`Survey backend server running on port ${PORT}`);
  console.log(`API: http://localhost:${PORT}/api`);
});
