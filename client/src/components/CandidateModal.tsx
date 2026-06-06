import { useEffect, useState } from 'react';
import { Modal, Form, Input, Select, Row, Col, Upload, message } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { createCandidate } from '../api/candidate';
import { addCandidateToPosition } from '../api/position';
import { useUserStore } from '../stores/user';

interface CandidateModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  positionId?: number;
}

export default function CandidateModal({ open, onClose, onSuccess, positionId }: CandidateModalProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const user = useUserStore((s) => s.user);

  useEffect(() => {
    if (open) {
      form.resetFields();
      form.setFieldsValue({
        recommender: user?.name || user?.username || '',
      });
    }
  }, [open, form, user]);

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);
      // 创建候选人
      const candRes: any = await createCandidate(values);
      const candidate = candRes.data || candRes;
      // 如果有岗位ID，自动关联到岗位
      if (positionId && candidate.id) {
        await addCandidateToPosition(positionId, {
          candidateId: candidate.id,
          recommender: values.recommender,
          recommendReason: values.recommendReason,
        });
      }
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
      width={780}
      destroyOnClose
    >
      <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="name" label="姓名" rules={[{ required: true, message: '请输入姓名' }]}>
              <Input placeholder="请输入姓名" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="gender" label="性别">
              <Select placeholder="请选择" allowClear>
                <Select.Option value="男">男</Select.Option>
                <Select.Option value="女">女</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="idType" label="证件类型">
              <Select placeholder="请选择" allowClear>
                <Select.Option value="身份证">身份证</Select.Option>
                <Select.Option value="港澳通行证">港澳通行证</Select.Option>
                <Select.Option value="护照">护照</Select.Option>
                <Select.Option value="其他">其他</Select.Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="idNumber" label="证件号码">
              <Input placeholder="请输入证件号码" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="areaCode" label="区号">
              <Input placeholder="如 +86" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="contactPhone" label="联系电话">
              <Input placeholder="请输入联系电话" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="contactEmail" label="联系邮箱">
              <Input placeholder="请输入联系邮箱" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="supplier" label="供应商">
              <Input placeholder="请输入供应商" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="educationType" label="学历类型">
              <Select placeholder="请选择" allowClear>
                <Select.Option value="统招">统招</Select.Option>
                <Select.Option value="自考">自考</Select.Option>
                <Select.Option value="成考">成考</Select.Option>
                <Select.Option value="网教">网教</Select.Option>
                <Select.Option value="其他">其他</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="education" label="学历">
              <Select placeholder="请选择" allowClear>
                <Select.Option value="大专">大专</Select.Option>
                <Select.Option value="本科">本科</Select.Option>
                <Select.Option value="硕士">硕士</Select.Option>
                <Select.Option value="博士">博士</Select.Option>
                <Select.Option value="其他">其他</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="graduationDate" label="毕业时间">
              <Input type="date" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="domainYears" label="领域年限">
              <Input placeholder="请输入领域年限" type="number" min={0} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="workStatus" label="工作状态">
              <Select placeholder="请选择" allowClear>
                <Select.Option value="在职">在职</Select.Option>
                <Select.Option value="离职">离职</Select.Option>
                <Select.Option value="待业">待业</Select.Option>
                <Select.Option value="应届">应届</Select.Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="expectedSalary" label="期望薪资">
              <Input placeholder="如 15K-20K" />
            </Form.Item>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="recommender" label="推荐人">
              <Input placeholder="自动填充" readOnly />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="resumeUrl" label="简历附件">
              <Input placeholder="简历链接或上传后自动填充" />
            </Form.Item>
          </Col>
        </Row>
        <Form.Item name="recommendReason" label="推荐理由">
          <Input.TextArea rows={2} placeholder="请输入推荐理由（选填）" />
        </Form.Item>
      </Form>
    </Modal>
  );
}
