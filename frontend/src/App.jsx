import React from 'react';
import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { Layout, Menu, Badge, Button, Space } from 'antd';
import { FileTextOutlined, FormOutlined, AppstoreOutlined, BellOutlined, DeleteOutlined, BarChartOutlined } from '@ant-design/icons';
import Home from './pages/Home.jsx';
import SurveyList from './pages/SurveyList.jsx';
import Editor from './pages/Editor.jsx';
import FillSurvey from './pages/FillSurvey.jsx';
import Analysis from './pages/Analysis.jsx';
import Templates from './pages/Templates.jsx';
import ResponseDetail from './pages/ResponseDetail.jsx';
import Notifications from './pages/Notifications.jsx';
import RecycleBin from './pages/RecycleBin.jsx';
import Result from './pages/Result.jsx';
import { NotificationBadge } from './pages/Notifications.jsx';

const { Header, Content } = Layout;

function App() {
  const navigate = useNavigate();

  const menuItems = [
    { key: '/', icon: <FileTextOutlined />, label: '首页' },
    { key: '/surveys', icon: <FormOutlined />, label: '我的问卷' },
    { key: '/templates', icon: <AppstoreOutlined />, label: '模板中心' },
    { key: '/recycle-bin', icon: <DeleteOutlined />, label: '回收站' }
  ];

  return (
    <Layout className="app-layout">
      <Header className="app-header">
        <div className="app-logo" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>
          <FormOutlined />
          在线问卷调查系统
        </div>
        <Space style={{ flex: 1, justifyContent: 'space-between', minWidth: 0 }}>
          <Menu
            mode="horizontal"
            selectedKeys={[window.location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            style={{ minWidth: 520, borderBottom: 'none' }}
          />
          <NotificationBadge onClick={() => navigate('/notifications')} />
        </Space>
      </Header>
      <Content className="app-content">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/surveys" element={<SurveyList />} />
          <Route path="/editor/:id?" element={<Editor />} />
          <Route path="/fill/:code" element={<FillSurvey />} />
          <Route path="/analysis/:id" element={<Analysis />} />
          <Route path="/result/:id" element={<Result />} />
          <Route path="/templates" element={<Templates />} />
          <Route path="/response/:id" element={<ResponseDetail />} />
          <Route path="/notifications" element={<Notifications />} />
          <Route path="/recycle-bin" element={<RecycleBin />} />
        </Routes>
      </Content>
    </Layout>
  );
}

export default App;
