import React, { useState, useEffect } from 'react';
import {
  Modal, Form, Select, InputNumber, Button, Table, Progress, Tag,
  Space, message, Empty, Popconfirm, Card, Row, Col, Tooltip, Divider
} from 'antd';
import {
  SettingOutlined, PlusOutlined, DeleteOutlined, EditOutlined,
  DashboardOutlined, AlertOutlined
} from '@ant-design/icons';
import api from '../api';

const { Option } = Select;

export function QuotaPanel({ surveyId, questions, visible, onClose }) {
  const [quotas, setQuotas] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);

  const selectableQuestions = questions.filter(q => ['single', 'multi'].includes(q.type));

  useEffect(() => {
    if (visible && surveyId) loadQuotas();
  }, [visible, surveyId]);

  const loadQuotas = async () => {
    try {
      const res = await api.getQuotas(surveyId);
      setQuotas(res.data);
    } catch (e) {}
  };

  const handleAdd = () => {
    setEditing(null);
    form.resetFields();
    setModalVisible(true);
  };

  const handleEdit = (rule) => {
    setEditing(rule);
    form.setFieldsValue({
      question_id: rule.question_id,
      answer_value: rule.answer_value,
      max_count: rule.max_count
    });
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      const values = await form.validateFields();
      const q = questions.find(x => x.id === values.question_id);
      const data = {
        ...values,
        question_title: q?.title || ''
      };
      if (editing) {
        await api.updateQuota(surveyId, editing.id, data);
        message.success('更新成功');
      } else {
        await api.addQuota(surveyId, data);
        message.success('添加成功');
      }
      setModalVisible(false);
      loadQuotas();
    } catch (e) {
      message.error(e.response?.data?.error || '保存失败');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteQuota(surveyId, id);
      message.success('删除成功');
      loadQuotas();
    } catch (e) { message.error('删除失败'); }
  };

  const columns = [
    {
      title: '题目',
      dataIndex: 'question_title',
      key: 'question_title',
      ellipsis: true,
      render: (t, r) => {
        const q = questions.find(x => x.id === r.question_id);
        return (
          <Tooltip title={q?.title || t}>
            <Tag color="blue">{q?.title?.substring(0, 15) || t || r.question_id}</Tag>
          </Tooltip>
        );
      }
    },
    {
      title: '答案值',
      dataIndex: 'answer_value',
      key: 'answer_value',
      render: (v) => <Tag color="cyan">{v}</Tag>
    },
    {
      title: '进度',
      key: 'progress',
      render: (_, r) => {
        const pct = r.max_count > 0 ? Math.min(100, (r.current_count / r.max_count) * 100) : 0;
        const isFull = r.current_count >= r.max_count;
        return (
          <Space style={{ width: '100%' }}>
            <Progress
              percent={pct}
              size="small"
              status={isFull ? 'exception' : 'active'}
              style={{ minWidth: 120, flex: 1 }}
            />
            <Space>
              <b style={{ color: isFull ? '#f5222d' : '#1890ff' }}>
                {r.current_count}
              </b>
              <span style={{ color: '#999' }}>/</span>
              <span>{r.max_count}</span>
              {isFull && <Tag color="red" icon={<AlertOutlined />}>已满</Tag>}
            </Space>
          </Space>
        );
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 140,
      render: (_, r) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(r)}>编辑</Button>
          <Popconfirm title="确定删除该配额规则？" onConfirm={() => handleDelete(r.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const [selectedQuestion, setSelectedQuestion] = useState(null);
  const selectedQ = questions.find(q => q.id === selectedQuestion);

  return (
    <>
      <Modal
        title={<span><SettingOutlined /> 问卷配额控制</span>}
        open={visible}
        onCancel={onClose}
        width={800}
        footer={[
          <Button key="close" onClick={onClose}>关闭</Button>,
          <Button key="add" type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加配额规则
          </Button>
        ]}
      >
        <Card size="small" style={{ marginBottom: 16 }}>
          <Row gutter={16} align="middle">
            <Col flex="1">
              <div style={{ fontSize: 12, color: '#999' }}>
                <DashboardOutlined /> 按条件设置回收配额，如"男性最多100份，女性最多100份"。
                配额满后该条件的新提交将被自动拒绝。
              </div>
            </Col>
          </Row>
        </Card>

        {quotas.length === 0 ? (
          <Empty
            description="暂无配额规则，点击右上角添加"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        ) : (
          <Table
            size="small"
            rowKey="id"
            dataSource={quotas}
            columns={columns}
            pagination={false}
          />
        )}
      </Modal>

      <Modal
        title={editing ? '编辑配额规则' : '添加配额规则'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        confirmLoading={loading}
        width={500}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="选择题目（单选/多选题）"
            name="question_id"
            rules={[{ required: true, message: '请选择题目' }]}
          >
            <Select
              placeholder="请选择用于分组的题目"
              onChange={(v) => setSelectedQuestion(v)}
            >
              {selectableQuestions.map(q => (
                <Option key={q.id} value={q.id}>
                  {q.title.substring(0, 30)}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="答案值"
            name="answer_value"
            rules={[{ required: true, message: '请选择答案' }]}
          >
            <Select placeholder="选择该题的某个选项作为分组条件" disabled={!selectedQ}>
              {selectedQ?.options?.map(o => (
                <Option key={o} value={o}>{o}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            label="最大回收量"
            name="max_count"
            rules={[{ required: true, message: '请输入最大数量' }]}
          >
            <InputNumber min={1} style={{ width: '100%' }} placeholder="该条件下最多收集的份数" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export function QuotaProgressDisplay({ quotas }) {
  if (!quotas || quotas.length === 0) return null;
  return (
    <Card size="small" title={<span><DashboardOutlined /> 配额进度</span>} style={{ marginTop: 16 }}>
      <Space direction="vertical" style={{ width: '100%' }}>
        {quotas.map(q => {
          const pct = q.max_count > 0 ? Math.min(100, (q.current_count / q.max_count) * 100) : 0;
          const isFull = q.current_count >= q.max_count;
          return (
            <div key={q.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <Space>
                  <Tag color="blue">{q.question_title?.substring(0, 10) || q.question_id}</Tag>
                  <Tag color="cyan">{q.answer_value}</Tag>
                </Space>
                <span>
                  <b style={{ color: isFull ? '#f5222d' : '#1890ff' }}>{q.current_count}</b>
                  <span style={{ color: '#999' }}> / {q.max_count}</span>
                </span>
              </div>
              <Progress percent={pct} size="small" status={isFull ? 'exception' : 'active'} />
              <Divider style={{ margin: '8px 0' }} />
            </div>
          );
        })}
      </Space>
    </Card>
  );
}
