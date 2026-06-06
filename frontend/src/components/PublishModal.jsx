import React, { useState, useEffect } from 'react';
import { Modal, Form, DatePicker, InputNumber, Input, Button, message, App, Card, Tag, Space, Alert } from 'antd';
import { LinkOutlined, ScheduleOutlined, RocketOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import api from '../api';

export default function PublishModal({ visible, surveyId, onClose }) {
  const [form] = Form.useForm();
  const [published, setPublished] = useState(null);
  const [loading, setLoading] = useState(false);
  const [publishMode, setPublishMode] = useState('now');
  const { message } = App.useApp();

  useEffect(() => {
    if (visible && surveyId) {
      loadPublishData();
    }
  }, [visible, surveyId]);

  const loadPublishData = async () => {
    try {
      const res = await api.getSurvey(surveyId);
      const s = res.data;
      form.setFieldsValue({
        start_time: s.start_time ? dayjs(s.start_time) : null,
        end_time: s.end_time ? dayjs(s.end_time) : null,
        max_responses: s.max_responses,
        password: s.password || '',
        scheduled_publish_time: s.scheduled_publish_time ? dayjs(s.scheduled_publish_time) : null
      });
      if (s.scheduled_publish_time) {
        setPublishMode('scheduled');
      }
      if (s.status === 'published') {
        setPublished({ short_code: s.short_code, is_paused: s.is_paused });
      }
    } catch (e) { }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      const data = {
        start_time: values.start_time ? values.start_time.toISOString() : null,
        end_time: values.end_time ? values.end_time.toISOString() : null,
        max_responses: values.max_responses || null,
        password: values.password || null
      };
      if (publishMode === 'scheduled' && values.scheduled_publish_time) {
        data.scheduled_publish_time = values.scheduled_publish_time.toISOString();
      }
      const res = await api.publishSurvey(surveyId, data);
      if (res.data.scheduled) {
        message.success(`已设置定时发布，将于 ${dayjs(res.data.scheduled_publish_time).format('YYYY-MM-DD HH:mm')} 自动发布`);
      } else {
        setPublished({ short_code: res.data.short_code, is_paused: false });
        message.success('发布成功');
      }
    } catch (e) {
      if (e.errorFields) return;
      message.error('发布失败');
    } finally {
      setLoading(false);
    }
  };

  const handlePauseResume = async () => {
    try {
      if (published.is_paused) {
        await api.resumeSurvey(surveyId);
        setPublished({ ...published, is_paused: false });
        message.success('已恢复收集');
      } else {
        await api.pauseSurvey(surveyId);
        setPublished({ ...published, is_paused: true });
        message.success('已暂停收集');
      }
    } catch (e) {
      message.error('操作失败');
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/fill/${published.short_code}`;
    navigator.clipboard.writeText(url);
    message.success('链接已复制');
  };

  const openLink = () => {
    window.open(`/fill/${published.short_code}`, '_blank');
  };

  return (
    <Modal
      title={published ? '问卷已发布' : '发布问卷'}
      open={visible}
      onCancel={onClose}
      footer={null}
      width={560}
    >
      {!published ? (
        <Form form={form} layout="vertical">
          <Card size="small" style={{ marginBottom: 16 }}>
            <Space style={{ marginBottom: 12 }}>
              <Button
                type={publishMode === 'now' ? 'primary' : 'default'}
                icon={<RocketOutlined />}
                onClick={() => setPublishMode('now')}
              >
                立即发布
              </Button>
              <Button
                type={publishMode === 'scheduled' ? 'primary' : 'default'}
                icon={<ScheduleOutlined />}
                onClick={() => setPublishMode('scheduled')}
              >
                定时发布
              </Button>
            </Space>
            {publishMode === 'scheduled' && (
              <Alert
                type="info"
                showIcon
                message="定时发布将在设定时间自动从草稿变为发布状态"
                style={{ marginBottom: 12 }}
              />
            )}
            {publishMode === 'scheduled' && (
              <Form.Item
                label="定时发布时间"
                name="scheduled_publish_time"
                rules={[{ required: true, message: '请选择发布时间' }]}
              >
                <DatePicker
                  showTime
                  style={{ width: '100%' }}
                  placeholder="选择发布时间"
                  disabledDate={(current) => current && current < dayjs().startOf('day')}
                />
              </Form.Item>
            )}
          </Card>

          <Form.Item label="开始收集时间" name="start_time">
            <DatePicker showTime style={{ width: '100%' }} placeholder="不设置则立即开始" />
          </Form.Item>
          <Form.Item
            label="结束收集时间"
            name="end_time"
            rules={[{
              validator: (_, value) => {
                const start = form.getFieldValue('start_time');
                if (value && start && value.isBefore(start)) {
                  return Promise.reject('结束时间不能早于开始时间');
                }
                return Promise.resolve();
              }
            }]}
          >
            <DatePicker showTime style={{ width: '100%' }} placeholder="不设置则长期有效" />
          </Form.Item>
          <Form.Item label="最大回收量" name="max_responses">
            <InputNumber min={1} style={{ width: '100%' }} placeholder="不设置则无限制" />
          </Form.Item>
          <Form.Item label="访问密码（可选）" name="password">
            <Input.Password placeholder="留空则无需密码" />
          </Form.Item>
          <div style={{ textAlign: 'right', marginTop: 16 }}>
            <Button onClick={onClose} style={{ marginRight: 8 }}>取消</Button>
            <Button type="primary" loading={loading} onClick={handleSubmit}>
              {publishMode === 'scheduled' ? '设置定时发布' : '确认发布'}
            </Button>
          </div>
        </Form>
      ) : (
        <div>
          <div style={{ background: '#f6ffed', border: '1px solid #b7eb8f', padding: 16, borderRadius: 8, marginBottom: 16 }}>
            <div style={{ fontSize: 16, fontWeight: 'bold', color: '#52c41a', marginBottom: 8 }}>
              ✅ {published.is_paused ? '问卷已暂停' : '问卷已发布'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Input value={`${window.location.origin}/fill/${published.short_code}`} readOnly />
              <Button onClick={copyLink}>复制</Button>
              <Button type="primary" onClick={openLink}>打开</Button>
            </div>
          </div>
          <div style={{ textAlign: 'center', padding: 16, background: '#fafafa', borderRadius: 8, marginBottom: 16 }}>
            <div className="qr-code-text" style={{ margin: '0 auto', width: 180, height: 180 }}>
              [二维码模拟]<br /><br />
              短链: {published.short_code}<br /><br />
              扫描填写问卷
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <Button onClick={onClose} style={{ marginRight: 8 }}>关闭</Button>
            <Button type={published.is_paused ? 'primary' : 'default'} onClick={handlePauseResume}>
              {published.is_paused ? '恢复收集' : '暂停收集'}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
