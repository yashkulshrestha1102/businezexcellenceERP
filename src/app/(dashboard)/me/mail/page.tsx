'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { fmtDate } from '@/lib/utils/date';
import { getMyMails, sendMail, deleteMail, getCompanySettings } from '@/lib/actions/mails';
import { useAuth } from '@/lib/hooks/useAuth';

interface Mail {
  id: string;
  from_user: string | null;
  from_name: string | null;
  to_email: string;
  subject: string;
  body: string;
  sent_at: string;
}

export default function MyMailPage() {
  const { profile } = useAuth();
  const [mails, setMails] = useState<Mail[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewMail, setViewMail] = useState<Mail | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyMails();
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
      toast.success('Delete');
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Mail Admin</h1>
          <p>Admin ko mail bhejo — leave, asset, kuch bhi</p>
        </div>
        <button
          className="btn btn-sm"
          style={{ width: 'auto' }}
          onClick={() => setShowForm(true)}
        >
          ✉ Compose
        </button>
      </div>

      <div className="notice notice-info">
        ⚡ <b>Open in Gmail</b> dabao → Gmail khulega pre-filled, wahan edit karke send karo.
      </div>

      <div className="panel">
        <div className="panel-head">
          <h3>📤 My Sent</h3>
          <div className="sub">{mails.length}</div>
        </div>
        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? (
            <div className="empty">Loading...</div>
          ) : mails.length === 0 ? (
            <div className="empty">
              <div className="big">📭</div>
              Abhi koi mail nahi bheja
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>To</th>
                    <th>Subject</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mails.map((m) => (
                    <tr key={m.id}>
                      <td>{m.to_email}</td>
                      <td><b>{m.subject}</b></td>
                      <td>{fmtDate(m.sent_at?.slice(0, 10))}</td>
                      <td>
                        <div className="act-btns">
                          <button className="icon-btn" onClick={() => setViewMail(m)}>
                            👁
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
          adminEmail={profile?.email ? undefined : undefined}
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
  adminEmail?: string;
  onClose: () => void;
  onSent: () => void;
}) {
  const { profile } = useAuth();
  const [form, setForm] = useState({
    to_email: '',
    subject: '',
    body: '',
  });
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getCompanySettings()
      .then((s) => {
        setForm((f) => ({
          ...f,
          to_email: s.admin_email || 'admin@rosterpro.com',
          body: `Respected Admin,\n\nMai ${profile?.name} (${profile?.designation || ''}, ${profile?.dept || ''}) se apni baat likhna chahta hoon.\n\n[Yahan apni baat likho]\n\nDhanyavaad,\n${profile?.name}\n${profile?.phone || ''}`,
        }));
      })
      .catch(() => {
        setForm((f) => ({ ...f, to_email: 'admin@rosterpro.com' }));
      });
  }, [profile]);

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
        toast.success('Gmail khul gaya');
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
          <h3>Compose Mail to Admin</h3>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>To</label>
            <input
              value={form.to_email}
              onChange={(e) => setForm({ ...form, to_email: e.target.value })}
            />
          </div>
          <div className="field">
            <label>Subject *</label>
            <input
              value={form.subject}
              onChange={(e) => setForm({ ...form, subject: e.target.value })}
              placeholder="Leave Application..."
            />
          </div>
          <div className="field">
            <label>Body *</label>
            <textarea
              rows={9}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
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
                navigator.clipboard.writeText(form.body);
                toast.success('Copy ho gayi');
              }}
            >
              📋 Copy
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