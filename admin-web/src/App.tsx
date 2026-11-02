import { ConfigProvider, Layout, Menu, Typography, Card, Alert, Space, Tag } from 'antd'
import zhCN from 'antd/locale/zh_CN'
const { Header, Sider, Content } = Layout
export default function App() {
  return <ConfigProvider locale={zhCN} theme={{ token: { colorPrimary: '#39845b' } }}>
    <Layout style={{ minHeight: '100vh' }}>
      <Sider theme="light"><Typography.Title level={4} style={{ padding: 20 }}>腿了个腿</Typography.Title>
        <Menu selectedKeys={['overview']} items={[{ key: 'overview', label: '项目概览' }]} />
      </Sider>
      <Layout><Header style={{ background: '#fff' }}>运营管理后台</Header><Content style={{ padding: 24 }}>
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          <Alert type="info" title="项目初始化完成" description="当前为工程骨架，尚未接入登录、业务数据及微信平台。" showIcon />
          <Card title="腿了个腿"><Typography.Paragraph>数眼睛、凑腿数，七格之内挑战过关。</Typography.Paragraph>
          <Tag color="green">React + Ant Design + TypeScript</Tag><Tag>Java DDD + MySQL</Tag></Card>
        </Space>
      </Content></Layout>
    </Layout>
  </ConfigProvider>
}
