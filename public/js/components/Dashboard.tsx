import React, { useEffect, useState } from 'react';
import { Layout, Menu, Card, Row, Col, Statistic, Tag, Table, Button, Modal, Form, Input, Select, Upload, message, Progress } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import axios from 'axios';

const { Header, Content, Footer } = Layout;
const { Option } = Select;

const API_BASE = '/api/v1';

const Dashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [stats, setStats] = useState<any>({});
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [prospects, setProspects] = useState<any[]>([]);
  const [bulkJobs, setBulkJobs] = useState<any[]>([]);

  useEffect(() => {
    loadDashboardData();
    loadCampaigns();
    loadProspects();
    loadBulkImportJobs();

    const ws = new WebSocket(`ws://${window.location.host}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'campaign_progress') {
        loadCampaigns();
      }
      if (data.type === 'prospect_update') {
        loadProspects();
      }
      if (data.type === 'bulk_job_update') {
        loadBulkImportJobs();
      }
      loadDashboardData();
    };

    return () => {
      ws.close();
    };
  }, []);

  const loadDashboardData = async () => {
    const statusResponse = await axios.get(`${API_BASE}/status`);
    const prospectsResponse = await axios.get(`${API_BASE}/prospects/stats/overview`);
    const campaignsResponse = await axios.get(`${API_BASE}/campaigns`);
    setStats({
      status: statusResponse.data.data,
      prospectStats: prospectsResponse.data.data,
      campaigns: campaignsResponse.data.data.campaigns,
    });
  };

  const loadCampaigns = async () => {
    const response = await axios.get(`${API_BASE}/campaigns`);
    setCampaigns(response.data.data.campaigns);
  };

  const loadProspects = async () => {
    const response = await axios.get(`${API_BASE}/prospects`);
    setProspects(response.data.data.prospects);
  };

  const loadBulkImportJobs = async () => {
    const response = await axios.get(`${API_BASE}/bulk/jobs`);
    setBulkJobs(response.data.data.jobs);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardContent stats={stats} />;
      case 'campaigns':
        return <CampaignsContent campaigns={campaigns} refresh={loadCampaigns} />;
      case 'prospects':
        return <ProspectsContent prospects={prospects} refresh={loadProspects} />;
      case 'bulk':
        return <BulkImportContent jobs={bulkJobs} refresh={loadBulkImportJobs} />;
      default:
        return null;
    }
  };

  return (
    <Layout className="layout">
      <Header>
        <div className="logo" />
        <Menu theme="dark" mode="horizontal" defaultSelectedKeys={['dashboard']} onSelect={(e) => setActiveTab(e.key)}>
          <Menu.Item key="dashboard">Dashboard</Menu.Item>
          <Menu.Item key="campaigns">Campaigns</Menu.Item>
          <Menu.Item key="prospects">Prospects</Menu.Item>
          <Menu.Item key="bulk">Bulk Import</Menu.Item>
        </Menu>
      </Header>
      <Content style={{ padding: '0 50px' }}>
        <div className="site-layout-content" style={{ background: '#fff', padding: 24, minHeight: 280 }}>{renderContent()}</div>
      </Content>
      <Footer style={{ textAlign: 'center' }}>Missive Email Generator ©2025</Footer>
    </Layout>
  );
};

const DashboardContent: React.FC<{ stats: any }> = ({ stats }) => (
  <>
    <Row gutter={16}>
      <Col span={6}><Card><Statistic title="Total Prospects" value={stats.prospectStats?.total || 0} /></Card></Col>
      <Col span={6}><Card><Statistic title="Active Campaigns" value={stats.campaigns?.filter((c: any) => c.status === 'active').length || 0} /></Card></Col>
      <Col span={6}><Card><Statistic title="Emails Generated" value={stats.status?.generation?.completed || 0} /></Card></Col>
      <Col span={6}><Card><Statistic title="Drafts Created" value={stats.status?.drafts?.draftsCreated || 0} /></Card></Col>
    </Row>
  </>
);

const CampaignsContent: React.FC<{ campaigns: any[], refresh: () => void }> = ({ campaigns, refresh }) => {
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isProgressModalVisible, setIsProgressModalVisible] = useState(false);
  const [isProspectsModalVisible, setIsProspectsModalVisible] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<any>(null);

  const getStatusColor = (status: string) => {
    const colors: { [key: string]: string } = {
      pending: 'gold',
      active: 'green',
      paused: 'orange',
      completed: 'blue',
      failed: 'red',
    };
    return colors[status] || 'default';
  };

  const handleAction = async (action: string, campaignId: string) => {
    try {
      await axios.post(`${API_BASE}/campaigns/${campaignId}/${action}`);
      message.success(`Campaign ${action}ed successfully`);
      refresh();
    } catch (error) {
      message.error(`Failed to ${action} campaign`);
    }
  };

  const showProgress = async (campaign: any) => {
    try {
      const response = await axios.get(`${API_BASE}/campaigns/${campaign._id}/progress`);
      setSelectedCampaign({ ...campaign, progress: response.data.data });
      setIsProgressModalVisible(true);
    } catch (error) {
      message.error('Failed to get campaign progress');
    }
  };

  const showCampaignProspects = async (campaign: any) => {
    try {
      const response = await axios.get(`${API_BASE}/campaigns/${campaign._id}/prospects`);
      setSelectedCampaign({ ...campaign, prospects: response.data.data.prospects });
      setIsProspectsModalVisible(true);
    } catch (error) {
      message.error('Failed to get campaign prospects');
    }
  };

  const columns = [
    { title: 'Name', dataIndex: 'name', key: 'name' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status: string) => <Tag color={getStatusColor(status)}>{status}</Tag> },
    { title: 'Email Style', dataIndex: 'emailStyle', key: 'emailStyle' },
    { title: 'USPs', dataIndex: 'usps', key: 'usps', render: (usps: any) => usps?.length || 0 },
    { title: 'Created', dataIndex: 'createdAt', key: 'createdAt', render: (date: string) => new Date(date).toLocaleDateString() },
    {
      title: 'Actions',
      key: 'actions',
      render: (text: any, record: any) => (
        <>
          <Button onClick={() => handleAction('start', record._id)} style={{ marginRight: 8 }}>Start</Button>
          <Button onClick={() => handleAction('pause', record._id)} style={{ marginRight: 8 }}>Pause</Button>
          <Button onClick={() => showProgress(record)} style={{ marginRight: 8 }}>Progress</Button>
          <Button onClick={() => showCampaignProspects(record)}>Prospects</Button>
        </>
      ),
    },
  ];
  return (
    <>
      <Button onClick={() => setIsCreateModalVisible(true)} type="primary" style={{ marginBottom: 16 }}>
        Create Campaign
      </Button>
      <Table dataSource={campaigns} columns={columns} rowKey="_id" />
      <CreateCampaignModal
        visible={isCreateModalVisible}
        onCancel={() => setIsCreateModalVisible(false)}
        onSuccess={() => {
          setIsCreateModalVisible(false);
          refresh();
        }}
      />
      <Modal
        title="Campaign Progress"
        visible={isProgressModalVisible}
        onCancel={() => setIsProgressModalVisible(false)}
        footer={null}
      >
        {selectedCampaign && selectedCampaign.progress && (
          <div>
            <p>Percentage: {selectedCampaign.progress.progress.percentage}%</p>
            <Progress percent={selectedCampaign.progress.progress.percentage} />
            <p>Completed: {selectedCampaign.progress.progress.completed}</p>
            <p>Failed: {selectedCampaign.progress.progress.failed}</p>
            <p>Queued: {selectedCampaign.progress.progress.queued}</p>
          </div>
        )}
      </Modal>
      <Modal
        title="Campaign Prospects"
        visible={isProspectsModalVisible}
        onCancel={() => setIsProspectsModalVisible(false)}
        footer={null}
      >
        {selectedCampaign && selectedCampaign.prospects && (
          <ul>
            {selectedCampaign.prospects.map((prospect: any) => (
              <li key={prospect._id}>{prospect.website}</li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
};

const ProspectsContent: React.FC<{ prospects: any[], refresh: () => void }> = ({ prospects, refresh }) => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [isAssignModalVisible, setIsAssignModalVisible] = useState(false);
  const [isCreateModalVisible, setIsCreateModalVisible] = useState(false);
  const [isIndividualAssignModalVisible, setIsIndividualAssignModalVisible] = useState(false);
  const [selectedProspect, setSelectedProspect] = useState<any>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    const response = await axios.get(`${API_BASE}/campaigns`);
    setCampaigns(response.data.data.campaigns);
  };

  const handleAction = async (action: string, prospectId: string) => {
    try {
      if (action === 'delete') {
        await axios.delete(`${API_BASE}/prospects/${prospectId}`);
        message.success('Prospect deleted successfully');
      } else {
        await axios.post(`${API_BASE}/prospects/${prospectId}/${action}`);
        message.success(`Prospect ${action}ed successfully`);
      }
      refresh();
    } catch (error) {
      message.error(`Failed to ${action} prospect`);
    }
  };

  const onSelectChange = (newSelectedRowKeys: React.Key[]) => {
    setSelectedRowKeys(newSelectedRowKeys);
  };

  const rowSelection = {
    selectedRowKeys,
    onChange: onSelectChange,
  };

  const handleBulkAssign = async () => {
    if (!selectedCampaign) {
      message.error('Please select a campaign');
      return;
    }
    try {
      await axios.post(`${API_BASE}/prospects/bulk/assign-campaign`, {
        prospectIds: selectedRowKeys,
        campaignId: selectedCampaign,
      });
      message.success('Prospects assigned successfully');
      setSelectedRowKeys([]);
      setIsAssignModalVisible(false);
      refresh();
    } catch (error) {
      message.error('Failed to assign prospects');
    }
  };

  const showAssignProspectModal = (prospect: any) => {
    setSelectedProspect(prospect);
    setIsIndividualAssignModalVisible(true);
  };

  const handleIndividualAssign = async (campaignId: string) => {
    try {
      await axios.post(`${API_BASE}/prospects/${selectedProspect._id}/assign-campaign`, { campaignId });
      message.success('Prospect assigned successfully');
      setIsIndividualAssignModalVisible(false);
      refresh();
    } catch (error) {
      message.error('Failed to assign prospect');
    }
  };

  const columns = [
    { title: 'Website', dataIndex: 'website', key: 'website', render: (url: string) => <a href={url} target="_blank" rel="noopener noreferrer">{url}</a> },
    { title: 'Contact', dataIndex: 'contactEmail', key: 'contactEmail' },
    { title: 'Company', dataIndex: 'companyName', key: 'companyName' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status: string) => <Tag>{status}</Tag> },
    {
      title: 'Actions',
      key: 'actions',
      render: (text: any, record: any) => (
        <>
          <Button onClick={() => handleAction('scrape', record._id)} style={{ marginRight: 8 }}>Scrape</Button>
          <Button onClick={() => showAssignProspectModal(record)} style={{ marginRight: 8 }}>Assign</Button>
          <Button onClick={() => handleAction('delete', record._id)} danger>Delete</Button>
        </>
      ),
    },
  ];

  return (
    <>
      <Button onClick={() => setIsCreateModalVisible(true)} type="primary" style={{ marginBottom: 16, marginRight: 8 }}>
        Add Prospect
      </Button>
      <Button onClick={() => setIsAssignModalVisible(true)} disabled={selectedRowKeys.length === 0} style={{ marginBottom: 16 }}>
        Bulk Assign to Campaign
      </Button>
      <Table rowSelection={rowSelection} dataSource={prospects} columns={columns} rowKey="_id" />
      <Modal
        title="Assign to Campaign"
        visible={isAssignModalVisible}
        onOk={handleBulkAssign}
        onCancel={() => setIsAssignModalVisible(false)}
      >
        <Select style={{ width: '100%' }} onChange={(value) => setSelectedCampaign(value)} placeholder="Select a campaign">
          {campaigns.map((campaign) => (
            <Option key={campaign._id} value={campaign._id}>{campaign.name}</Option>
          ))}
        </Select>
      </Modal>
      <AssignProspectModal
        visible={isIndividualAssignModalVisible}
        onCancel={() => setIsIndividualAssignModalVisible(false)}
        onSuccess={handleIndividualAssign}
        campaigns={campaigns}
      />
      <CreateProspectModal
        visible={isCreateModalVisible}
        onCancel={() => setIsCreateModalVisible(false)}
        onSuccess={() => {
          setIsCreateModalVisible(false);
          refresh();
        }}
      />
    </>
  );
};

const BulkImportContent: React.FC<{ jobs: any[], refresh: () => void }> = ({ jobs, refresh }) => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    const response = await axios.get(`${API_BASE}/campaigns`);
    setCampaigns(response.data.data.campaigns);
  };

  const handleUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    const formData = new FormData();
    formData.append('file', file);
    if (selectedCampaign) {
      formData.append('campaignId', selectedCampaign);
    }

    try {
      await axios.post(`${API_BASE}/bulk/import`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      onSuccess();
      message.success('File uploaded successfully');
      refresh();
    } catch (error) {
      onError(error);
      message.error('File upload failed');
    }
  };

  const columns = [
    { title: 'Filename', dataIndex: 'filename', key: 'filename' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status: string) => <Tag>{status}</Tag> },
    { title: 'Processed', dataIndex: 'processedProspects', key: 'processedProspects' },
    { title: 'Total', dataIndex: 'totalProspects', key: 'totalProspects' },
  ];

  return (
    <>
      <Form layout="inline" style={{ marginBottom: 16 }}>
        <Form.Item label="Campaign">
          <Select style={{ width: 200 }} onChange={(value) => setSelectedCampaign(value)} placeholder="Select a campaign (optional)">
            {campaigns.map((campaign) => (
              <Option key={campaign._id} value={campaign._id}>{campaign.name}</Option>
            ))}
          </Select>
        </Form.Item>
        <Form.Item>
          <Upload customRequest={handleUpload} showUploadList={false}>
            <Button icon={<UploadOutlined />}>Upload CSV</Button>
          </Upload>
        </Form.Item>
        <Form.Item>
          <a href="/api/v1/bulk/template" download>
            <Button>Download Template</Button>
          </a>
        </Form.Item>
      </Form>
      <Table dataSource={jobs} columns={columns} rowKey="_id" />
    </>
  );
};

const CreateCampaignModal: React.FC<{ visible: boolean, onCancel: () => void, onSuccess: () => void }> = ({ visible, onCancel, onSuccess }) => {
  const [form] = Form.useForm();

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await axios.post(`${API_BASE}/campaigns`, values);
      message.success('Campaign created successfully');
      onSuccess();
      form.resetFields();
    } catch (error) {
      message.error('Failed to create campaign');
    }
  };

  return (
    <Modal
      title="Create Campaign"
      visible={visible}
      onOk={handleCreate}
      onCancel={onCancel}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="name" label="Campaign Name" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="marketingDocument" label="Marketing Document" rules={[{ required: true }]}>
          <Input.TextArea rows={4} />
        </Form.Item>
        <Form.Item name="missiveAccountId" label="Missive Account ID" rules={[{ required: true }]}>
          <Input />
        </Form.Item>
        <Form.Item name="tone" label="Tone" initialValue="professional">
          <Select>
            <Option value="professional">Professional</Option>
            <Option value="casual">Casual</Option>
            <Option value="friendly">Friendly</Option>
            <Option value="formal">Formal</Option>
          </Select>
        </Form.Item>
        <Form.Item name="emailStyle" label="Email Style" initialValue="statement">
          <Select>
            <Option value="statement">Statement-Based</Option>
            <Option value="question">Question-Based</Option>
          </Select>
        </Form.Item>
      </Form>
    </Modal>
  );
};

const CreateProspectModal: React.FC<{ visible: boolean, onCancel: () => void, onSuccess: () => void }> = ({ visible, onCancel, onSuccess }) => {
  const [form] = Form.useForm();

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      await axios.post(`${API_BASE}/prospects`, values);
      message.success('Prospect created successfully');
      onSuccess();
      form.resetFields();
    } catch (error) {
      message.error('Failed to create prospect');
    }
  };

  return (
    <Modal
      title="Add Prospect"
      visible={visible}
      onOk={handleCreate}
      onCancel={onCancel}
    >
      <Form form={form} layout="vertical">
        <Form.Item name="website" label="Website" rules={[{ required: true, type: 'url' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="contactEmail" label="Contact Email" rules={[{ required: true, type: 'email' }]}>
          <Input />
        </Form.Item>
        <Form.Item name="contactName" label="Contact Name">
          <Input />
        </Form.Item>
        <Form.Item name="companyName" label="Company Name">
          <Input />
        </Form.Item>
        <Form.Item name="industry" label="Industry">
          <Input />
        </Form.Item>
      </Form>
    </Modal>
  );
};

const AssignProspectModal: React.FC<{ visible: boolean, onCancel: () => void, onSuccess: (campaignId: string) => void, campaigns: any[] }> = ({ visible, onCancel, onSuccess, campaigns }) => {
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  return (
    <Modal
      title="Assign Prospect to Campaign"
      visible={visible}
      onOk={() => onSuccess(selectedCampaign!)}
      onCancel={onCancel}
      okButtonProps={{ disabled: !selectedCampaign }}
    >
      <Select style={{ width: '100%' }} onChange={(value) => setSelectedCampaign(value)} placeholder="Select a campaign">
        {campaigns.map((campaign) => (
          <Option key={campaign._id} value={campaign._id}>{campaign.name}</Option>
        ))}
      </Select>
    </Modal>
  );
};

export default Dashboard;
