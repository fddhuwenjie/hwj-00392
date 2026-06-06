import React, { useState, useEffect } from 'react';
import {
  Card, Row, Col, Statistic, Progress, Table, Tag, Space, Button,
  Modal, message, Popconfirm, Slider, Tooltip, Alert, Checkbox,
  Empty, List
} from 'antd';
import {
  SafetyOutlined, DeleteOutlined, ThunderboltOutlined,
  WarningOutlined, CheckCircleOutlined,
  FilterOutlined, DashboardOutlined
} from '@ant-design/icons';
import api from '../api';

const FLAG_LABELS = {
  too_fast: { label: '作答过快', color: 'red', icon: <ThunderboltOutlined /> },
  fast: { label: '作答偏快', color: 'orange', icon: <ThunderboltOutlined /> },
  straight_line: { label: '直线答题(全相同)', color: 'red', icon: <WarningOutlined /> },
  mostly_same_answer: { label: '大部分答案相同', color: 'orange', icon: <WarningOutlined /> },
  all_nonsense_text: { label: '文本无意义', color: 'red', icon: <SafetyOutlined /> },
  some_nonsense_text: { label: '部分文本无意义', color: 'orange', icon: <SafetyOutlined /> },
  missing_required: { label: '缺必填项', color: 'orange', icon: <WarningOutlined /> }
};

function scoreColor(score) {
  if (score >= 90) return '#52c41a';
  if (score >= 75) return '#1890ff';
  if (score >= 60) return '#faad14';
  if (score >= 40) return '#fa8c16';
  return '#f5222d';
}

function scoreLabel(score) {
  if (score >= 90) return '优秀';
  if (score >= 75) return '良好';
  if (score >= 60) return '中等';
  if (score >= 40) return '较差';
  return '很差';
}

export default function QualityPanel({ surveyId, data, onDataChange }) {
  const [stats, setStats] = useState(null);
  const [threshold, setThreshold] = useState(60);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (surveyId) loadStats();
  }, [surveyId]);

  const loadStats = async () => {
    try {
      const res = await api.getQualityStats(surveyId);
      setStats(res.data);
    } catch (e) {}
  };

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const res = await api.analyzeQuality(surveyId);
      message.success(`已分析 ${res.data.total} 份答卷`);
      loadStats();
      if (onDataChange) onDataChange();
    } catch (e) {
      message.error('分析失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteLowQuality = async () => {
    try {
      const res = await api.deleteLowQuality(surveyId, { min_score: threshold });
      message.success(`已删除 ${res.data.deleted} 份低质量答卷`);
      setDeleteConfirm(false);
      loadStats();
      if (onDataChange) onDataChange();
    } catch (e) {
      message.error('删除失败');
    }
  };

  if (!stats) return null;

  const distribution = stats.distribution || {};

  return (
    <Card size="small" title={<span><SafetyOutlined /> 答卷质量检测</span>} style={{ marginBottom: 16 }}>
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={8}>
          <Card size="small" style={{ textAlign: 'center' }}>
            <Statistic
              title="平均质量分"
              value={stats.avg_score}
              suffix="/ 100"
              precision={1}
              valueStyle={{ color: scoreColor(stats.avg_score), fontSize: 36 }}
            />
            <Tag color={scoreColor(stats.avg_score)}>{scoreLabel(stats.avg_score)}</Tag>
          </Card>
        </Col>
        <Col xs={24} sm={16}>
          <Card size="small">
            <Row gutter={8}>
              {[
                { key: 'excellent', label: '优秀(90+)', count: distribution.excellent, color: '#52c41a' },
                { key: 'good', label: '良好(75+)', count: distribution.good, color: '#1890ff' },
                { key: 'medium', label: '中等(60+)', count: distribution.medium, color: '#faad14' },
                { key: 'poor', label: '较差(40+)', count: distribution.poor, color: '#fa8c16' },
                { key: 'bad', label: '很差(<40)', count: distribution.bad, color: '#f5222d' }
              ].map(item => (
                <Col key={item.key} span={Math.floor(24 / 5)} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 20, fontWeight: 'bold', color: item.color }}>{item.count || 0}</div>
                  <div style={{ fontSize: 11, color: '#999' }}>{item.label}</div>
                </Col>
              ))}
            </Row>
          </Card>
        </Col>
      </Row>

      <Alert
        type="info"
        showIcon
        message="检测规则说明"
        description={
          <div style={{ fontSize: 12 }}>
            <List size="small" dataSource={Object.entries(FLAG_LABELS)} renderItem={([k, v]) => (
              <List.Item>
                <Tag color={v.color} icon={v.icon}>{v.label}</Tag>
                <span style={{ color: '#999' }}>
                  {k === 'too_fast' && '作答时间低于预估时长30%'}
                  {k === 'fast' && '作答时间低于预估时长50%'}
                  {k === 'straight_line' && '所有选择题答案完全相同'}
                  {k === 'mostly_same_answer' && '70%以上选择题答案相同'}
                  {k === 'all_nonsense_text' && '所有文本题均为无意义字符(如asdf/123)'}
                  {k === 'some_nonsense_text' && '50%以上文本题为无意义字符'}
                  {k === 'missing_required' && '存在未填写的必填项'}
                </span>
              </List.Item>
            )} />
          </div>
        }
        style={{ marginBottom: 16 }}
      />

      <Row gutter={16} align="middle">
        <Col flex="1">
          <Space>
            <Button icon={<DashboardOutlined />} onClick={handleAnalyze} loading={loading}>
              重新分析质量
            </Button>
            <Popconfirm
              title={
                <div>
                  <div style={{ marginBottom: 8 }}>将删除质量分低于 <b>{threshold}</b> 分的答卷</div>
                  <Slider min={0} max={100} value={threshold} onChange={setThreshold} marks={{ 0: '0', 40: '40', 60: '60', 80: '80', 100: '100' }} />
                </div>
              }
              description="删除后不可恢复，确认继续吗？"
              onConfirm={handleDeleteLowQuality}
              okText="确认删除"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />}>
                批量删除低质量答卷
              </Button>
            </Popconfirm>
          </Space>
        </Col>
      </Row>
    </Card>
  );
}

export { FLAG_LABELS, scoreColor, scoreLabel };
