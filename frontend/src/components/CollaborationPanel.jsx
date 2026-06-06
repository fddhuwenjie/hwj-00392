import React, { useState, useEffect } from 'react';
import {
  Modal, Form, Input, Button, Table, Tag, Space, Select, message,
  Card, List, Avatar, Tooltip, Divider
} from 'antd';
import {
  UserOutlined, DeleteOutlined, EditOutlined, TeamOutlined,
  ClockCircleOutlined, HistoryOutlined, LockOutlined
} from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

const { Option } = Select;

const CURRENT_USER = { email: 'owner@survey.com', name: '问卷创建者' };

export function CollaboratorPanel({ surveyId, visible, onClose }) {
  const [collaborators, setCollaborators] = useState([]);
  const [addVisible, setAddVisible] = useState(false);
  const [locks, setLocks] = useState([]);
  const [logs, setLogs] = useState([]);
  const [logsPage, setLogsPage] = useState(1);
  const [logsTotal, setLogsTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (visible && surveyId) {
      loadAll();
    }
  }, [visible, surveyId, logsPage]);

  const loadAll = async () => {
    try {
      const [cRes, lRes, logRes] = await Promise.all([
        api.getCollaborators(surveyId),
        api.getLocks(surveyId),
        api.getOperationLogs(surveyId, { page: logsPage, pageSize: 20 })
      ]);
      setCollaborators(cRes.data);
      setLocks(lRes.data);
      setLogs(logRes.data.list);
      setLogsTotal(logRes.data.total);
    } catch (e) {}
  };

  const handleAdd = async () => {
    try {
      const values = await form.validateFields();
      await api.addCollaborator(surveyId, values);
      message.success('邀请成功');
      setAddVisible(false);
      form.resetFields();
      loadAll();
    } catch (e) {
      message.error(e.response?.data?.error || '添加失败');
    }
  };

  const handlePermissionChange = async (id, permission) => {
    try {
      await api.updateCollaborator(surveyId, id, { permission });
      message.success('权限已更新');
      loadAll();
    } catch (e) { message.error('更新失败'); }
  };

  const handleRemove = async (id) => {
    try {
      await api.removeCollaborator(surveyId, id);
      message.success('已移除');
      loadAll();
    } catch (e) { message.error('移除失败'); }
  };

  const columns = [
    {
      title: '协作者',
      key: 'user',
      render: (_, r) => (
        <Space>
          <Avatar icon={<UserOutlined />} style={{ backgroundColor: r.permission === 'edit' ? '#1890ff' : '#999' }} />
          <div>
            <div style={{ fontWeight: 500 }}>{r.name}</div>
            <div style={{ fontSize: 12, color: '#999' }}>{r.email}</div>
          </div>
        </Space>
      )
    },
    {
      title: '权限',
      dataIndex: 'permission',
      width: 140,
      render: (v, r) => (
        <Select
          value={v}
          size="small"
          style={{ width: 100 }}
          onChange={(val) => handlePermissionChange(r.id, val)}
        >
          <Option value="edit">可编辑</Option>
          <Option value="view">只读</Option>
        </Select>
      )
    },
    {
      title: '邀请时间',
      dataIndex: 'invited_at',
      width: 160,
      render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, r) => (
        <Button type="text" danger size="small" icon={<DeleteOutlined />} onClick={() => handleRemove(r.id)}>
          移除
        </Button>
      )
    }
  ];

  const logActions = {
    create_question: { label: '创建题目', color: 'green' },
    update_question: { label: '更新题目', color: 'blue' },
    delete_question: { label: '删除题目', color: 'red' },
    reorder_question: { label: '排序题目', color: 'purple' },
    update_survey: { label: '更新问卷', color: 'cyan' },
    publish_survey: { label: '发布问卷', color: 'gold' }
  };

  return (
    <>
      <Modal
        title={<span><TeamOutlined /> 协作与操作日志</span>}
        open={visible}
        onCancel={onClose}
        footer={null}
        width={800}
      >
        <Card
          size="small"
          title={
            <Space>
              <span>协作者管理</span>
              <Button type="primary" size="small" icon={<EditOutlined />} onClick={() => setAddVisible(true)}>
                邀请协作者
              </Button>
            </Space>
          }
          style={{ marginBottom: 16 }}
        >
          <Table
            size="small"
            rowKey="id"
            dataSource={[{ id: 'owner', name: CURRENT_USER.name, email: CURRENT_USER.email, permission: 'owner', invited_at: new Date().toISOString() }, ...collaborators]}
            columns={columns.map(c => c.key === 'action' ? {
              ...c,
              render: (_, r) => r.id === 'owner' ? <Tag color="gold">所有者</Tag> : c.render(_, r)
            } : c)}
            pagination={false}
          />
        </Card>

        <Card
          size="small"
          title={<span><LockOutlined /> 编辑锁状态</span>}
          style={{ marginBottom: 16 }}
        >
          {locks.length === 0 ? (
            <div style={{ color: '#999', textAlign: 'center', padding: '12px 0' }}>当前无编辑中的题目</div>
          ) : (
            <List
              size="small"
              dataSource={locks}
              renderItem={lock => (
                <List.Item>
                  <Space>
                    <Tag color="orange">编辑中</Tag>
                    <span><b>{lock.user_name}</b> 正在编辑题目 <b>{lock.question_id}</b></span>
                    <span style={{ color: '#999', fontSize: 12 }}>
                      <ClockCircleOutlined /> {dayjs(lock.locked_at).format('HH:mm:ss')}
                    </span>
                  </Space>
                </List.Item>
              )}
            />
          )}
        </Card>

        <Card size="small" title={<span><HistoryOutlined /> 操作日志</span>}>
          <List
            size="small"
            dataSource={logs}
            pagination={{
              current: logsPage,
              pageSize: 20,
              total: logsTotal,
              onChange: setLogsPage,
              size: 'small'
            }}
            renderItem={log => (
              <List.Item>
                <Space>
                  <Avatar size="small" icon={<UserOutlined />} />
                  <span><b>{log.user_name}</b></span>
                  <Tag color={logActions[log.action]?.color || 'default'}>
                    {logActions[log.action]?.label || log.action}
                  </Tag>
                  {log.question_title && <span>· {log.question_title}</span>}
                  {log.detail && <Tooltip title={log.detail}><span style={{ color: '#999' }}>详情</span></Tooltip>}
                  <span style={{ color: '#999', fontSize: 12, marginLeft: 'auto' }}>
                    {dayjs(log.created_at).format('MM-DD HH:mm')}
                  </span>
                </Space>
              </List.Item>
            )}
          />
        </Card>
      </Modal>

      <Modal
        title="邀请协作者"
        open={addVisible}
        onCancel={() => setAddVisible(false)}
        onOk={handleAdd}
        okText="发送邀请"
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="邮箱"
            name="email"
            rules={[{ required: true, message: '请输入邮箱' }, { type: 'email', message: '邮箱格式不正确' }]}
          >
            <Input placeholder="collaborator@example.com" />
          </Form.Item>
          <Form.Item label="姓名" name="name">
            <Input placeholder="协作者姓名（可选）" />
          </Form.Item>
          <Form.Item label="权限" name="permission" initialValue="edit">
            <Select>
              <Option value="edit">可编辑</Option>
              <Option value="view">只读</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </>
  );
}

export function EditLockBadge({ lock }) {
  if (!lock) return null;
  return (
    <Tag color="orange" icon={<LockOutlined />}>
      {lock.user_name || lock.user_email} 正在编辑
    </Tag>
  );
}

export { CURRENT_USER };
