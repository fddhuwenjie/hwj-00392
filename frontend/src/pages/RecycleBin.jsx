import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Table, Space, Tag, Popconfirm, Modal, message, Card, Empty } from 'antd';
import { ArrowLeftOutlined, RollbackOutlined, DeleteOutlined } from '@ant-design/icons';
import api from '../api';
import dayjs from 'dayjs';

export default function RecycleBin() {
  const navigate = useNavigate();
  const [surveys, setSurveys] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSurveys();
  }, []);

  const loadSurveys = async () => {
    try {
      setLoading(true);
      const res = await api.getRecycleBin();
      setSurveys(res.data);
    } catch (e) {
      message.error('加载回收站失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRestore = async (id) => {
    try {
      await api.restoreSurvey(id);
      message.success('恢复成功');
      loadSurveys();
    } catch (e) {
      message.error(e.response?.data?.error || '恢复失败');
    }
  };

  const handlePermanentDelete = async (id) => {
    try {
      await api.permanentDeleteSurvey(id);
      message.success('已永久删除');
      loadSurveys();
    } catch (e) {
      message.error(e.response?.data?.error || '删除失败');
    }
  };

  const getDaysRemaining = (deletedAt) => {
    if (!deletedAt) return 30;
    const deleted = dayjs(deletedAt);
    const expire = deleted.add(30, 'day');
    const remaining = expire.diff(dayjs(), 'day');
    return Math.max(0, remaining);
  };

  const columns = [
    {
      title: '问卷标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true
    },
    {
      title: '原状态',
      dataIndex: 'original_status',
      key: 'original_status',
      width: 120,
      render: (s) => {
        if (s === 'published') return <Tag color="green">已发布</Tag>;
        return <Tag color="default">草稿</Tag>;
      }
    },
    {
      title: '删除时间',
      dataIndex: 'deleted_at',
      key: 'deleted_at',
      width: 180,
      render: (t) => dayjs(t).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '剩余保留天数',
      dataIndex: 'deleted_at',
      key: 'remaining',
      width: 120,
      render: (t) => {
        const days = getDaysRemaining(t);
        const color = days <= 3 ? 'red' : days <= 7 ? 'orange' : 'blue';
        return <Tag color={color}>{days} 天</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 200,
      render: (_, r) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<RollbackOutlined />}
            onClick={() => handleRestore(r.id)}
          >
            恢复
          </Button>
          <Popconfirm
            title="确定永久删除？"
            description="删除后无法恢复，问卷及答卷数据将全部清除。"
            okText="永久删除"
            okButtonProps={{ danger: true }}
            cancelText="取消"
            onConfirm={() => handlePermanentDelete(r.id)}
          >
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>
              永久删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/surveys')}>返回</Button>
          <span style={{ fontSize: 18, fontWeight: 'bold' }}>回收站</span>
          <Tag color="default">问卷删除后保留 30 天，过期将自动永久删除</Tag>
        </Space>
      </Card>
      <Card>
        <Table
          rowKey="id"
          columns={columns}
          dataSource={surveys}
          loading={loading}
          pagination={{ pageSize: 10, showSizeChanger: true }}
          scroll={{ x: 800 }}
          locale={{ emptyText: <Empty description="回收站为空" /> }}
        />
      </Card>
    </div>
  );
}
