import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Card, Row, Col, Statistic, Tag, Space, Empty, App, Progress
} from 'antd';
import {
  ArrowLeftOutlined, HomeOutlined, ReloadOutlined, BarChartOutlined
} from '@ant-design/icons';
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title,
  Tooltip as ChartTooltip, Legend
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import api from '../api';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, ChartTooltip, Legend);

const COLORS = [
  '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
  '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#2f54eb'
];

function StatCard({ question, stat }) {
  if (!stat) return null;

  if (stat.type === 'single') {
    const labels = stat.options || [];
    const percentages = labels.map(l => stat.percentages[l] || 0);
    const maxPct = Math.max(...percentages, 1);

    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag color="blue">单选题</Tag>
          {question.title}
        </div>
        <div style={{ maxWidth: 500 }}>
          {labels.map((label, i) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>{label}</span>
                <span style={{ color: '#666' }}>
                  {stat.counts[label] || 0} 票 ({stat.percentages[label] || 0}%)
                </span>
              </div>
              <Progress
                percent={stat.percentages[label] || 0}
                showInfo={false}
                strokeColor={COLORS[i % COLORS.length]}
                size="small"
              />
            </div>
          ))}
          <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
            共 {stat.total} 人回答
          </div>
        </div>
      </Card>
    );
  }

  if (stat.type === 'rating') {
    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag color="orange">评分题</Tag>
          {question.title}
        </div>
        <Row align="middle" gutter={16}>
          <Col>
            <Statistic
              title="平均得分"
              value={stat.average}
              precision={2}
              suffix={`/ ${stat.max_stars}`}
              valueStyle={{ color: '#faad14', fontSize: 32 }}
            />
          </Col>
          <Col>
            <div style={{ fontSize: 24, color: '#fadb14' }}>
              {'★'.repeat(Math.round(stat.average))}
              <span style={{ color: '#e0e0e0' }}>
                {'★'.repeat(stat.max_stars - Math.round(stat.average))}
              </span>
            </div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
              共 {stat.total} 人评分
            </div>
          </Col>
        </Row>
      </Card>
    );
  }

  if (stat.type === 'nps') {
    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag color="purple">NPS 评分</Tag>
          {question.title}
        </div>
        <Row align="middle" gutter={16}>
          <Col>
            <Statistic
              title="推荐者占比"
              value={stat.promoter_pct}
              precision={1}
              suffix="%"
              valueStyle={{ color: '#52c41a', fontSize: 32 }}
            />
          </Col>
          <Col>
            <div style={{ display: 'flex', gap: 16 }}>
              <div>
                <Tag color="green">推荐者</Tag>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: '#52c41a' }}>
                  {stat.promoters} 人
                </div>
                <div style={{ fontSize: 12, color: '#999' }}>{stat.promoter_pct}%</div>
              </div>
              <div>
                <Tag color="orange">中立者</Tag>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: '#faad14' }}>
                  {stat.passives} 人
                </div>
                <div style={{ fontSize: 12, color: '#999' }}>{stat.passive_pct}%</div>
              </div>
              <div>
                <Tag color="red">贬损者</Tag>
                <div style={{ fontSize: 20, fontWeight: 'bold', color: '#f5222d' }}>
                  {stat.detractors} 人
                </div>
                <div style={{ fontSize: 12, color: '#999' }}>{stat.detractor_pct}%</div>
              </div>
            </div>
            <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
              共 {stat.total} 人评分，NPS 得分: {stat.nps_score}
            </div>
          </Col>
        </Row>
      </Card>
    );
  }

  if (stat.type === 'multi') {
    const labels = stat.options || [];
    return (
      <Card size="small" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Tag color="green">多选题</Tag>
          {question.title}
        </div>
        <div style={{ maxWidth: 500 }}>
          {labels.map((label, i) => (
            <div key={label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                <span>{label}</span>
                <span style={{ color: '#666' }}>
                  {stat.counts[label] || 0} 次 ({stat.percentages[label] || 0}%)
                </span>
              </div>
              <Progress
                percent={stat.percentages[label] || 0}
                showInfo={false}
                strokeColor={COLORS[i % COLORS.length]}
                size="small"
              />
            </div>
          ))}
          <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
            共 {stat.total_responses} 人回答，{stat.total_selections} 次选择
          </div>
        </div>
      </Card>
    );
  }

  return null;
}

export default function Result() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const { message } = App.useApp();

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [sRes, aRes] = await Promise.all([
        api.getSurvey(id),
        api.getAnalysis(id)
      ]);
      setSurvey(sRes.data);
      setAnalysis(aRes.data);
    } catch (e) {
      message.error('加载结果失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}>加载中...</div>;
  if (!survey || !analysis) return <Empty description="数据加载失败" />;

  const questions = (survey.questions || []).filter(q =>
    ['single', 'rating', 'nps', 'multi'].includes(q.type)
  );

  return (
    <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 0' }}>
      <Card style={{ marginBottom: 16, textAlign: 'center', background: 'linear-gradient(135deg, #f6ffed, #e6f7ff)' }}>
        <div style={{ fontSize: 28, fontWeight: 'bold', color: '#52c41a', marginBottom: 8 }}>
          ✅ 提交成功！
        </div>
        <div style={{ color: '#666', marginBottom: 16 }}>
          感谢您的参与，以下是问卷当前的实时统计结果
        </div>
        <Row justify="center" gutter={32}>
          <Col>
            <Statistic title="回收总数" value={analysis.total_responses} valueStyle={{ fontSize: 24 }} />
          </Col>
          <Col>
            <Statistic title="问卷题目" value={questions.length} valueStyle={{ fontSize: 24 }} />
          </Col>
        </Row>
      </Card>

      {questions.length === 0 ? (
        <Card>
          <Empty description="暂无可统计的题目（仅支持单选、多选、评分、NPS题型）" />
        </Card>
      ) : (
        questions.map((q, idx) => (
          <StatCard
            key={q.id}
            question={q}
            stat={analysis.stats?.[q.id]}
          />
        ))
      )}

      <Card>
        <div style={{ textAlign: 'center' }}>
          <Space wrap>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => {
                if (survey.short_code) {
                  navigate(`/fill/${survey.short_code}`);
                }
              }}
            >
              再填一份
            </Button>
            <Button
              icon={<BarChartOutlined />}
              onClick={() => navigate(`/analysis/${id}`)}
            >
              查看完整分析
            </Button>
            <Button
              type="primary"
              icon={<HomeOutlined />}
              onClick={() => navigate('/')}
            >
              返回首页
            </Button>
          </Space>
        </div>
      </Card>
    </div>
  );
}
