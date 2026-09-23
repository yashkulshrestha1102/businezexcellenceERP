'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { fmtDate } from '@/lib/utils/date';
import { getMyAssets } from '@/lib/actions/assets';
import { TableSkeleton } from '@/components/ui/Skeleton';


interface Asset {
  id: string;
  name: string;
  type: string;
  serial: string | null;
  status: string;
  assigned_at: string | null;
}

export default function MyAssetsPage() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getMyAssets();
        setAssets(data as Asset[]);
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>My Assets</h1>
          <p>Company ne tumhe jo diya hai</p>
        </div>
      </div>

      <div className="panel">
        <div className="panel-body" style={{ padding: 0 }}>
          {loading ? ( <TableSkeleton rows={5} />) : filtered.length === 0 ? (
            <div className="empty">
              <div className="big">💻</div>
              Abhi koi asset assign nahi
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Asset</th>
                    <th>Type</th>
                    <th>Serial</th>
                    <th>Assigned</th>
                    <th>Status</th>
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
                      <td>{fmtDate(a.assigned_at?.slice(0, 10))}</td>
                      <td><span className="tag tag-teal">{a.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}