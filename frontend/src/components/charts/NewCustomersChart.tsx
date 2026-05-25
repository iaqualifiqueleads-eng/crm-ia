import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatDate } from '@/lib/utils';

interface Point { day: string; total: number }

export function NewCustomersChart({ data }: { data: Point[] }) {
  // Normaliza
  const series = data.map((d) => ({
    day: typeof d.day === 'string' ? d.day : d.day,
    total: Number(d.total),
  }));

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={series} margin={{ top: 8, right: 4, bottom: 4, left: -16 }}>
          <defs>
            <linearGradient id="gradChampagne" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%"   stopColor="#C9A961" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#C9A961" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="day"
            tickFormatter={(v) => formatDate(v, { day: '2-digit', month: 'short' })}
            tick={{ fontSize: 10, fill: '#6C6C72' }}
            axisLine={{ stroke: '#E8E6E1' }}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#6C6C72' }}
            axisLine={false}
            tickLine={false}
            width={32}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: '#C9A961', strokeWidth: 1, strokeDasharray: '2 4' }}
            contentStyle={{
              background: '#0A0A0B',
              border: 'none',
              borderRadius: 2,
              color: '#FAFAF7',
              fontSize: 12,
              padding: '8px 12px',
            }}
            labelFormatter={(v: string) => formatDate(v)}
            formatter={(v: number) => [v, 'Novos clientes']}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="#C9A961"
            strokeWidth={1.5}
            fill="url(#gradChampagne)"
            dot={{ r: 0 }}
            activeDot={{ r: 4, fill: '#C9A961', stroke: '#0A0A0B', strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
