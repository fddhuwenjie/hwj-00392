import React, { useState, useEffect } from 'react';
import {
  Card, Tabs, Button, Space, Tag, Alert, List, Form, Select, Input,
  Row, Col, Empty, Modal, Tree, message, Tooltip, Divider
} from 'antd';
import {
  BulbOutlined, WarningOutlined, CheckCircleOutlined,
  CloseCircleOutlined, PlayCircleOutlined, ForkOutlined,
  RocketOutlined
} from '@ant-design/icons';
import api from '../api';

const { Option } = Select;

const CONFLICT_TYPES = {
  missing_target: { label: '跳转目标不存在', icon: <CloseCircleOutlined />, color: 'red' },
  cycle: { label: '循环跳转', icon: <CloseCircleOutlined />, color: 'red' },
  backward_jump: { label: '回退跳转', icon: <WarningOutlined />, color: 'orange' },
  unreachable: { label: '不可达题目', icon: <WarningOutlined />, color: 'orange' }
};

function BranchFlowChart({ branches, questions }) {
  const qMap = {};
  questions.forEach((q, i) => { qMap[q.id] = { ...q, index: i }; });

  const buildTreeNodes = () => {
    const nodes = [];
    questions.forEach((q, i) => {
      const children = [];
      const qBranches = branches.filter(b => b.fromQuestionId === q.id);
      qBranches.forEach(b => {
        children.push({
          key: `${q.id}-${b.toQuestionId}`,
          title: (
            <Space>
              <Tag color="purple">{b.fromOption}</Tag>
              <span>→</span>
              <Tag color="blue">Q{qMap[b.toQuestionId]?.index + 1 || '?'}: {b.toQuestionTitle.substring(0, 15)}</Tag>
            </Space>
          )
        });
      });
      if (qBranches.length === 0 && i < questions.length - 1) {
        children.push({
          key: `${q.id}-next`,
          title: <Tag color="default">默认 → Q{i + 2}</Tag>
        });
      }
      nodes.push({
        key: q.id,
        title: (
          <Space>
            <Tag color="blue">Q{i + 1}</Tag>
            <span style={{ fontWeight: 500 }}>{q.title.substring(0, 25)}</span>
            {q.branching && <Tag color="purple" icon={<ForkOutlined />}>分支</Tag>}
          </Space>
        ),
        children
      });
    });
    return nodes;
  };

  return (
    <div style={{ padding: 16, background: '#fafafa', borderRadius: 8 }}>
      <div style={{ fontWeight: 'bold', marginBottom: 12 }}>
        <ForkOutlined /> 分支跳转关系图（树形展示）
      </div>
      {questions.length === 0 ? (
        <Empty description="暂无题目" />
      ) : (
        <Tree
          showLine={{ showLeafIcon: false }}
          defaultExpandAll
          treeData={buildTreeNodes()}
        />
      )}
    </div>
  );
}

function ConflictList({ conflicts }) {
  if (conflicts.length === 0) {
    return (
      <Alert
        type="success"
        showIcon
        icon={<CheckCircleOutlined />}
        message="逻辑检查通过"
        description="未检测到分支逻辑冲突，问卷设置正确。"
        style={{ marginBottom: 16 }}
      />
    );
  }
  return (
    <div>
      <Alert
        type="warning"
        showIcon
        message={`检测到 ${conflicts.length} 个潜在问题`}
        style={{ marginBottom: 12 }}
      />
      <List
        dataSource={conflicts}
        renderItem={c => (
          <List.Item style={{ borderBottom: '1px solid #f0f0f0', padding: '8px 0' }}>
            <Space>
              <Tag color={CONFLICT_TYPES[c.type]?.color || 'default'}>
                {CONFLICT_TYPES[c.type]?.label || c.type}
              </Tag>
              <span>{c.message}</span>
            </Space>
          </List.Item>
        )}
      />
    </div>
  );
}

function SimulatorPanel({ questions, surveyId, onClose }) {
  const [answers, setAnswers] = useState({});
  const [path, setPath] = useState([]);
  const [visitedIds, setVisitedIds] = useState(new Set());
  const [simulating, setSimulating] = useState(false);
  const [form] = Form.useForm();

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      const res = await api.simulatePath(surveyId, answers);
      setPath(res.data.path);
      setVisitedIds(new Set(res.data.path.filter(p => p.questionId).map(p => p.questionId)));
      message.success(`模拟完成，经过 ${res.data.visitedCount} 道题`);
    } catch (e) {
      message.error('模拟失败');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <Modal
      title={<span><PlayCircleOutlined /> 模拟填答路径</span>}
      open={true}
      onCancel={onClose}
      onOk={handleSimulate}
      okText="开始模拟"
      confirmLoading={simulating}
      width={700}
    >
      <Card size="small" style={{ marginBottom: 12 }} title="设置模拟答案">
        <Form form={form} layout="vertical">
          {questions.filter(q => ['single', 'multi'].includes(q.type)).map(q => (
            <Form.Item key={q.id} label={`${q.title}（可选）`}>
              <Select
                mode={q.type === 'multi' ? 'multiple' : undefined}
                allowClear
                placeholder="请选择答案"
                value={answers[q.id]}
                onChange={(v) => setAnswers({ ...answers, [q.id]: v })}
                style={{ width: '100%' }}
              >
                {(q.options || []).map(o => <Option key={o} value={o}>{o}</Option>)}
              </Select>
            </Form.Item>
          ))}
        </Form>
      </Card>

      {path.length > 0 && (
        <Card size="small" title="模拟路径（已经过的题目高亮）">
          <List
            size="small"
            dataSource={path}
            renderItem={(p, idx) => (
              <List.Item style={visitedIds.has(p.questionId) ? { background: '#e6f7ff', borderRadius: 4 } : {}}>
                <Space>
                  <Tag color="blue">Step {idx + 1}</Tag>
                  {p.questionId ? (
                    <>
                      <Tag color={visitedIds.has(p.questionId) ? 'green' : 'default'}>
                        Q{questions.findIndex(q => q.id === p.questionId) + 1}
                      </Tag>
                      <span>{p.questionTitle}</span>
                      {p.answer !== null && p.answer !== undefined && (
                        <Tooltip title={`答案: ${Array.isArray(p.answer) ? p.answer.join(', ') : p.answer}`}>
                          <Tag color="cyan">有答案</Tag>
                        </Tooltip>
                      )}
                    </>
                  ) : (
                    <Tag color="orange">{p.warning}</Tag>
                  )}
                </Space>
              </List.Item>
            )}
          />
          <Divider style={{ margin: '12px 0' }} />
          <Row justify="space-around">
            <Col><Tag color="blue">总题数: {questions.length}</Tag></Col>
            <Col><Tag color="green">经过: {visitedIds.size}</Tag></Col>
            <Col><Tag color="orange">跳过: {questions.length - visitedIds.size}</Tag></Col>
          </Row>
        </Card>
      )}
    </Modal>
  );
}

export default function LogicValidatorPanel({ surveyId, questions }) {
  const [visible, setVisible] = useState(false);
  const [data, setData] = useState({ branches: [], conflicts: [], questions: [] });
  const [loading, setLoading] = useState(false);
  const [simVisible, setSimVisible] = useState(false);

  const loadData = async () => {
    if (!surveyId) return;
    setLoading(true);
    try {
      const res = await api.validateLogic(surveyId);
      setData(res.data);
    } catch (e) {} finally { setLoading(false); }
  };

  useEffect(() => {
    if (visible) loadData();
  }, [visible, surveyId]);

  return (
    <>
      <Tooltip title="逻辑验证">
        <Button icon={<BulbOutlined />} onClick={() => setVisible(true)}>
          逻辑验证
        </Button>
      </Tooltip>

      <Modal
        title={<span><BulbOutlined /> 答题逻辑验证器</span>}
        open={visible}
        onCancel={() => setVisible(false)}
        footer={[
          <Button key="close" onClick={() => setVisible(false)}>关闭</Button>,
          <Button key="simulate" type="primary" icon={<PlayCircleOutlined />} onClick={() => setSimVisible(true)}>
            模拟填答
          </Button>
        ]}
        width={800}
      >
        <Tabs
          items={[
            {
              key: 'flow',
              label: <span><ForkOutlined /> 分支关系</span>,
              children: <BranchFlowChart branches={data.branches} questions={data.questions} />
            },
            {
              key: 'conflicts',
              label: (
                <span>
                  <WarningOutlined /> 逻辑冲突检测
                  {data.conflicts.length > 0 && (
                    <Tag color="red" style={{ marginLeft: 4 }}>{data.conflicts.length}</Tag>
                  )}
                </span>
              ),
              children: <ConflictList conflicts={data.conflicts} />
            },
            {
              key: 'info',
              label: <span><RocketOutlined /> 说明</span>,
              children: (
                <div style={{ color: '#666', lineHeight: 1.8 }}>
                  <p><b>逻辑验证器功能说明：</b></p>
                  <ul>
                    <li><b>分支关系图</b>：可视化展示所有题目间的分支跳转关系</li>
                    <li><b>循环跳转检测</b>：检测是否存在可能导致死循环的跳转</li>
                    <li><b>不可达题目检测</b>：提示可能永远无法到达的题目</li>
                    <li><b>目标存在性检查</b>：验证所有跳转目标是否有效存在</li>
                    <li><b>模拟填答</b>：输入一组答案，模拟走一遍分支逻辑</li>
                  </ul>
                </div>
              )
            }
          ]}
        />
      </Modal>

      {simVisible && (
        <SimulatorPanel
          questions={questions}
          surveyId={surveyId}
          onClose={() => setSimVisible(false)}
        />
      )}
    </>
  );
}
