import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
});

export default {
  getSurveys: () => api.get('/surveys'),
  getSurvey: (id) => api.get(`/surveys/${id}`),
  getSurveyByShortCode: (code) => api.get(`/surveys/short/${code}`),
  createSurvey: (data) => api.post('/surveys', data),
  updateSurvey: (id, data) => api.put(`/surveys/${id}`, data),
  deleteSurvey: (id) => api.delete(`/surveys/${id}`),
  copySurvey: (id) => api.post(`/surveys/${id}/copy`),
  publishSurvey: (id, data) => api.post(`/surveys/${id}/publish`, data),
  unpublishSurvey: (id) => api.post(`/surveys/${id}/unpublish`),
  pauseSurvey: (id) => api.post(`/surveys/${id}/pause`),
  resumeSurvey: (id) => api.post(`/surveys/${id}/resume`),
  verifyPassword: (id, password) => api.post(`/surveys/${id}/verify-password`, { password }),

  submitResponse: (data) => api.post('/responses', data),
  getResponses: (surveyId, params) => api.get(`/responses/survey/${surveyId}`, { params }),
  getResponse: (id) => api.get(`/responses/${id}`),

  getAnalysis: (surveyId) => api.get(`/analysis/survey/${surveyId}`),
  getCrossAnalysis: (surveyId, q1, q2) => api.get(`/analysis/cross/${surveyId}`, { params: { q1, q2 } }),

  getTemplates: () => api.get('/templates'),
  createTemplate: (data) => api.post('/templates', data),
  deleteTemplate: (id) => api.delete(`/templates/${id}`),

  exportCsv: (surveyId) => `/api/export/csv/${surveyId}`,
  exportExcel: (surveyId) => `/api/export/excel/${surveyId}`,
  exportReport: (surveyId) => `/api/export/report/${surveyId}`,
  exportResponsePdf: (responseId) => `/api/export/response/pdf/${responseId}`
};
