import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Table, Space, Tag, Popconfirm, Modal, message, Card, Row, Col, Input, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, CopyOutlined, SendOutlined, PauseCircleOutlined, PlayCircleOutlined, StopOutlined, BarChartOutlined, LinkOutlined, EyeOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

const { Search } = Input;
const { Option } = Select;

export default function SurveyList() {
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState([]);
  const [filtered, setFiltered] = useState([]);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [qrModal, setQrModal] = useState({ visible: false, survey: null });

  useEffect(() => {
    loadSurveys();
  }, []);

  useEffect(() => {
    let result = [...surveys];
    if (keyword) {
      result = result.filter(s => s.title.includes(keyword));
    }
    if (statusFilter) {
      result = result.filter(s => s.status === statusFilter);
    }
    setFiltered(result);
  }, [surveys, keyword, statusFilter]);

  const loadSurveys = async () => {
    try {
      const res = await api.getSurveys();
      setSurveys(res.data);
    } catch (e) {
      message.error('加载失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteSurvey(id);
      message.success('删除成功');
      loadSurveys();
    } catch (e) {
      message.error('删除失败');
    }
  };

  const handleCopy = async (id) => {
    try {
      const res = await api.copySurvey(id);
      message.success('复制成功');
      loadSurveys();
      navigate(`/editor/${res.data.id}`);
    } catch (e) {
      message.error(e.response?.data?.error || '复制失败');
    }
  };

  const handlePublish = (id) => {
    Modal.confirm({
      title: '发布问卷',
      content: '发布后题目不可修改，确定发布吗？',
      onOk: async () => {
        try {
          await api.publishSurvey(id, {});
          message.success('发布成功');
          loadSurveys();
        } catch (e) {
          message.error('发布失败');
        }
      }
    });
  };

  const handleUnpublish = (id) => {
    Modal.confirm({
      title: '取消发布',
      content: '取消发布后用户将无法填写，确定吗？',
      onOk: async () => {
        try {
          await api.unpublishSurvey(id);
          message.success('已取消发布');
          loadSurveys();
        } catch (e) {
          message.error('操作失败');
        }
      }
    });
  };

  const handlePause = async (id) => {
    try {
      await api.pauseSurvey(id);
      message.success('已暂停收集');
      loadSurveys();
    } catch (e) { message.error('操作失败'); }
  };

  const handleResume = async (id) => {
    try {
      await api.resumeSurvey(id);
      message.success('已恢复收集');
      loadSurveys();
    } catch (e) { message.error('操作失败'); }
  };

  const showQrModal = (survey) => {
    setQrModal({ visible: true, survey });
  };

  const columns = [
    {
      title: '问卷标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (t, r) => <a onClick={() => navigate(`/editor/${r.id}`)}>{t}</a>
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (s, r) => {
        if (r.is_paused) return <Tag color="orange">已暂停</Tag>;
        if (s === 'published') return <Tag color="green">已发布</Tag>;
        return <Tag color="default">草稿</Tag>;
      }
    },
    {
      title: '回收数',
      dataIndex: 'response_count',
      key: 'response_count',
      width: 80,
      render: (c) => <b>{c || 0}</b>
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 160,
      render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 320,
      render: (_, r) => (
        <Space size="small" wrap>
          {r.status === 'draft' ? (
            <Button type="link" size="small" icon={<SendOutlined />} onClick={() => handlePublish(r.id)}>发布</Button>
          ) : (
            <Button type="link" size="small" icon={<StopOutlined />} onClick={() => handleUnpublish(r.id)}>取消发布</Button>
          )}
          {r.status === 'published' && (
            r.is_paused
              ? <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => handleResume(r.id)}>恢复</Button>
              : <Button type="link" size="small" icon={<PauseCircleOutlined />} onClick={() => handlePause(r.id)}>暂停</Button>
          )}
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => navigate(`/editor/${r.id}`)}>编辑</Button>
          <Button type="link" size="small" icon={<BarChartOutlined />} onClick={() => navigate(`/analysis/${r.id}`)} disabled={!r.response_count}>分析</Button>
          {r.status === 'published' && (
            <Button type="link" size="small" icon={<LinkOutlined />} onClick={() => showQrModal(r)}>链接</Button>
          )}
          <Button type="link" size="small" icon={<CopyOutlined />} onClick={() => handleCopy(r.id)}>复制</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={16}>
          <Col xs={24} sm={12} md={8}>
            <Search placeholder="搜索问卷标题" allowClear value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Select placeholder="状态筛选" allowClear style={{ width: '100%' }} value={statusFilter} onChange={setStatusFilter}>
              <Option value="draft">草稿</Option>
              <Option value="published">已发布</Option>
            </Select>
          </Col>
          <Col xs={24} sm={24} md={10} style={{ textAlign: 'right' }}>
            <Space>
              <Button onClick={() => navigate('/templates')}>从模板创建</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/editor')}>创建问卷</Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={filtered}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 800 }}
          locale={{ emptyText: '暂无问卷，点击右上角创建' }}
        />
      </Card>

      <Modal title="问卷链接与二维码" open={qrModal.visible} onCancel={() => setQrModal({ visible: false, survey: null })} footer={null}>
        {qrModal.survey && (
          <div style={{ textAlign: 'center', padding: 16 }}>
            <Input
              value={`${window.location.origin}/fill/${qrModal.survey.short_code}`}
              readOnly
              addonAfter={<Button type="primary" onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/fill/${qrModal.survey.short_code}`); message.success('已复制'); }}>复制</Button>}
              style={{ marginBottom: 24 }}
            />
            <div className="qr-code-box">
              <div className="qr-code-text">
                [二维码模拟]<br />
                短链: {qrModal.survey.short_code}<br />
                {window.location.origin}/fill/{qrModal.survey.short_code}
              </div>
              <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                扫描二维码或点击链接填写问卷
              </div>
              <Button type="primary" icon={<EyeOutlined />} onClick={() => window.open(`/fill/${qrModal.survey.short_code}`, '_blank')} style={{ marginTop: 8 }}>
                预览填写页
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
