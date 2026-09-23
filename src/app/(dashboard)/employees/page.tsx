'use client';

import { useState, useEffect, useMemo } from 'react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/hooks/useAuth';
import { initials, fmtDate } from '@/lib/utils/date';
import { TableSkeleton } from '@/components/ui/Skeleton';
import {
  getEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from '@/lib/actions/employees';
import type { Profile } from '@/types/database';

export default function EmployeesPage() {
  const { profile: me } = useAuth();
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Profile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Profile | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await getEmployees();
      setEmployees(data as Profile[]);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter((e) =>
      `${e.name} ${e.dept || ''} ${e.designation || ''} ${e.username}`
        .toLowerCase()
        .includes(q)
    );
  }, [employees, search]);

  function openAdd() {
    setEditing(null);
    setModalOpen(true);
  }

  function openEdit(emp: Profile) {
    setEditing(emp);
    setModalOpen(true);
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteEmployee(confirmDelete.id);
      toast.success('Employee delete ho gaya');
      setConfirmDelete(null);
      load();
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Employees</h1>
          <p>Add, edit, delete — login credentials yahin set hote hain</p>
        </div>
        <button
          className="btn btn-sm"
          style={{ width: 'auto' }}
          onClick={openAdd}
        >
          ＋ Add Employee
        </button>
      </div>

      <div className="panel">
        <div className="panel-head">
          <div className="searchbar">
            <input
              placeholder="🔍 Search name, dept, role..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="sub">
            {filtered.length} of {employees.length}
          </div>
        </div>

        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? (
  <TableSkeleton rows={5} />
) : filtered.length === 0 ? (
            <div className="empty">
              <div className="big">👥</div>
              {employees.length === 0
                ? 'Koi employee nahi — Add Employee dabao'
                : 'Koi match nahi mila'}
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Dept</th>
                    <th>Role</th>
                    <th>Contact</th>
                    <th>Login</th>
                    <th>Joined</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                          <div
                            className="avatar"
                            style={{ width: 30, height: 30, fontSize: 11 }}
                          >
                            {initials(e.name)}
                          </div>
                          <b>{e.name}</b>
                        </div>
                      </td>
                      <td>{e.dept || '—'}</td>
                      <td>{e.designation || '—'}</td>
                      <td>
                        <div style={{ fontSize: 12.5 }}>{e.phone || '—'}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--muted)' }}>
                          {e.email}
                        </div>
                      </td>
                      <td>
                        <span className="tag tag-teal">{e.username}</span>
                      </td>
                      <td>{fmtDate(e.join_date)}</td>
                      <td>
                        <div className="act-btns">
                          <button
                            className="icon-btn"
                            onClick={() => openEdit(e)}
                          >
                            ✎ Edit
                          </button>
                          {e.id !== me?.id && (
                            <button
                              className="icon-btn del"
                              onClick={() => setConfirmDelete(e)}
                            >
                              🗑 Del
                            </button>
                          )}
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

      {modalOpen && (
        <EmployeeModal
          employee={editing}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          onSaved={() => {
            setModalOpen(false);
            setEditing(null);
            load();
          }}
        />
      )}

      {confirmDelete && (
        <div className="modal-bg" onClick={() => setConfirmDelete(null)}>
          <div
            className="modal"
            style={{ maxWidth: 420 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-head">
              <h3>⚠️ Delete {confirmDelete.name}?</h3>
              <button className="x" onClick={() => setConfirmDelete(null)}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#475569', lineHeight: 1.7 }}>
                Iska login, attendance, leave, aur asset assignment bhi hat
                jayega. Ye undo nahi hoga.
              </p>
            </div>
            <div className="modal-foot">
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-sm btn-danger"
                onClick={handleDelete}
              >
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   Employee Modal — Add/Edit
   ============================================================ */
function EmployeeModal({
  employee,
  onClose,
  onSaved,
}: {
  employee: Profile | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!employee;
  const [form, setForm] = useState({
    name: employee?.name || '',
    username: employee?.username || '',
    password: '',
    email: employee?.email || '',
    phone: employee?.phone || '',
    dept: employee?.dept || '',
    designation: employee?.designation || '',
    salary: employee?.salary?.toString() || '',
    join_date: employee?.join_date || new Date().toISOString().slice(0, 10),
    role: (employee?.role || 'employee') as 'admin' | 'employee',
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Name daal');
    if (!form.username.trim()) return toast.error('Username daal');
    if (!form.email.trim()) return toast.error('Email daal');
    if (!isEdit && !form.password.trim())
      return toast.error('Password daal');
    if (form.password && form.password.length < 6)
      return toast.error('Password kam se kam 6 characters');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
      return toast.error('Email format galat hai');

    setSaving(true);
    try {
      if (isEdit && employee) {
        await updateEmployee(employee.id, {
          name: form.name,
          username: form.username,
          email: form.email,
          phone: form.phone,
          dept: form.dept,
          designation: form.designation,
          salary: Number(form.salary) || 0,
          join_date: form.join_date,
          role: form.role,
          password: form.password || undefined,
        });
        toast.success('Employee update ho gaya');
      } else {
        await createEmployee({
          name: form.name,
          username: form.username,
          email: form.email,
          phone: form.phone,
          dept: form.dept,
          designation: form.designation,
          salary: Number(form.salary) || 0,
          join_date: form.join_date,
          role: form.role,
          password: form.password,
        });
        toast.success('Naya employee add ho gaya');
      }
      onSaved();
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3>{isEdit ? 'Edit Employee' : 'Add Employee'}</h3>
          <button className="x" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="field">
            <label>Full Name *</label>
            <input
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Rahul Sharma"
            />
          </div>

          <div className="grid2">
            <div className="field">
              <label>Department</label>
              <input
                value={form.dept}
                onChange={(e) => set('dept', e.target.value)}
                placeholder="Engineering"
              />
            </div>
            <div className="field">
              <label>Designation</label>
              <input
                value={form.designation}
                onChange={(e) => set('designation', e.target.value)}
                placeholder="Developer"
              />
            </div>
          </div>

          <div className="grid2">
            <div className="field">
              <label>Joining Date</label>
              <input
                type="date"
                value={form.join_date}
                onChange={(e) => set('join_date', e.target.value)}
              />
            </div>
            <div className="field">
              <label>Salary (₹)</label>
              <input
                type="number"
                value={form.salary}
                onChange={(e) => set('salary', e.target.value)}
                placeholder="50000"
              />
            </div>
          </div>

          <div className="grid2">
            <div className="field">
              <label>Phone</label>
              <input
                value={form.phone}
                onChange={(e) => set('phone', e.target.value)}
                placeholder="98765 43210"
              />
            </div>
            <div className="field">
              <label>Role</label>
              <select
                value={form.role}
                onChange={(e) =>
                  set('role', e.target.value as 'admin' | 'employee')
                }
              >
                <option value="employee">Employee</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          <div className="field">
            <label>Email *</label>
            <input
              type="email"
              value={form.email}
              onChange={(e) => set('email', e.target.value)}
              placeholder="rahul@company.com"
            />
          </div>

          <div className="grid2">
            <div className="field">
              <label>Username *</label>
              <input
                value={form.username}
                onChange={(e) => set('username', e.target.value)}
                placeholder="rahul"
              />
            </div>
            <div className="field">
              <label>{isEdit ? 'New Password (optional)' : 'Password *'}</label>
              <input
                type="text"
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder={isEdit ? 'leave blank to keep' : 'pass123'}
              />
            </div>
          </div>
        </div>

        <div className="modal-foot">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-sm"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}