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
  batchDeleteResponses: (surveyId, data) => api.delete(`/responses/survey/${surveyId}/batch`, { data }),

  getAnalysis: (surveyId) => api.get(`/analysis/survey/${surveyId}`),
  getCrossAnalysis: (surveyId, q1, q2) => api.get(`/analysis/cross/${surveyId}`, { params: { q1, q2 } }),

  getTemplates: () => api.get('/templates'),
  createTemplate: (data) => api.post('/templates', data),
  deleteTemplate: (id) => api.delete(`/templates/${id}`),

  exportCsv: (surveyId) => `/api/export/csv/${surveyId}`,
  exportExcel: (surveyId) => `/api/export/excel/${surveyId}`,
  exportReport: (surveyId) => `/api/export/report/${surveyId}`,
  exportResponsePdf: (responseId) => `/api/export/response/pdf/${responseId}`,

  getCollaborators: (surveyId) => api.get(`/collaboration/${surveyId}/collaborators`),
  addCollaborator: (surveyId, data) => api.post(`/collaboration/${surveyId}/collaborators`, data),
  updateCollaborator: (surveyId, collabId, data) => api.put(`/collaboration/${surveyId}/collaborators/${collabId}`, data),
  removeCollaborator: (surveyId, collabId) => api.delete(`/collaboration/${surveyId}/collaborators/${collabId}`),

  getLocks: (surveyId) => api.get(`/collaboration/${surveyId}/locks`),
  acquireLock: (surveyId, data) => api.post(`/collaboration/${surveyId}/locks`, data),
  releaseLock: (surveyId, questionId, data) => api.delete(`/collaboration/${surveyId}/locks/${questionId}`, { data }),

  getOperationLogs: (surveyId, params) => api.get(`/collaboration/${surveyId}/logs`, { params }),
  addOperationLog: (surveyId, data) => api.post(`/collaboration/${surveyId}/logs`, data),

  validateLogic: (surveyId) => api.get(`/logic/${surveyId}/validate`),
  simulatePath: (surveyId, answers) => api.post(`/logic/${surveyId}/simulate`, { answers }),

  getQuotas: (surveyId) => api.get(`/quotas/${surveyId}`),
  addQuota: (surveyId, data) => api.post(`/quotas/${surveyId}`, data),
  updateQuota: (surveyId, ruleId, data) => api.put(`/quotas/${surveyId}/${ruleId}`, data),
  deleteQuota: (surveyId, ruleId) => api.delete(`/quotas/${surveyId}/${ruleId}`),

  analyzeQuality: (surveyId) => api.post(`/quality/survey/${surveyId}/analyze`),
  getQualityStats: (surveyId) => api.get(`/quality/survey/${surveyId}/stats`),
  deleteLowQuality: (surveyId, data) => api.post(`/quality/survey/${surveyId}/delete-low-quality`, data),

  getNotifications: (params) => api.get('/notifications', { params }),
  markNotificationRead: (id) => api.post(`/notifications/${id}/read`),
  markAllNotificationsRead: () => api.post('/notifications/read-all'),
  deleteNotification: (id) => api.delete(`/notifications/${id}`),
  clearNotifications: (data) => api.delete('/notifications', { data })
};
