import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Button, Input, Card, Space, message, Modal, Form, Select, Switch,
  InputNumber, DatePicker, Popconfirm, Tag, Empty, App
} from 'antd';
import {
  CheckCircleOutlined, CheckSquareOutlined, EditOutlined, StarOutlined,
  OrderedListOutlined, SmileOutlined, TableOutlined, MenuOutlined,
  DeleteOutlined, PlusOutlined, SaveOutlined, SendOutlined, ArrowLeftOutlined,
  BranchOutlined, MinusCircleOutlined
} from '@ant-design/icons';
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '../api';
import dayjs from 'dayjs';
import PublishModal from '../components/PublishModal.jsx';

const { TextArea } = Input;
const { Option } = Select;

const QUESTION_TYPES = [
  { type: 'single', label: '单选题', icon: <CheckCircleOutlined /> },
  { type: 'multi', label: '多选题', icon: <CheckSquareOutlined /> },
  { type: 'text', label: '文本题', icon: <EditOutlined /> },
  { type: 'rating', label: '评分题', icon: <StarOutlined /> },
  { type: 'nps', label: 'NPS评分', icon: <SmileOutlined /> },
  { type: 'matrix', label: '矩阵题', icon: <TableOutlined /> },
  { type: 'sort', label: '排序题', icon: <OrderedListOutlined /> }
];

function generateQId() {
  return 'q' + Date.now() + Math.random().toString(36).substring(2, 6);
}

function createQuestion(type) {
  const base = {
    id: generateQId(),
    type,
    title: '',
    required: true,
    branching: null
  };
  switch (type) {
    case 'single':
    case 'multi':
      return { ...base, title: `新${type === 'single' ? '单选' : '多选'}题`, options: ['选项1', '选项2'] };
    case 'text':
      return { ...base, title: '新填空题', placeholder: '请输入...' };
    case 'rating':
      return { ...base, title: '新评分题', maxStars: 5 };
    case 'nps':
      return { ...base, title: '新NPS评分题' };
    case 'matrix':
      return { ...base, title: '新矩阵题', rows: ['行1', '行2'], cols: ['列1', '列2', '列3'] };
    case 'sort':
      return { ...base, title: '新排序题', options: ['选项1', '选项2', '选项3'] };
    default:
      return base;
  }
}

function SortableQuestion({ question, index, isActive, onSelect, onDelete }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`question-item ${isActive ? 'active' : ''} ${isDragging ? 'dragging' : ''}`}
      onClick={() => onSelect(question.id)}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span className="drag-handle" {...attributes} {...listeners}><MenuOutlined /></span>
          <Tag color="blue">Q{index + 1}</Tag>
          <Tag>{QUESTION_TYPES.find(t => t.type === question.type)?.label}</Tag>
          {question.required && <Tag color="red">必填</Tag>}
          {question.branching && <Tag color="purple" icon={<BranchOutlined />}>分支</Tag>}
        </div>
        <Button type="text" danger icon={<DeleteOutlined />} onClick={(e) => { e.stopPropagation(); onDelete(question.id); }} />
      </div>
      <div style={{ fontSize: 14, color: '#333', lineHeight: 1.6, paddingLeft: 28 }}>
        {question.title || <span style={{ color: '#ccc' }}>请输入题目标题</span>}
      </div>
    </div>
  );
}

export default function Editor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [title, setTitle] = useState('新建问卷');
  const [description, setDescription] = useState('');
  const [questions, setQuestions] = useState([]);
  const [activeQ, setActiveQ] = useState(null);
  const [activeId, setActiveId] = useState(null);
  const [displayMode, setDisplayMode] = useState('all');
  const [publishVisible, setPublishVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [surveyId, setSurveyId] = useState(id || null);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  useEffect(() => {
    if (id) {
      loadSurvey();
    }
  }, [id]);

  const loadSurvey = async () => {
    try {
      const res = await api.getSurvey(id);
      setTitle(res.data.title);
      setDescription(res.data.description || '');
      setQuestions(res.data.questions || []);
      setDisplayMode(res.data.display_mode || 'all');
    } catch (e) {
      message.error('加载失败');
    }
  };

  const handleAddType = (type) => {
    const newQ = createQuestion(type);
    setQuestions([...questions, newQ]);
    setActiveQ(newQ.id);
  };

  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    setActiveId(null);
    if (over && active.id !== over.id) {
      const oldIndex = questions.findIndex(q => q.id === active.id);
      const newIndex = questions.findIndex(q => q.id === over.id);
      setQuestions(arrayMove(questions, oldIndex, newIndex));
    }
  };

  const handleDeleteQ = (qId) => {
    setQuestions(questions.filter(q => q.id !== qId));
    if (activeQ === qId) setActiveQ(null);
  };

  const updateQuestion = (qId, updates) => {
    setQuestions(questions.map(q => q.id === qId ? { ...q, ...updates } : q));
  };

  const addOption = (qId, field) => {
    const q = questions.find(x => x.id === qId);
    if (!q) return;
    const newArr = [...(q[field] || []), field === 'rows' ? `新行${q.rows.length + 1}` : field === 'cols' ? `新列${q.cols.length + 1}` : `选项${(q[field] || []).length + 1}`];
    updateQuestion(qId, { [field]: newArr });
  };

  const updateOption = (qId, field, idx, value) => {
    const q = questions.find(x => x.id === qId);
    if (!q) return;
    const newArr = [...q[field]];
    newArr[idx] = value;
    updateQuestion(qId, { [field]: newArr });
  };

  const removeOption = (qId, field, idx) => {
    const q = questions.find(x => x.id === qId);
    if (!q) return;
    const newArr = q[field].filter((_, i) => i !== idx);
    updateQuestion(qId, { [field]: newArr });
  };

  const handleSave = async (showMsg = true) => {
    if (!title.trim()) {
      message.warning('请输入问卷标题');
      return;
    }
    if (questions.length === 0) {
      message.warning('请至少添加一道题目');
      return;
    }
    for (let i = 0; i < questions.length; i++) {
      if (!questions[i].title.trim()) {
        message.warning(`第${i + 1}题标题不能为空`);
        return;
      }
    }
    setSaving(true);
    try {
      const data = { title, description, questions, display_mode: displayMode };
      if (surveyId) {
        await api.updateSurvey(surveyId, data);
      } else {
        const res = await api.createSurvey(data);
        setSurveyId(res.data.id);
        window.history.replaceState(null, '', `/editor/${res.data.id}`);
      }
      if (showMsg) message.success('保存成功');
    } catch (e) {
      message.error(e.response?.data?.error || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handlePublish = async () => {
    await handleSave(false);
    if (surveyId) setPublishVisible(true);
  };

  const activeQuestion = questions.find(q => q.id === activeQ);
  const activeIndex = questions.findIndex(q => q.id === activeQ);

  const renderPropsPanel = () => {
    if (!activeQuestion) {
      return <Empty description="请选择题目进行编辑" />;
    }
    const q = activeQuestion;
    return (
      <div>
        <div style={{ fontWeight: 'bold', marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid #f0f0f0' }}>
          题目属性
        </div>
        <Form layout="vertical">
          <Form.Item label="题目标题">
            <TextArea rows={2} value={q.title} onChange={(e) => updateQuestion(q.id, { title: e.target.value })} placeholder="请输入题目标题" />
          </Form.Item>
          <Form.Item label="是否必填">
            <Switch checked={q.required} onChange={(v) => updateQuestion(q.id, { required: v })} />
          </Form.Item>

          {(q.type === 'single' || q.type === 'multi' || q.type === 'sort') && (
            <Form.Item label="选项">
              {q.options.map((opt, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <Input value={opt} onChange={(e) => updateOption(q.id, 'options', i, e.target.value)} placeholder={`选项${i + 1}`} />
                  <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => removeOption(q.id, 'options', i)} disabled={q.options.length <= 2} />
                </div>
              ))}
              <Button type="dashed" block icon={<PlusOutlined />} onClick={() => addOption(q.id, 'options')}>添加选项</Button>
            </Form.Item>
          )}

          {q.type === 'text' && (
            <Form.Item label="占位符">
              <Input value={q.placeholder || ''} onChange={(e) => updateQuestion(q.id, { placeholder: e.target.value })} />
            </Form.Item>
          )}

          {q.type === 'rating' && (
            <Form.Item label="最大星数">
              <InputNumber min={3} max={10} value={q.maxStars} onChange={(v) => updateQuestion(q.id, { maxStars: v })} />
            </Form.Item>
          )}

          {q.type === 'matrix' && (
            <>
              <Form.Item label="行标题">
                {q.rows.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <Input value={r} onChange={(e) => updateOption(q.id, 'rows', i, e.target.value)} placeholder={`行${i + 1}`} />
                    <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => removeOption(q.id, 'rows', i)} disabled={q.rows.length <= 2} />
                  </div>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />} onClick={() => addOption(q.id, 'rows')}>添加行</Button>
              </Form.Item>
              <Form.Item label="列标题">
                {q.cols.map((c, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <Input value={c} onChange={(e) => updateOption(q.id, 'cols', i, e.target.value)} placeholder={`列${i + 1}`} />
                    <Button type="text" danger icon={<MinusCircleOutlined />} onClick={() => removeOption(q.id, 'cols', i)} disabled={q.cols.length <= 2} />
                  </div>
                ))}
                <Button type="dashed" block icon={<PlusOutlined />}>添加列</Button>
              </Form.Item>
            </>
          )}

          {q.type === 'single' && activeIndex < questions.length - 1 && (
            <Form.Item label={<span><BranchOutlined /> 分支逻辑（根据答案跳转）</span>}>
              {q.options.map((opt, i) => {
                const branchKey = `${q.id}_option_${i}`;
                return (
                  <div key={i} style={{ marginBottom: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <span style={{ minWidth: 80, fontSize: 12, color: '#666' }}>选"{opt}"跳至:</span>
                      <Select
                        style={{ flex: 1 }}
                        allowClear
                        placeholder="不设置"
                        value={q.branching?.[branchKey]}
                        onChange={(v) => {
                          const newBranching = { ...(q.branching || {}) };
                          if (v) newBranching[branchKey] = v; else delete newBranching[branchKey];
                          updateQuestion(q.id, { branching: Object.keys(newBranching).length ? newBranching : null });
                        }}
                      >
                        {questions.slice(activeIndex + 1).map((nq, ni) => (
                          <Option key={nq.id} value={nq.id}>第{activeIndex + 2 + ni}题: {nq.title.substring(0, 20)}</Option>
                        ))}
                      </Select>
                    </div>
                  </div>
                );
              })}
            </Form.Item>
          )}
        </Form>
      </div>
    );
  };

  const activeQuestionObj = activeId ? questions.find(q => q.id === activeId) : null;

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <Space style={{ marginBottom: 16 }}>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/surveys')}>返回</Button>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} style={{ width: 300 }} placeholder="问卷标题" />
          <Select value={displayMode} onChange={setDisplayMode} style={{ width: 140 }}>
            <Option value="all">全部展示</Option>
            <Option value="single">一题一页</Option>
          </Select>
        </Space>
        <TextArea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="问卷描述（选填）" style={{ marginBottom: 16 }} />
        <Space style={{ justifyContent: 'flex-end', display: 'flex' }}>
          <Button icon={<SaveOutlined />} loading={saving} onClick={() => handleSave()}>保存</Button>
          <Button type="primary" icon={<SendOutlined />} loading={saving} onClick={handlePublish}>发布问卷</Button>
        </Space>
      </Card>

      <div className="editor-layout">
        <div className="editor-sidebar">
          <div style={{ fontWeight: 'bold', marginBottom: 12 }}>题目类型</div>
          {QUESTION_TYPES.map(qt => (
            <div key={qt.type} className="question-type-item" onClick={() => handleAddType(qt.type)}>
              {qt.icon}<span>{qt.label}</span>
            </div>
          ))}
        </div>

        <div className="editor-main">
          {description && <div style={{ padding: '0 16px 16px', color: '#666', fontSize: 14 }}>{description}</div>}
          {questions.length === 0 ? (
            <Empty description="点击左侧题目类型添加题目" style={{ marginTop: 80 }} />
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
              <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
                {questions.map((q, i) => (
                  <SortableQuestion
                    key={q.id}
                    question={q}
                    index={i}
                    isActive={activeQ === q.id}
                    onSelect={setActiveQ}
                    onDelete={handleDeleteQ}
                  />
                ))}
              </SortableContext>
              <DragOverlay>
                {activeQuestionObj ? (
                  <div className="question-item active">
                    <div style={{ paddingLeft: 28 }}>{activeQuestionObj.title}</div>
                  </div>
                ) : null}
              </DragOverlay>
            </DndContext>
          )}
        </div>

        <div className="editor-props">
          {renderPropsPanel()}
        </div>
      </div>

      {publishVisible && surveyId && (
        <PublishModal
          visible={publishVisible}
          surveyId={surveyId}
          onClose={() => { setPublishVisible(false); loadSurvey(); }}
        />
      )}
    </div>
  );
}
