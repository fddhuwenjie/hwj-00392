import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Button, Card, Row, Col, Tag, Modal, Form, Input, Select, message,
  Popconfirm, Empty, App
} from 'antd';
import {
  CheckCircleOutlined, CheckSquareOutlined, EditOutlined, StarOutlined,
  OrderedListOutlined, SmileOutlined, TableOutlined, PlusOutlined,
  DeleteOutlined, AppstoreOutlined
} from '@ant-design/icons';
import api from '../api';

const { Option } = Select;

function getQuestionIcon(type) {
  const icons = {
    single: <CheckCircleOutlined />,
    multi: <CheckSquareOutlined />,
    text: <EditOutlined />,
    rating: <StarOutlined />,
    nps: <SmileOutlined />,
    matrix: <TableOutlined />,
    sort: <OrderedListOutlined />
  };
  return icons[type] || null;
}

export default function Templates() {
  const navigate = useNavigate();
  const [templates, setTemplates] = useState([]);
  const [category, setCategory] = useState('');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [surveys, setSurveys] = useState([]);
  const [form] = Form.useForm();
  const { message } = App.useApp();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const [tRes, sRes] = await Promise.all([api.getTemplates(), api.getSurveys()]);
      setTemplates(tRes.data);
      setSurveys(sRes.data);
    } catch (e) { }
  };

  const filtered = category ? templates.filter(t => t.category === category) : templates;

  const categories = [...new Set(templates.map(t => t.category).filter(Boolean))];

  const handleUse = (tpl) => {
    Modal.confirm({
      title: '使用该模板？',
      content: `将创建一份基于「${tpl.name}」的新问卷`,
      onOk: async () => {
        try {
          const res = await api.createSurvey({
            title: tpl.name,
            description: tpl.description,
            questions: tpl.questions,
            display_mode: 'all'
          });
          message.success('创建成功');
          navigate(`/editor/${res.data.id}`);
        } catch (e) {
          message.error('创建失败');
        }
      }
    });
  };

  const handleSaveFromSurvey = async () => {
    try {
      const values = await form.validateFields();
      const survey = surveys.find(s => s.id === values.survey_id);
      if (!survey) {
        message.error('请选择问卷');
        return;
      }
      await api.createTemplate({
        name: values.name,
        description: values.description || '',
        category: values.category || '',
        questions: survey.questions
      });
      message.success('保存成功');
      setShowSaveModal(false);
      form.resetFields();
      loadData();
    } catch (e) {
      if (e.errorFields) return;
      message.error('保存失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.deleteTemplate(id);
      message.success('删除成功');
      loadData();
    } catch (e) {
      message.error(e.response?.data?.error || '删除失败');
    }
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={16}>
          <Col xs={24} sm={16}>
            <Select
              placeholder="筛选分类"
              allowClear
              style={{ width: 160 }}
              value={category}
              onChange={setCategory}
            >
              {categories.map(c => <Option key={c} value={c}>{c}</Option>)}
            </Select>
          </Col>
          <Col xs={24} sm={8} style={{ textAlign: 'right' }}>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setShowSaveModal(true)}>
              保存问卷为模板
            </Button>
          </Col>
        </Row>
      </Card>

      {filtered.length === 0 ? (
        <Empty description="暂无模板" />
      ) : (
        <Row gutter={[16, 16]}>
          {filtered.map(tpl => (
            <Col xs={24} sm={12} md={8} lg={6} key={tpl.id}>
              <Card
                className="template-card"
                hoverable
                onClick={() => handleUse(tpl)}
                actions={[
                  tpl.is_builtin ? (
                    <Tag color="blue" key="builtin">预置</Tag>
                  ) : (
                    <Popconfirm key="del" title="确定删除此模板？" onConfirm={() => handleDelete(tpl.id)}>
                      <Button type="link" danger size="small" icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()}>删除</Button>
                    </Popconfirm>
                  )
                ]}
              >
                <div style={{ marginBottom: 12 }}>
                  <AppstoreOutlined style={{ fontSize: 36, color: '#1890ff' }} />
                </div>
                <div style={{ fontWeight: 'bold', fontSize: 16, marginBottom: 8 }}>{tpl.name}</div>
                {tpl.description && (
                  <div style={{ fontSize: 12, color: '#999', marginBottom: 12, minHeight: 36 }}>{tpl.description}</div>
                )}
                {tpl.category && <Tag style={{ marginBottom: 12 }}>{tpl.category}</Tag>}
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {tpl.questions.slice(0, 8).map(q => (
                    <span key={q.id} style={{ color: '#1890ff' }} title={q.title}>{getQuestionIcon(q.type)}</span>
                  ))}
                  <span style={{ fontSize: 12, color: '#999', marginLeft: 4 }}>共{tpl.questions.length}题</span>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      )}

      <Modal
        title="保存问卷为模板"
        open={showSaveModal}
        onCancel={() => { setShowSaveModal(false); form.resetFields(); }}
        onOk={handleSaveFromSurvey}
        okText="保存"
      >
        <Form form={form} layout="vertical">
          <Form.Item label="选择问卷" name="survey_id" rules={[{ required: true, message: '请选择要保存的问卷' }]}>
            <Select placeholder="选择一个已有的问卷">
              {surveys.map(s => <Option key={s.id} value={s.id}>{s.title}</Option>)}
            </Select>
          </Form.Item>
          <Form.Item label="模板名称" name="name" rules={[{ required: true, message: '请输入模板名称' }]}>
            <Input placeholder="给模板起个名字" />
          </Form.Item>
          <Form.Item label="分类" name="category">
            <Select placeholder="选择或输入分类" allowClear showSearch mode={undefined} options={categories.map(c => ({ value: c, label: c }))}>
            </Select>
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={2} placeholder="模板说明（选填）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
