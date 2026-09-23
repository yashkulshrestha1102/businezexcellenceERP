'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { fmtDate } from '@/lib/utils/date';
import { getAllMails, sendMail, deleteMail, getCompanySettings } from '@/lib/actions/mails';
import { getEmployees } from '@/lib/actions/employees';
import { TableSkeleton } from '@/components/ui/Skeleton';


interface Mail {
  id: string;
  from_user: string | null;
  from_name: string | null;
  to_email: string;
  subject: string;
  body: string;
  sent_at: string;
}

export default function MailPage() {
  const [mails, setMails] = useState<Mail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewMail, setViewMail] = useState<Mail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllMails();
      setMails(data as Mail[]);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(id: string) {
    try {
      await deleteMail(id);
      toast.success('Mail delete');
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Mail</h1>
          <p>Employees se communication — Gmail compose ke saath</p>
        </div>
        <button
          className="btn btn-sm"
          style={{ width: 'auto' }}
          onClick={() => setShowForm(true)}
        >
          ✉ Compose Mail
        </button>
      </div>

      <div className="notice notice-info">
        ⚡ <b>Open in Gmail</b> dabao → Gmail khulega pre-filled, wahan edit karke send karo.
        Ya <b>Copy</b> karke kahin bhi paste karo.
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>📤 Sent History</h3>
          <div className="sub">{mails.length} total</div>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? (
  <TableSkeleton rows={5} />
) : mails.length === 0 ? (
            <div className="empty">
              <div className="big">📭</div>
              Abhi tak koi mail nahi
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th>Subject</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mails.map((m) => (
                    <tr key={m.id}>
                      <td>{m.from_name || '—'}</td>
                      <td>{m.to_email}</td>
                      <td>
                        <b>{m.subject}</b>
                      </td>
                      <td>{fmtDate(m.sent_at?.slice(0, 10))}</td>
                      <td>
                        <div className="act-btns">
                          <button className="icon-btn" onClick={() => setViewMail(m)}>
                            👁 View
                          </button>
                          <button className="icon-btn del" onClick={() => handleDelete(m.id)}>
                            🗑
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <ComposeModal
          onClose={() => setShowForm(false)}
          onSent={() => {
            setShowForm(false);
            load();
          }}
        />
      )}

      {viewMail && (
        <ViewMailModal mail={viewMail} onClose={() => setViewMail(null)} />
      )}
    </div>
  );
}

function ComposeModal({
  onClose,
  onSent,
}: {
  onClose: () => void;
  onSent: () => void;
}) {
  const [form, setForm] = useState({ to_email: '', subject: '', body: '' });
  const [sending, setSending] = useState(false);
  const [employees, setEmployees] = useState<{ email: string; name: string }[]>([]);

  useEffect(() => {
    getEmployees().then((d) => setEmployees(d as { email: string; name: string }[])).catch(() => {});
  }, []);

  async function handleSend(openGmail: boolean) {
    if (!form.to_email || !form.subject || !form.body) {
      return toast.error('Sab fields bharo');
    }
    setSending(true);
    try {
      await sendMail(form);
      if (openGmail) {
        const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(form.to_email)}&su=${encodeURIComponent(form.subject)}&body=${encodeURIComponent(form.body)}`;
        window.open(url, '_blank');
        toast.success('Gmail khul gaya — wahan send karo');
      } else {
        toast.success('Mail log ho gaya');
      }
      onSent();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Compose Mail</h3>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>To *</label>
            <input
              list="emp-emails"
              value={form.to_email}
              onChange={(e) => setForm({ ...form, to_email: e.target.value })}
              placeholder="someone@company.com"
            />
            <datalist id="emp-emails">
              {employees.map((e) => (
                <option key={e.email} value={e.email}>
                  {e.name}
                </option>
              ))}
            </datalist>
          </div>
          <div className="field">
            <label>Subject *</label>
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Leave application..."
            />
          </div>
          <div className="field">
            <label>Body *</label>
            <textarea
              rows={8}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
              placeholder="Likho..."
            />
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' }}>
            <button
              className="btn btn-sm"
              onClick={() => handleSend(true)}
              disabled={sending}
            >
              📧 Open in Gmail
            </button>
            <button
              className="btn btn-sm btn-ghost"
              onClick={() => {
                if (!form.body) return toast.error('Body khali hai');
                navigator.clipboard.writeText(form.body);
                toast.success('Body copy ho gayi');
              }}
            >
              📋 Copy body
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ViewMailModal({ mail, onClose }: { mail: Mail; onClose: () => void }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>Mail — {mail.subject}</h3>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>From</label>
            <input value={mail.from_name || '—'} readOnly />
          </div>
          <div className="field">
            <label>To</label>
            <input value={mail.to_email} readOnly />
          </div>
          <div className="field">
            <label>Subject</label>
            <input value={mail.subject} readOnly />
          </div>
          <div className="field">
            <label>Body</label>
            <div className="mail-preview">{mail.body}</div>
          </div>
        </div>
      </div>
    </div>
  );
}