import { useEffect, useMemo, useState } from 'react';
import useAuth from '../../hooks/useAuth.js';
import useExpenses from '../../hooks/useExpenses.js';
import useToast from '../../hooks/useToast.js';
import Card from '../ui/Card.jsx';
import Button from '../ui/Button.jsx';
import Input from '../ui/Input.jsx';
import { getEmailStatus, sendDebtNudgeEmail, sendTestEmail, testEmailConfiguration } from '../../services/email.service.js';

export default function EmailActions() {
  const { user } = useAuth();
  const { friends, groups } = useExpenses();
  const toast = useToast();

  const [status, setStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [testingConfig, setTestingConfig] = useState(false);
  const [sendingTestEmail, setSendingTestEmail] = useState(false);
  const [sendingNudge, setSendingNudge] = useState(false);
  const [form, setForm] = useState({
    toUserId: '',
    groupId: '',
    amount: '',
    message: '',
    testEmail: user?.email || '',
  });

  const friendOptions = useMemo(() => friends?.friends || [], [friends]);

  useEffect(() => {
    let active = true;

    const loadStatus = async () => {
      try {
        setLoadingStatus(true);
        const data = await getEmailStatus();
        if (active) {
          setStatus(data?.status || data || null);
        }
      } catch (error) {
        toast.error(error?.response?.data?.message || error.message || 'Failed to load email status');
      } finally {
        if (active) {
          setLoadingStatus(false);
        }
      }
    };

    loadStatus();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (user?.email) {
      setForm((current) => ({ ...current, testEmail: user.email }));
    }
  }, [user?.email]);

  const handleFieldChange = (field) => (event) => {
    setForm((current) => ({ ...current, [field]: event.target.value }));
  };

  const handleTestConfig = async () => {
    try {
      setTestingConfig(true);
      const result = await testEmailConfiguration();
      toast.success(result?.message || 'Email configuration looks good');
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || 'Failed to test email configuration');
    } finally {
      setTestingConfig(false);
    }
  };

  const handleSendTestEmail = async (event) => {
    event.preventDefault();

    if (!form.testEmail.trim()) {
      toast.error('Recipient email is required');
      return;
    }

    try {
      setSendingTestEmail(true);
      const result = await sendTestEmail({ to: form.testEmail.trim() });
      toast.success(result?.message || 'Test email sent');
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || 'Failed to send test email');
    } finally {
      setSendingTestEmail(false);
    }
  };

  const handleSendNudge = async (event) => {
    event.preventDefault();

    if (!form.toUserId || !form.groupId || !form.amount) {
      toast.error('Choose a recipient, group, and amount');
      return;
    }

    try {
      setSendingNudge(true);
      const result = await sendDebtNudgeEmail({
        toUserId: form.toUserId,
        groupId: form.groupId,
        amount: Number(form.amount),
        message: form.message,
      });
      toast.success(result?.message || 'Nudge email sent');
      setForm((current) => ({ ...current, amount: '', message: '' }));
    } catch (error) {
      toast.error(error?.response?.data?.message || error.message || 'Failed to send nudge email');
    } finally {
      setSendingNudge(false);
    }
  };

  return (
    <Card title="Email Tools" subtitle="Check mail status, send a test message, or nudge a friend">
      <div className="stack-md">
        <div className="pill-row" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <span className="badge badge-violet">
            {loadingStatus ? 'Checking email…' : status?.enabled ? 'Email enabled' : 'Email not configured'}
          </span>
          {status?.service && <span className="badge badge-green">{status.service}</span>}
        </div>

        <div className="flex items-center gap-sm" style={{ flexWrap: 'wrap' }}>
          <Button variant="secondary" onClick={handleTestConfig} disabled={testingConfig}>
            {testingConfig ? 'Testing…' : 'Test config'}
          </Button>
        </div>

        <form className="stack-md" onSubmit={handleSendTestEmail}>
          <Input label="Send test email to" id="test-email" value={form.testEmail} onChange={handleFieldChange('testEmail')} required />
          <Button type="submit" variant="primary" disabled={sendingTestEmail}>
            {sendingTestEmail ? 'Sending…' : 'Send test email'}
          </Button>
        </form>

        <form className="stack-md" onSubmit={handleSendNudge}>
          <label className="input-block" htmlFor="nudge-recipient">
            <span className="input-label">Nudge recipient <span style={{ color: 'var(--danger)' }}>*</span></span>
            <select
              id="nudge-recipient"
              className="input"
              value={form.toUserId}
              onChange={handleFieldChange('toUserId')}
            >
              <option value="">Select a friend</option>
              {friendOptions.map((friend) => (
                <option key={friend.id} value={friend.id}>
                  {friend.name} {friend.email ? `(${friend.email})` : ''}
                </option>
              ))}
            </select>
          </label>

          <label className="input-block" htmlFor="nudge-group">
            <span className="input-label">Group <span style={{ color: 'var(--danger)' }}>*</span></span>
            <select id="nudge-group" className="input" value={form.groupId} onChange={handleFieldChange('groupId')}>
              <option value="">Select a group</option>
              {groups.map((group) => (
                <option key={group._id} value={group._id}>
                  {group.name}
                </option>
              ))}
            </select>
          </label>

          <Input label="Amount" id="nudge-amount" type="number" min="1" step="0.01" value={form.amount} onChange={handleFieldChange('amount')} required />
          <Input label="Message" id="nudge-message" multiline value={form.message} onChange={handleFieldChange('message')} />
          <Button type="submit" variant="primary" disabled={sendingNudge}>
            {sendingNudge ? 'Sending…' : 'Send nudge'}
          </Button>
        </form>
      </div>
    </Card>
  );
}