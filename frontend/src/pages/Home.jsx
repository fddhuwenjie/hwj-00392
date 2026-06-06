import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Row, Col, Statistic, Typography, Space } from 'antd';
import { PlusOutlined, FormOutlined, BarChartOutlined, FileExcelOutlined, ThunderboltOutlined } from '@ant-design/icons';
import api from '../api';

const { Title, Paragraph } = Typography;

export default function Home() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ total: 0, published: 0, responses: 0 });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const res = await api.getSurveys();
      const total = res.data.length;
      const published = res.data.filter(s => s.status === 'published').length;
      const responses = res.data.reduce((sum, s) => sum + (s.response_count || 0), 0);
      setStats({ total, published, responses });
    } catch (e) { }
  };

  const features = [
    { icon: <FormOutlined style={{ fontSize: 40, color: '#1890ff' }} />, title: '可视化拖拽编辑', desc: '拖拽式问卷设计，7种题型，分支逻辑' },
    { icon: <BarChartOutlined style={{ fontSize: 40, color: '#52c41a' }} />, title: '实时数据分析', desc: '饼图、柱状图、词云、交叉分析' },
    { icon: <FileExcelOutlined style={{ fontSize: 40, color: '#faad14' }} />, title: '多格式导出', desc: 'CSV、Excel、HTML报告、PDF详情' },
    { icon: <ThunderboltOutlined style={{ fontSize: 40, color: '#722ed1' }} />, title: '多种填写模式', desc: '单页/多页模式、移动端自适应' }
  ];

  return (
    <div>
      <Card style={{ marginBottom: 24, borderRadius: 12, background: 'linear-gradient(135deg, #1890ff, #722ed1)', color: '#fff' }}>
        <Row align="middle" gutter={32}>
          <Col flex="1">
            <Title level={2} style={{ color: '#fff', marginBottom: 8 }}>在线问卷调查系统</Title>
            <Paragraph style={{ color: 'rgba(255,255,255,0.9)', fontSize: 16, marginBottom: 16 }}>
              轻松创建、发布和分析问卷，让数据收集变得简单高效
            </Paragraph>
            <Space size="middle">
              <Button type="primary" size="large" icon={<PlusOutlined />} onClick={() => navigate('/editor')}>
                创建问卷
              </Button>
              <Button size="large" onClick={() => navigate('/templates')} style={{ background: 'rgba(255,255,255,0.2)', color: '#fff', border: 'none' }}>
                使用模板
              </Button>
            </Space>
          </Col>
          <Col>
            <Row gutter={32}>
              <Col><Statistic title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>问卷总数</span>} value={stats.total} valueStyle={{ color: '#fff' }} /></Col>
              <Col><Statistic title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>已发布</span>} value={stats.published} valueStyle={{ color: '#fff' }} /></Col>
              <Col><Statistic title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>累计回收</span>} value={stats.responses} valueStyle={{ color: '#fff' }} /></Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Row gutter={[16, 16]}>
        {features.map((f, i) => (
          <Col xs={24} sm={12} lg={6} key={i}>
            <Card className="survey-card">
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                {f.icon}
                <Title level={4} style={{ marginTop: 16 }}>{f.title}</Title>
                <Paragraph type="secondary" style={{ marginBottom: 0 }}>{f.desc}</Paragraph>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
