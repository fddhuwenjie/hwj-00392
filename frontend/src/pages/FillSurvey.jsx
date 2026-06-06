import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card, Button, Progress, Radio, Checkbox, Input, InputNumber,
  Modal, message, Empty, Result, Form, App
} from 'antd';
import {
  LeftOutlined, RightOutlined, CheckOutlined, ReloadOutlined
} from '@ant-design/icons';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  DragOverlay
} from '@dnd-kit/core';
import {
  arrayMove, SortableContext, verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import api from '../api';

const { TextArea } = Input;
const { Group: RadioGroup } = Radio;
const { Group: CheckboxGroup } = Checkbox;

function SortableOption({ option, index, onValueChange }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: option });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1
  };
  return (
    <div ref={setNodeRef} style={style} className={`sort-option ${isDragging ? 'dragging' : ''}`}>
      <div className="sort-rank">{index + 1}</div>
      <span {...attributes} {...listeners} style={{ cursor: 'move', flex: 1 }}>{option}</span>
    </div>
  );
}

function QuestionRenderer({ question, value, onChange, error }) {
  const sensors = useSensors(useSensor(PointerSensor));

  if (question.type === 'single') {
    return (
      <RadioGroup value={value} onChange={(e) => onChange(e.target.value)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {question.options.map(opt => (
          <Radio key={opt} value={opt} style={{ display: 'flex', alignItems: 'center', height: 40 }}>{opt}</Radio>
        ))}
      </RadioGroup>
    );
  }

  if (question.type === 'multi') {
    return (
      <CheckboxGroup value={value || []} onChange={(v) => onChange(v)} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {question.options.map(opt => (
          <Checkbox key={opt} value={opt} style={{ display: 'flex', alignItems: 'center', height: 40 }}>{opt}</Checkbox>
        ))}
      </CheckboxGroup>
    );
  }

  if (question.type === 'text') {
    return (
      <TextArea
        rows={4}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        placeholder={question.placeholder || '请输入...'}
        style={{ maxWidth: 600 }}
      />
    );
  }

  if (question.type === 'rating') {
    const max = question.maxStars || 5;
    return (
      <div>
        {Array.from({ length: max }).map((_, i) => (
          <span
            key={i}
            className={`rating-star ${value >= i + 1 ? 'active' : ''}`}
            onClick={() => onChange(value === i + 1 ? null : i + 1)}
          >★</span>
        ))}
        {value && <span style={{ marginLeft: 12, color: '#666' }}>{value} 分</span>}
      </div>
    );
  }

  if (question.type === 'nps') {
    return (
      <div>
        <div className="nps-scale">
          {Array.from({ length: 11 }).map((_, i) => {
            let cls = '';
            if (i >= 9) cls = 'promoter';
            else if (i >= 7) cls = 'passive';
            else cls = 'detractor';
            return (
              <div
                key={i}
                className={`nps-item ${cls} ${value === i ? 'active' : ''}`}
                onClick={() => onChange(value === i ? null : i)}
              >{i}</div>
            );
          })}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#999', marginTop: 8, maxWidth: 560 }}>
          <span>完全不可能推荐</span>
          <span>非常可能推荐</span>
        </div>
      </div>
    );
  }

  if (question.type === 'matrix') {
    return (
      <div style={{ overflowX: 'auto' }}>
        <table className="matrix-table">
          <thead>
            <tr>
              <th style={{ minWidth: 160 }}></th>
              {question.cols.map(col => <th key={col}>{col}</th>)}
            </tr>
          </thead>
          <tbody>
            {question.rows.map(row => (
              <tr key={row}>
                <td style={{ textAlign: 'left' }}>{row}</td>
                {question.cols.map(col => (
                  <td key={col}>
                    <Radio
                      checked={value?.[row] === col}
                      onChange={() => onChange({ ...(value || {}), [row]: col })}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  if (question.type === 'sort') {
    const opts = value && Array.isArray(value) && value.length === question.options.length ? value : question.options;
    return (
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(e) => {
          const { active, over } = e;
          if (over && active.id !== over.id) {
            const oldIdx = opts.indexOf(active.id);
            const newIdx = opts.indexOf(over.id);
            const newArr = arrayMove(opts, oldIdx, newIdx);
            onChange(newArr);
          }
        }}
      >
        <SortableContext items={opts} strategy={verticalListSortingStrategy}>
          <div style={{ maxWidth: 400 }}>
            {opts.map((opt, i) => (
              <SortableOption key={opt} option={opt} index={i} />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    );
  }

  return null;
}

export default function FillSurvey() {
  const { code } = useParams();
  const navigate = useNavigate();
  const [survey, setSurvey] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [passwordForm] = Form.useForm();
  const [needPassword, setNeedPassword] = useState(false);
  const [finished, setFinished] = useState(false);
  const [errorState, setErrorState] = useState(null);
  const { message } = App.useApp();

  useEffect(() => {
    loadSurvey();
  }, [code]);

  const loadSurvey = async () => {
    try {
      setLoading(true);
      const res = await api.getSurveyByShortCode(code);
      const s = res.data;

      if (s.status !== 'published') {
        setErrorState('问卷未发布');
        return;
      }
      if (s.is_paused) {
        setErrorState('问卷已暂停收集');
        return;
      }
      const now = new Date();
      if (s.start_time && new Date(s.start_time) > now) {
        setErrorState('问卷尚未开始');
        return;
      }
      if (s.end_time && new Date(s.end_time) < now) {
        setErrorState('问卷已结束');
        return;
      }
      if (s.password) {
        setNeedPassword(true);
      }
      setSurvey(s);
    } catch (e) {
      setErrorState(e.response?.data?.error || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const verifyPassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      const res = await api.verifyPassword(survey.id, values.password);
      if (res.data.valid) {
        setNeedPassword(false);
      } else {
        message.error('密码错误');
      }
    } catch (e) { }
  };

  const isValueEmpty = (q, v) => {
    if (v === undefined || v === null || v === '') return true;
    if (Array.isArray(v)) return v.length === 0;
    if (typeof v === 'object') {
      return Object.keys(v).length < (q.rows ? q.rows.length : 0);
    }
    return false;
  };

  const getVisibleQuestions = useMemo(() => {
    if (!survey) return [];
    const result = [];
    let i = 0;
    while (i < survey.questions.length) {
      const q = survey.questions[i];
      result.push(q);
      let nextIdx = i + 1;
      if (q.branching) {
        const optionIdx = q.options?.indexOf(answers[q.id]);
        if (optionIdx >= 0) {
          const jumpTo = q.branching[`${q.id}_option_${optionIdx}`];
          if (jumpTo) {
            nextIdx = survey.questions.findIndex(x => x.id === jumpTo);
            if (nextIdx < 0) nextIdx = i + 1;
          }
        }
      }
      i = nextIdx;
    }
    return result;
  }, [survey, answers]);

  const progress = useMemo(() => {
    const visible = getVisibleQuestions;
    if (visible.length === 0) return 0;
    let answered = 0;
    visible.forEach(q => { if (!isValueEmpty(q, answers[q.id])) answered++; });
    return Math.round((answered / visible.length) * 100);
  }, [getVisibleQuestions, answers]);

  const validateCurrent = () => {
    const newErrors = {};
    if (survey.display_mode === 'single') {
      const q = getVisibleQuestions[currentIndex];
      if (q && q.required && isValueEmpty(q, answers[q.id])) {
        newErrors[q.id] = true;
      }
    } else {
      getVisibleQuestions.forEach(q => {
        if (q.required && isValueEmpty(q, answers[q.id])) {
          newErrors[q.id] = true;
        }
      });
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (!validateCurrent()) {
      message.warning('请完成必填项');
      return;
    }
    if (survey.display_mode === 'single') {
      if (currentIndex < getVisibleQuestions.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setShowConfirm(true);
      }
    } else {
      setShowConfirm(true);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleSubmit = async () => {
    if (!validateCurrent()) {
      message.warning('请完成所有必填项');
      return;
    }
    setSubmitting(true);
    try {
      await api.submitResponse({
        survey_id: survey.id,
        answers,
        respondent_info: { device: navigator.userAgent.substring(0, 100) }
      });
      setFinished(true);
    } catch (e) {
      message.error(e.response?.data?.error || '提交失败');
    } finally {
      setSubmitting(false);
      setShowConfirm(false);
    }
  };

  if (loading) return <div style={{ textAlign: 'center', padding: 80 }}>加载中...</div>;

  if (errorState) {
    return (
      <div className="fill-page">
        <Result status="warning" title={errorState} />
      </div>
    );
  }

  if (needPassword) {
    return (
      <div className="fill-page">
        <Card className="fill-survey-card" style={{ maxWidth: 400, margin: '80px auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <h2>{survey?.title}</h2>
            <p style={{ color: '#999' }}>该问卷需要访问密码</p>
          </div>
          <Form form={passwordForm} onFinish={verifyPassword}>
            <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password size="large" placeholder="请输入访问密码" />
            </Form.Item>
            <Button type="primary" size="large" block htmlType="submit">进入问卷</Button>
          </Form>
        </Card>
      </div>
    );
  }

  if (finished) {
    return (
      <div className="fill-page">
        <Card className="fill-survey-card">
          <Result
            status="success"
            title="提交成功！"
            subTitle="感谢您的参与，您的反馈对我们非常重要。"
            extra={[
              <Button type="primary" icon={<ReloadOutlined />} onClick={() => {
                setAnswers({});
                setCurrentIndex(0);
                setFinished(false);
                setErrors({});
              }}>再填一份</Button>,
              <Button onClick={() => navigate('/')}>返回首页</Button>
            ]}
          />
        </Card>
      </div>
    );
  }

  const displayQuestions = survey.display_mode === 'single'
    ? [getVisibleQuestions[currentIndex]].filter(Boolean)
    : getVisibleQuestions;

  return (
    <div className="fill-page">
      <Card className="fill-survey-card">
        <div style={{ marginBottom: 24 }}>
          <h1 style={{ fontSize: 22, marginBottom: 8 }}>{survey.title}</h1>
          {survey.description && <p style={{ color: '#666' }}>{survey.description}</p>}
        </div>

        <div style={{ marginBottom: 24 }}>
          <div className="progress-bar">
            <div className="progress-bar-inner" style={{ width: `${progress}%` }}></div>
          </div>
          <div className="progress-text">完成度 {progress}%</div>
        </div>

        {displayQuestions.map((q, idx) => {
          const actualIdx = getVisibleQuestions.indexOf(q);
          return (
            <div key={q.id} className={`question-container ${q.required ? 'required' : ''} ${errors[q.id] ? 'error' : ''}`}>
              {survey.display_mode === 'all' && (
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
                  第 {actualIdx + 1} / {getVisibleQuestions.length} 题
                </div>
              )}
              {survey.display_mode === 'single' && (
                <div style={{ fontSize: 12, color: '#999', marginBottom: 4 }}>
                  第 {currentIndex + 1} / {getVisibleQuestions.length} 题
                </div>
              )}
              <div className="question-title">{q.title}</div>
              <QuestionRenderer
                question={q}
                value={answers[q.id]}
                onChange={(v) => {
                  setAnswers({ ...answers, [q.id]: v });
                  if (errors[q.id]) setErrors({ ...errors, [q.id]: false });
                }}
                error={errors[q.id]}
              />
            </div>
          );
        })}

        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 32 }}>
          {survey.display_mode === 'single' && currentIndex > 0 ? (
            <Button icon={<LeftOutlined />} onClick={handlePrev}>上一题</Button>
          ) : <div />}
          <Button
            type="primary"
            onClick={handleNext}
            icon={survey.display_mode === 'single' && currentIndex < getVisibleQuestions.length - 1 ? <RightOutlined /> : <CheckOutlined />}
          >
            {survey.display_mode === 'single' && currentIndex < getVisibleQuestions.length - 1 ? '下一题' : '提交问卷'}
          </Button>
        </div>
      </Card>

      <Modal
        title="确认提交"
        open={showConfirm}
        onCancel={() => setShowConfirm(false)}
        onOk={handleSubmit}
        confirmLoading={submitting}
        okText="确认提交"
        cancelText="返回修改"
        width={600}
      >
        <div style={{ maxHeight: 400, overflowY: 'auto' }}>
          {getVisibleQuestions.map(q => (
            <div key={q.id} className="confirm-item">
              <div className="confirm-label">{q.title}</div>
              <div className="confirm-value">
                {answers[q.id] === undefined || answers[q.id] === null || answers[q.id] === ''
                  ? <span style={{ color: '#999' }}>未填写</span>
                  : Array.isArray(answers[q.id])
                    ? answers[q.id].join('、')
                    : typeof answers[q.id] === 'object'
                      ? Object.entries(answers[q.id]).map(([k, v]) => `${k}: ${v}`).join('；')
                      : q.type === 'rating' ? `${answers[q.id]} 星`
                        : q.type === 'nps' ? `${answers[q.id]} 分`
                          : String(answers[q.id])
                }
              </div>
            </div>
          ))}
        </div>
      </Modal>
    </div>
  );
}
