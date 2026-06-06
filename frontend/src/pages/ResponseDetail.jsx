import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button, Card, Empty, Space } from 'antd';
import { ArrowLeftOutlined, DownloadOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

export default function ResponseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState(null);
  const [response, setResponse] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const resp = await api.getResponse(id);
      setResponse(resp.data);
      const sResp = await api.getSurvey(resp.data.survey_id);
      setSurvey(sResp.data);
    } catch (e) { } finally {
      setLoading(false);
    }
  };

  const handleExport = () => {
    window.open(api.exportResponsePdf(id), '_blank');
  };

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}>加载中...</div>;
  if (!response || !survey) return <Empty description="答卷不存在" />;

  const formatAnswer = (q, value) => {
    if (value === undefined || value === null || value === '') return <span style={{ color: '#999' }}>未填写</span>;
    if (Array.isArray(value)) return value.join('、');
    if (typeof value === 'object') {
      return Object.entries(value).map(([k, v]) => <div key={k} style={{ paddingLeft: 16 }}>• {k}: <b>{v}</b></div>);
    }
    if (q.type === 'rating') {
      return <span style={{ color: '#faad14' }}>{'★'.repeat(parseInt(value))}<span style={{ color: '#e0e0e0' }}>{'★'.repeat((q.maxStars || 5) - parseInt(value))}</span></span>;
    }
    if (q.type === 'nps') return `${value} 分`;
    return String(value);
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate(-1)}>返回</Button>
          <span style={{ fontSize: 18, fontWeight: 'bold' }}>{survey.title} - 答卷详情</span>
          <Button type="primary" icon={<DownloadOutlined />} onClick={handleExport}>导出(PDF)</Button>
        </Space>
      </Card>
      <Card>
        <div style={{ color: '#999', marginBottom: 24 }}>
          提交时间: {dayjs(response.submit_time).format('YYYY-MM-DD HH:mm:ss')}
          <span style={{ marginLeft: 16 }}>答卷ID: {response.id.substring(0, 12)}...</span>
        </div>
        {survey.questions.map((q, idx) => (
          <div key={q.id} style={{ padding: '16px 0', borderBottom: idx < survey.questions.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
            <div style={{ fontWeight: 500, marginBottom: 8, color: '#333' }}>
              <span style={{ color: '#1890ff' }}>Q{idx + 1}.</span> {q.title}
              {q.required && <span style={{ color: '#f5222d', marginLeft: 4 }}>*</span>}
            </div>
            <div style={{ paddingLeft: 24, color: '#555', lineHeight: 1.8 }}>
              {formatAnswer(q, response.answers[q.id])}
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}
