import { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, InputNumber, message } from 'antd';
import { createCandidate } from '../api/candidate';
import { getCandidates } from '../api/candidate';

interface CandidateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  positionId?: number;
}

export default function CandidateModal({ open, onClose, onSuccess, positionId }: CandidateModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [existingCandidates, setExistingCandidates] = useState<any[]>([]);
  const [mode, setMode] = useState<'new' | 'existing'>('new');

  useEffect(() => {
    if (open) {
      form.resetFields();
      setMode('new');
      getCandidates().then((res: any) => {
        setExistingCandidates(res.data || res || []);
      });
    }
  }, [open, form]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      await createCandidate(values);
      message.success('候选人添加成功');
      form.resetFields();
      onSuccess?.();
      onClose();
    } catch (err: any) {
      if (err.errorFields) return;
      message.error(err.message || '添加失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      title="添加候选人"
      open={open}
      onOk={handleSubmit}
      onCancel={onClose}
      confirmLoading={loading}
      width={560}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
          <Input placeholder="请输入候选人姓名" />
        </Form.Item>
        <Form.Item name="phone" label="手机号">
          <Input placeholder="请输入手机号" />
        </Form.Item>
        <Form.Item name="email" label="邮箱">
          <Input placeholder="请输入邮箱" />
        </Form.Item>
        <Form.Item name="source" label="来源">
          <Select placeholder="请选择来源" allowClear>
            <Select.Option value="referral">内推</Select.Option>
            <Select.Option value="website">官网投递</Select.Option>
            <Select.Option value="headhunter">猎头</Select.Option>
            <Select.Option value="social">社交媒体</Select.Option>
            <Select.Option value="other">其他</Select.Option>
          </Select>
        </Form.Item>
        <Form.Item name="yearsOfExperience" label="工作年限">
          <InputNumber min={0} max={50} placeholder="工作年限" style={{ width: '100%' }} />
        </Form.Item>
        <Form.Item name="currentCompany" label="当前公司">
          <Input placeholder="请输入当前公司" />
        </Form.Item>
        <Form.Item name="skills" label="技能标签">
          <Input placeholder="多个技能用逗号分隔，如：React,TypeScript,Node.js" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
