import { CSSProperties } from 'react';

export function Skeleton({
  className = '',
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  return <div className={`skeleton ${className}`} style={style} />;
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th><Skeleton className="sk-sm" /></th>
            <th><Skeleton className="sk-sm" /></th>
            <th><Skeleton className="sk-sm" /></th>
            <th><Skeleton className="sk-sm" /></th>
            <th><Skeleton className="sk-sm" /></th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <tr key={i}>
              <td><Skeleton className="sk-md" /></td>
              <td><Skeleton className="sk-sm" /></td>
              <td><Skeleton className="sk-sm" /></td>
              <td><Skeleton className="sk-md" /></td>
              <td><Skeleton className="sk-sm" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StatSkeleton() {
  return (
    <div className="stats">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="stat">
          <Skeleton className="sk-sm" />
          <Skeleton className="sk-lg" style={{ marginTop: 10 }} />
          <Skeleton className="sk-sm" style={{ marginTop: 8 }} />
        </div>
      ))}
    </div>
  );
}