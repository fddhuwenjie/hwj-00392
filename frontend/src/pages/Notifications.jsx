import React, { useState, useEffect, useCallback } from 'react';
import {
  Card, List, Tag, Button, Space, Empty, Tabs, Dropdown, Badge,
  Row, Col, Statistic, Modal, message, Popconfirm, Avatar, Tooltip
} from 'antd';
import {
  BellOutlined, CheckOutlined, DeleteOutlined,
  ScheduleOutlined, TrophyOutlined, BarChartOutlined,
  FileTextOutlined, ReadOutlined, ClearOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import dayjs from 'dayjs';

const TYPE_CONFIG = {
  milestone: { label: '里程碑', color: 'gold', icon: <TrophyOutlined /> },
  scheduled_publish: { label: '定时发布', color: 'purple', icon: <ScheduleOutlined /> },
  daily_summary: { label: '每日摘要', color: 'cyan', icon: <BarChartOutlined /> },
  default: { label: '通知', color: 'blue', icon: <BellOutlined /> }
};

function NotificationItem({ item, onRead }) {
  const cfg = TYPE_CONFIG[item.type] || TYPE_CONFIG.default;
  const navigate = useNavigate();

  const handleClick = () => {
    if (!item.is_read) {
      onRead(item.id);
    }
    if (item.survey_id) {
      navigate(`/analysis/${item.survey_id}`);
    }
  };

  return (
    <List.Item
      onClick={handleClick}
      style={{
        cursor: 'pointer',
        background: item.is_read ? '#fff' : '#f0f7ff',
        padding: '12px 16px',
        borderBottom: '1px solid #f0f0f0'
      }}
    >
      <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space style={{ flex: 1, minWidth: 0 }}>
          <Avatar
            style={{ backgroundColor: cfg.color, flexShrink: 0 }}
            icon={cfg.icon}
          />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontWeight: item.is_read ? 400 : 600, fontSize: 14 }}>
              {!item.is_read && <span style={{ color: '#f5222d', marginRight: 4 }}>●</span>}
              {item.title}
            </div>
            {item.content && (
              <div style={{ color: '#666', fontSize: 12, marginTop: 4, whiteSpace: 'normal' }}>
                {item.content}
              </div>
            )}
            <div style={{ color: '#999', fontSize: 11, marginTop: 4 }}>
              <Space>
                <Tag color={cfg.color}>{cfg.label}</Tag>
                <ClockCircleOutlined /> {dayjs(item.created_at).format('YYYY-MM-DD HH:mm')}
              </Space>
            </div>
          </div>
        </Space>
        {!item.is_read && (
          <Tooltip title="标记已读">
            <Button
              type="text"
              size="small"
              icon={<ReadOutlined />}
              onClick={(e) => { e.stopPropagation(); onRead(item.id); }}
            />
          </Tooltip>
        )}
      </Space>
    </List.Item>
  );
}

export default function NotificationCenter() {
  const [data, setData] = useState({ list: [], total: 0, unread_count: 0 });
  const [loading, setLoading] = useState(false);
  const [activeKey, setActiveKey] = useState('all');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, pageSize };
      if (activeKey === 'unread') params.is_read = 0;
      else if (activeKey === 'read') params.is_read = 1;
      const res = await api.getNotifications(params);
      setData(res.data);
    } catch (e) {} finally {
      setLoading(false);
    }
  }, [page, activeKey]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      loadData();
    } catch (e) { message.error('操作失败'); }
  };

  const handleMarkAll = async () => {
    try {
      await api.markAllNotificationsRead();
      message.success('已全部标记为已读');
      loadData();
    } catch (e) { message.error('操作失败'); }
  };

  const handleClearRead = async () => {
    try {
      await api.clearNotifications({ only_read: true });
      message.success('已清除已读通知');
      setPage(1);
      loadData();
    } catch (e) { message.error('操作失败'); }
  };

  const tabItems = [
    { key: 'all', label: <span><BellOutlined /> 全部</span> },
    {
      key: 'unread',
      label: (
        <span>
          <Badge count={data.unread_count} size="small" offset={[6, -2]}>
            未读
          </Badge>
        </span>
      )
    },
    { key: 'read', label: <span><ReadOutlined /> 已读</span> }
  ];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Row justify="space-between" align="middle" gutter={16}>
          <Col>
            <Space>
              <span style={{ fontSize: 18, fontWeight: 'bold' }}>
                <BellOutlined /> 通知中心
              </span>
              {data.unread_count > 0 && (
                <Tag color="red">{data.unread_count} 条未读</Tag>
              )}
            </Space>
          </Col>
          <Col>
            <Space>
              <Button icon={<CheckOutlined />} onClick={handleMarkAll} disabled={data.unread_count === 0}>
                全部已读
              </Button>
              <Popconfirm title="确定清除所有已读通知？" onConfirm={handleClearRead}>
                <Button icon={<ClearOutlined />}>清除已读</Button>
              </Popconfirm>
            </Space>
          </Col>
        </Row>
      </Card>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="总通知数" value={data.total} prefix={<BellOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="未读数" value={data.unread_count} valueStyle={{ color: '#f5222d' }} prefix={<Badge dot />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="里程碑" value={<TrophyOutlined />} prefix={<ScheduleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card size="small">
            <Statistic title="每日摘要" value={<BarChartOutlined />} prefix={<FileTextOutlined />} />
          </Card>
        </Col>
      </Row>

      <Card>
        <Tabs
          activeKey={activeKey}
          onChange={setActiveKey}
          items={tabItems}
          tabBarExtraContent={
            <span style={{ color: '#999', fontSize: 12 }}>
              共 {data.total} 条
            </span>
          }
        >
          {tabItems.map(tab => (
            <Tabs.TabPane key={tab.key} tab={tab.label}>
              {data.list && data.list.length > 0 ? (
                <>
                  <List
                    loading={loading}
                    dataSource={data.list}
                    renderItem={item => (
                      <NotificationItem key={item.id} item={item} onRead={handleRead} />
                    )}
                  />
                  {data.total > pageSize && (
                    <div style={{ textAlign: 'center', marginTop: 16 }}>
                      <Space>
                        <Button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
                          上一页
                        </Button>
                        <span>第 {page} 页 / 共 {Math.ceil(data.total / pageSize)} 页</span>
                        <Button
                          onClick={() => setPage(p => p + 1)}
                          disabled={page >= Math.ceil(data.total / pageSize)}
                        >
                          下一页
                        </Button>
                      </Space>
                    </div>
                  )}
                </>
              ) : (
                <Empty description="暂无通知" style={{ padding: '60px 0' }} />
              )}
            </Tabs.TabPane>
          ))}
        </Tabs>
      </Card>
    </div>
  );
}

export function NotificationBadge({ onClick }) {
  const [unread, setUnread] = useState(0);

  const load = async () => {
    try {
      const res = await api.getNotifications({ pageSize: 1 });
      setUnread(res.data.unread_count || 0);
    } catch (e) {}
  };

  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  return (
    <Badge count={unread} size="small" offset={[4, -2]}>
      <Button
        type="text"
        icon={<BellOutlined />}
        onClick={onClick}
        style={{ fontSize: 16 }}
      />
    </Badge>
  );
}
