'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { TableSkeleton } from '@/components/ui/Skeleton';

import {
  getAllAssets,
  createAsset,
  updateAsset,
  deleteAsset,
  getAssetStats,
} from '@/lib/actions/assets';
import { getEmployees } from '@/lib/actions/employees';
import type { Profile } from '@/types/database';

interface AssetRow {
  id: string;
  name: string;
  type: string;
  serial: string | null;
  assigned_to: string | null;
  status: 'Available' | 'Assigned' | 'Maintenance' | 'Retired';
  assigned_at: string | null;
  notes: string | null;
  assigned_employee: { id: string; name: string; username: string } | null;
}

const TYPES = ['Laptop', 'Phone', 'Tablet', 'Monitor', 'Accessory', 'Furniture', 'Other'];

export default function AssetsPage() {
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [stats, setStats] = useState({ total: 0, assigned: 0, available: 0, maintenance: 0 });
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Profile[]>([]);
  const [modal, setModal] = useState<{ open: boolean; asset: AssetRow | null }>({
    open: false,
    asset: null,
  });
  const [confirmDelete, setConfirmDelete] = useState<AssetRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, s] = await Promise.all([getAllAssets(), getAssetStats()]);
      setAssets(a as unknown as AssetRow[]);
      setStats(s);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    getEmployees().then((d) => setEmployees(d as Profile[])).catch(() => {});
  }, [load]);

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await deleteAsset(confirmDelete.id);
      toast.success('Asset delete');
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
          <h1>Assets</h1>
          <p>Company ke assets track karo — assign/unassign</p>
        </div>
        <button
          className="btn btn-sm"
          style={{ width: 'auto' }}
          onClick={() => setModal({ open: true, asset: null })}
        >
          ＋ Add Asset
        </button>
      </div>

      <div className="stats">
        <div className="stat">
          <div className="lbl">Total</div>
          <div className="val">{stats.total}</div>
        </div>
        <div className="stat">
          <div className="lbl">Assigned</div>
          <div className="val" style={{ color: 'var(--teal-600)' }}>{stats.assigned}</div>
        </div>
        <div className="stat">
          <div className="lbl">Available</div>
          <div className="val" style={{ color: 'var(--ok)' }}>{stats.available}</div>
        </div>
        <div className="stat">
          <div className="lbl">Maintenance</div>
          <div className="val" style={{ color: 'var(--warn)' }}>{stats.maintenance}</div>
        </div>
      </div>

      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? (
  <TableSkeleton rows={5} />
) : assets.length === 0 ? (            <div className="empty">
              <div className="big">💻</div>
              Koi asset nahi — Add Asset dabao
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Type</th>
                    <th>Serial</th>
                    <th>Assigned To</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.id}>
                      <td><b>{a.name}</b></td>
                      <td><span className="tag tag-gray">{a.type}</span></td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12.5 }}>
                        {a.serial || '—'}
                      </td>
                      <td>
                        {a.assigned_employee ? (
                          <b>{a.assigned_employee.name}</b>
                        ) : (
                          <span style={{ color: 'var(--muted)' }}>—</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`tag ${
                            a.status === 'Assigned'
                              ? 'tag-teal'
                              : a.status === 'Available'
                              ? 'tag-green'
                              : a.status === 'Maintenance'
                              ? 'tag-amber'
                              : 'tag-gray'
                          }`}
                        >
                          {a.status}
                        </span>
                      </td>
                      <td>
                        <div className="act-btns">
                          <button
                            className="icon-btn"
                            onClick={() => setModal({ open: true, asset: a })}
                          >
                            ✎ Edit
                          </button>
                          <button
                            className="icon-btn del"
                            onClick={() => setConfirmDelete(a)}
                          >
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

      {modal.open && (
        <AssetModal
          asset={modal.asset}
          employees={employees}
          onClose={() => setModal({ open: false, asset: null })}
          onSaved={() => {
            setModal({ open: false, asset: null });
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
              <button className="x" onClick={() => setConfirmDelete(null)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ color: '#475569', lineHeight: 1.7 }}>
                Ye asset permanently delete ho jayega. Undo nahi hoga.
              </p>
            </div>
            <div className="modal-foot">
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => setConfirmDelete(null)}
              >
                Cancel
              </button>
              <button className="btn btn-sm btn-danger" onClick={handleDelete}>
                Yes, delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AssetModal({
  asset,
  employees,
  onClose,
  onSaved,
}: {
  asset: AssetRow | null;
  employees: Profile[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!asset;
  const [form, setForm] = useState({
    name: asset?.name || '',
    type: asset?.type || 'Laptop',
    serial: asset?.serial || '',
    assigned_to: asset?.assigned_to || '',
    notes: asset?.notes || '',
  });
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!form.name.trim()) return toast.error('Asset name daal');
    setSaving(true);
    try {
      if (isEdit && asset) {
        await updateAsset(asset.id, {
          name: form.name,
          type: form.type,
          serial: form.serial,
          assigned_to: form.assigned_to || null,
          notes: form.notes,
        });
        toast.success('Asset update');
      } else {
        await createAsset({
          name: form.name,
          type: form.type,
          serial: form.serial,
          assigned_to: form.assigned_to || null,
          notes: form.notes,
        });
        toast.success('Asset add');
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
          <h3>{isEdit ? 'Edit Asset' : 'Add Asset'}</h3>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="field">
            <label>Asset Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Dell Latitude 5440"
            />
          </div>
          <div className="grid2">
            <div className="field">
              <label>Type</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
              >
                {TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Serial / Tag</label>
              <input
                value={form.serial}
                onChange={(e) => setForm({ ...form, serial: e.target.value })}
                placeholder="DL5440-001"
              />
            </div>
          </div>
          <div className="field">
            <label>Assign To</label>
            <select
              value={form.assigned_to}
              onChange={(e) => setForm({ ...form, assigned_to: e.target.value })}
            >
              <option value="">— Not assigned —</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.username})
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
            />
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn btn-sm btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}