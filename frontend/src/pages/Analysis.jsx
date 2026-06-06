import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Button, Card, Row, Col, Tabs, Select, Form, Table, Tag, Modal,
  Statistic, DatePicker, Input, Space, Empty, App
} from 'antd';
import {
  ArrowLeftOutlined, DownloadOutlined, PieChartOutlined,
  BarChartOutlined, FileExcelOutlined, FileTextOutlined, EyeOutlined
} from '@ant-design/icons';
import {
  Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale,
  LinearScale, BarElement, Title
} from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';
import api from '../api';
import dayjs from 'dayjs';

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title);

const { Option } = Select;
const { RangePicker } = DatePicker;

const COLORS = [
  '#1890ff', '#52c41a', '#faad14', '#f5222d', '#722ed1',
  '#13c2c2', '#eb2f96', '#fa8c16', '#a0d911', '#2f54eb'
];

function QuestionAnalysis({ question, stat }) {
  if (!stat) return <Empty />;

  if (stat.type === 'single') {
    const labels = stat.options || [];
    const data = labels.map(l => stat.counts[l] || 0);
    const chartData = {
      labels,
      datasets: [{
        data,
        backgroundColor: labels.map((_, i) => COLORS[i % COLORS.length])
      }]
    };
    return (
      <Row gutter={24}>
        <Col xs={24} md={12}>
          <div className="chart-container" style={{ height: 280 }}>
            <Pie data={chartData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
          </div>
        </Col>
        <Col xs={24} md={12}>
          <div className="chart-container" style={{ height: 280 }}>
            <Bar
              data={{ labels, datasets: [{ label: '数量', data, backgroundColor: '#1890ff' }] }}
              options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }}
            />
          </div>
        </Col>
        <Col span={24}>
          <Table
            size="small"
            dataSource={labels.map((l, i) => ({ label: l, count: data[i], pct: stat.percentages[l] || 0 }))}
            pagination={false}
            rowKey="label"
            columns={[
              { title: '选项', dataIndex: 'label', key: 'label' },
              { title: '数量', dataIndex: 'count', key: 'count', width: 100, render: v => <b>{v}</b> },
              { title: '占比', dataIndex: 'pct', key: 'pct', width: 120, render: v => <Tag color="blue">{v}%</Tag> }
            ]}
          />
        </Col>
      </Row>
    );
  }

  if (stat.type === 'multi') {
    const labels = stat.options || [];
    const data = labels.map(l => stat.counts[l] || 0);
    return (
      <Row gutter={24}>
        <Col xs={24} md={12}>
          <div className="chart-container" style={{ height: 280 }}>
            <Pie
              data={{ labels, datasets: [{ data, backgroundColor: labels.map((_, i) => COLORS[i % COLORS.length]) }] }}
              options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }}
            />
          </div>
        </Col>
        <Col xs={24} md={12}>
          <div className="chart-container" style={{ height: 280 }}>
            <Bar
              data={{ labels, datasets: [{ label: '选择数', data, backgroundColor: '#52c41a' }] }}
              options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }}
            />
          </div>
        </Col>
        <Col span={24}>
          <Table
            size="small"
            dataSource={labels.map((l, i) => ({ label: l, count: data[i], pct: stat.percentages[l] || 0 }))}
            pagination={false}
            rowKey="label"
            columns={[
              { title: '选项', dataIndex: 'label', key: 'label' },
              { title: '选择数', dataIndex: 'count', key: 'count', width: 100, render: v => <b>{v}</b> },
              { title: '占比', dataIndex: 'pct', key: 'pct', width: 120, render: v => <Tag color="green">{v}%</Tag> }
            ]}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            共 {stat.total_responses} 份有效回答，{stat.total_selections} 次选择
          </div>
        </Col>
      </Row>
    );
  }

  if (stat.type === 'rating') {
    const labels = Array.from({ length: stat.max_stars }, (_, i) => `${i + 1}星`);
    const data = labels.map((_, i) => stat.counts[i + 1] || 0);
    return (
      <Row gutter={24} align="middle">
        <Col xs={24} md={8}>
          <Card style={{ textAlign: 'center' }}>
            <Statistic title="平均评分" value={stat.average} precision={2} suffix={`/ ${stat.max_stars}`} valueStyle={{ color: '#faad14', fontSize: 48 }} />
            <div style={{ fontSize: 28, color: '#fadb14', marginTop: 8 }}>
              {'★'.repeat(Math.round(stat.average))}<span style={{ color: '#e0e0e0' }}>{'★'.repeat(stat.max_stars - Math.round(stat.average))}</span>
            </div>
            <div style={{ color: '#999', marginTop: 8 }}>共 {stat.total} 人评分</div>
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <div className="chart-container" style={{ height: 240 }}>
            <Bar
              data={{ labels, datasets: [{ label: '人数', data, backgroundColor: '#faad14' }] }}
              options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }}
            />
          </div>
        </Col>
      </Row>
    );
  }

  if (stat.type === 'nps') {
    const labels = Array.from({ length: 11 }, (_, i) => String(i));
    const data = labels.map((_, i) => stat.counts[i] || 0);
    const npsColor = stat.nps_score >= 50 ? '#52c41a' : stat.nps_score >= 0 ? '#faad14' : '#f5222d';
    return (
      <Row gutter={24} align="middle">
        <Col xs={24} md={8}>
          <Card style={{ textAlign: 'center' }}>
            <Statistic
              title="NPS 评分"
              value={stat.nps_score}
              precision={0}
              suffix="分"
              valueStyle={{ color: npsColor, fontSize: 48 }}
            />
            <Row gutter={8} style={{ marginTop: 16 }}>
              <Col span={8}>
                <Tag color="green" style={{ fontSize: 12 }}>推荐者 {stat.promoters}</Tag>
                <div style={{ fontSize: 12, color: '#999' }}>{stat.promoter_pct}%</div>
              </Col>
              <Col span={8}>
                <Tag color="orange" style={{ fontSize: 12 }}>中立者 {stat.passives}</Tag>
                <div style={{ fontSize: 12, color: '#999' }}>{stat.passive_pct}%</div>
              </Col>
              <Col span={8}>
                <Tag color="red" style={{ fontSize: 12 }}>贬损者 {stat.detractors}</Tag>
                <div style={{ fontSize: 12, color: '#999' }}>{stat.detractor_pct}%</div>
              </Col>
            </Row>
          </Card>
        </Col>
        <Col xs={24} md={16}>
          <div className="chart-container" style={{ height: 240 }}>
            <Bar
              data={{
                labels,
                datasets: [{
                  label: '人数',
                  data,
                  backgroundColor: labels.map((_, i) =>
                    i >= 9 ? '#52c41a' : i >= 7 ? '#faad14' : '#f5222d'
                  )
                }]
              }}
              options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }}
            />
          </div>
        </Col>
      </Row>
    );
  }

  if (stat.type === 'text') {
    return (
      <div>
        <div style={{ marginBottom: 16 }}>
          <Tag color="blue">共 {stat.total} 条回答</Tag>
        </div>
        {stat.word_cloud && stat.word_cloud.length > 0 && (
          <div className="word-cloud" style={{ marginBottom: 16 }}>
            {stat.word_cloud.map(w => (
              <span
                key={w.word}
                className="word-cloud-item"
                style={{
                  fontSize: `${12 + Math.min(w.count * 2, 20)}px`,
                  fontWeight: w.count >= 3 ? 'bold' : 'normal'
                }}
              >
                {w.word} ({w.count})
              </span>
            ))}
          </div>
        )}
        {stat.samples && stat.samples.length > 0 && (
          <Card size="small" title={`样例回答（${stat.samples.length}条）`}>
            {stat.samples.map((s, i) => (
              <div key={i} style={{ padding: '8px 0', borderBottom: i < stat.samples.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                <span style={{ color: '#999' }}>{i + 1}. </span>{s}
              </div>
            ))}
          </Card>
        )}
      </div>
    );
  }

  if (stat.type === 'matrix') {
    return (
      <Table
        size="small"
        dataSource={stat.rows.map(r => ({
          row: r,
          ...Object.fromEntries(stat.cols.map(c => [c, stat.counts[r]?.[c] || 0]))
        }))}
        pagination={false}
        rowKey="row"
        columns={[
          { title: '', dataIndex: 'row', key: 'row', width: 140, fixed: 'left' },
          ...stat.cols.map(c => ({ title: c, dataIndex: c, key: c, width: 90, align: 'center', render: v => v || '-' }))
        ]}
      />
    );
  }

  if (stat.type === 'sort') {
    return (
      <Row gutter={24}>
        <Col xs={24} md={12}>
          <Card size="small" title="平均排名（越靠前越重要）">
            {stat.sorted_options.map((s, i) => (
              <div key={s.option} style={{ padding: '8px 0', display: 'flex', justifyContent: 'space-between', borderBottom: i < stat.sorted_options.length - 1 ? '1px solid #f0f0f0' : 'none' }}>
                <span><Tag color="blue">{i + 1}</Tag> {s.option}</span>
                <span style={{ color: '#666' }}>平均: {s.avg_rank}</span>
              </div>
            ))}
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <div className="chart-container" style={{ height: 300 }}>
            <Bar
              data={{
                labels: stat.sorted_options.map(s => s.option),
                datasets: [{ label: '平均排名', data: stat.sorted_options.map(s => s.avg_rank), backgroundColor: '#722ed1' }]
              }}
              options={{ maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } } }}
            />
          </div>
        </Col>
      </Row>
    );
  }

  return <Empty description={`${stat.type} - 暂无数据`} />;
}

function CrossAnalysis({ questions }) {
  const [form] = Form.useForm();
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const { id } = useParams();

  const loadCross = async (q1, q2) => {
    if (!q1 || !q2 || q1 === q2) {
      message.warning('请选择两个不同的题目');
      return;
    }
    setLoading(true);
    try {
      const res = await api.getCrossAnalysis(id, q1, q2);
      setResult(res.data);
    } catch (e) {
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const selectableQuestions = questions.filter(q => ['single', 'multi'].includes(q.type));

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Form form={form} layout="inline" onFinish={(v) => loadCross(v.q1, v.q2)}>
          <Form.Item label="题目A" name="q1" rules={[{ required: true }]}>
            <Select style={{ width: 260 }} placeholder="请选择">
              {selectableQuestions.map(q => <Option key={q.id} value={q.id}>{q.title.substring(0, 30)}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="题目B" name="q2" rules={[{ required: true }]}>
            <Select style={{ width: 260 }} placeholder="请选择">
              {selectableQuestions.map(q => <Option key={q.id} value={q.id}>{q.title.substring(0, 30)}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading}>开始分析</Button>
          </Form.Item>
        </Form>
      </Card>
      {result && (
        <Card title={`交叉分析: ${result.question1.title} × ${result.question2.title}`}>
          <Table
            size="small"
            dataSource={result.question1.options.map(opt1 => ({
              opt1,
              ...Object.fromEntries(result.question2.options.map(opt2 => [opt2, result.matrix[opt1]?.[opt2] || 0])),
              total: result.matrix[opt1]?.__total || 0
            }))}
            pagination={false}
            rowKey="opt1"
            columns={[
              { title: result.question1.title.substring(0, 15) + ' \\\\ ' + result.question2.title.substring(0, 15), dataIndex: 'opt1', key: 'opt1', width: 180, fixed: 'left', render: v => <b>{v}</b> },
              ...result.question2.options.map(opt2 => ({
                title: opt2,
                dataIndex: opt2,
                key: opt2,
                width: 90,
                align: 'center',
                render: (v, r) => {
                  const total = r.total;
                  const pct = total > 0 ? ((v / total) * 100).toFixed(1) : 0;
                  return <div>{v}<div style={{ fontSize: 11, color: '#999' }}>{pct}%</div></div>;
                }
              })),
              { title: '合计', dataIndex: 'total', key: 'total', width: 90, align: 'center', render: v => <b>{v}</b> }
            ]}
            scroll={{ x: true }}
          />
          <div style={{ marginTop: 8, fontSize: 12, color: '#999' }}>
            行总计: {result.matrix.__total?.__total || 0} 条
          </div>
        </Card>
      )}
    </div>
  );
}

function DataList({ surveyId, questions }) {
  const [data, setData] = useState({ list: [], total: 0 });
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [detailModal, setDetailModal] = useState({ visible: false, response: null });

  useEffect(() => {
    loadData();
  }, [surveyId, page, pageSize, filters]);

  const loadData = async () => {
    setLoading(true);
    try {
      const filterStr = Object.keys(filters).length > 0 ? JSON.stringify(filters) : undefined;
      const res = await api.getResponses(surveyId, { page, pageSize, filters: filterStr });
      setData(res.data);
    } catch (e) { } finally { setLoading(false); }
  };

  const handleExportResponse = (respId) => {
    window.open(api.exportResponsePdf(respId), '_blank');
  };

  const columns = [
    { title: '序号', dataIndex: 'index', key: 'index', width: 60, render: (_, __, i) => (page - 1) * pageSize + i + 1 },
    { title: '提交时间', dataIndex: 'submit_time', key: 'submit_time', width: 170, render: t => dayjs(t).format('YYYY-MM-DD HH:mm:ss') },
    ...questions.slice(0, 4).map(q => ({
      title: q.title.substring(0, 12),
      dataIndex: ['answers', q.id],
      key: q.id,
      ellipsis: true,
      render: v => {
        if (v === undefined || v === null) return '-';
        if (Array.isArray(v)) return v.join(',');
        if (typeof v === 'object') return Object.values(v).join(',');
        return String(v);
      }
    })),
    {
      title: '操作', key: 'action', width: 140,
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" icon={<EyeOutlined />} onClick={() => setDetailModal({ visible: true, response: r })}>详情</Button>
          <Button type="link" size="small" icon={<DownloadOutlined />} onClick={() => handleExportResponse(r.id)}>导出</Button>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 'bold', marginBottom: 12 }}>筛选条件</div>
        <Row gutter={[16, 12]}>
          {questions.filter(q => ['single', 'multi'].includes(q.type)).slice(0, 4).map(q => (
            <Col xs={24} md={6} key={q.id}>
              <Select
                mode={q.type === 'multi' ? 'multiple' : undefined}
                style={{ width: '100%' }}
                placeholder={q.title.substring(0, 15)}
                allowClear
                value={filters[q.id]}
                onChange={(v) => {
                  const nf = { ...filters };
                  if (v && (Array.isArray(v) ? v.length : true)) nf[q.id] = v; else delete nf[q.id];
                  setFilters(nf);
                  setPage(1);
                }}
              >
                {q.options.map(o => <Option key={o} value={o}>{o}</Option>)}
              </Select>
            </Col>
          ))}
        </Row>
      </Card>
      <Card>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data.list}
          columns={columns}
          pagination={{
            current: page,
            pageSize,
            total: data.total,
            showSizeChanger: true,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); }
          }}
          scroll={{ x: true }}
        />
      </Card>

      <Modal
        title="答卷详情"
        open={detailModal.visible}
        onCancel={() => setDetailModal({ visible: false, response: null })}
        width={600}
        footer={[
          <Button key="close" onClick={() => setDetailModal({ visible: false, response: null })}>关闭</Button>,
          detailModal.response && (
            <Button key="export" type="primary" icon={<DownloadOutlined />} onClick={() => handleExportResponse(detailModal.response.id)}>
              导出PDF
            </Button>
          )
        ]}
      >
        {detailModal.response && (
          <div style={{ maxHeight: 400, overflowY: 'auto' }}>
            <div style={{ color: '#999', marginBottom: 16 }}>
              提交时间: {dayjs(detailModal.response.submit_time).format('YYYY-MM-DD HH:mm:ss')}
            </div>
            {questions.map(q => (
              <div key={q.id} className="confirm-item">
                <div className="confirm-label">{q.title}</div>
                <div className="confirm-value">
                  {detailModal.response.answers[q.id] === undefined || detailModal.response.answers[q.id] === null || detailModal.response.answers[q.id] === ''
                    ? <span style={{ color: '#999' }}>未填写</span>
                    : Array.isArray(detailModal.response.answers[q.id])
                      ? detailModal.response.answers[q.id].join('、')
                      : typeof detailModal.response.answers[q.id] === 'object'
                        ? Object.entries(detailModal.response.answers[q.id]).map(([k, v]) => `${k}: ${v}`).join('；')
                        : String(detailModal.response.answers[q.id])
                  }
                </div>
              </div>
            ))}
          </div>
        )}
      </Modal>
    </div>
  );
}

export default function Analysis() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const { message } = App.useApp();

  useEffect(() => { loadData(); }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [sRes, aRes] = await Promise.all([api.getSurvey(id), api.getAnalysis(id)]);
      setSurvey(sRes.data);
      setAnalysis(aRes.data);
    } catch (e) {
      message.error('加载失败');
    } finally { setLoading(false); }
  };

  if (loading) return <div style={{ padding: 80, textAlign: 'center' }}>加载中...</div>;
  if (!survey) return <Empty />;

  const questions = survey.questions || [];

  const tabItems = [
    {
      key: 'overview',
      label: <span><PieChartOutlined /> 总体分析</span>,
      children: questions.map((q, idx) => (
        <div key={q.id} className="analysis-chart">
          <div style={{ fontSize: 16, fontWeight: 'bold', marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>
            <Tag color="blue">Q{idx + 1}</Tag> {q.title}
            <Tag style={{ marginLeft: 8 }}>{['单选题', '多选题', '填空题', '评分题', 'NPS评分', '矩阵题', '排序题'][['single', 'multi', 'text', 'rating', 'nps', 'matrix', 'sort'].indexOf(q.type)] || q.type}</Tag>
            {q.required && <Tag color="red">必填</Tag>}
          </div>
          <QuestionAnalysis question={q} stat={analysis?.stats?.[q.id]} />
        </div>
      ))
    },
    {
      key: 'cross',
      label: <span><BarChartOutlined /> 交叉分析</span>,
      children: <CrossAnalysis questions={questions} />
    },
    {
      key: 'data',
      label: <span><FileTextOutlined /> 原始数据</span>,
      children: <DataList surveyId={id} questions={questions} />
    }
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={16}>
          <Col>
            <Space>
              <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/surveys')}>返回</Button>
              <span style={{ fontSize: 18, fontWeight: 'bold' }}>{survey.title}</span>
            </Space>
          </Col>
          <Col>
            <Space>
              <Statistic title="回收总数" value={analysis?.total_responses || 0} valueStyle={{ fontSize: 20 }} />
              <a href={api.exportCsv(id)}>
                <Button icon={<DownloadOutlined />}>CSV</Button>
              </a>
              <a href={api.exportExcel(id)}>
                <Button icon={<FileExcelOutlined />}>Excel</Button>
              </a>
              <a href={api.exportReport(id)}>
                <Button type="primary" icon={<DownloadOutlined />}>导出分析报告</Button>
              </a>
            </Space>
          </Col>
        </Row>
      </Card>
      <Tabs items={tabItems} defaultActiveKey="overview" />
    </div>
  );
}
