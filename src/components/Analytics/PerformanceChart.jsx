import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';

const PerformanceChart = ({ data }) => {
  if (!data || data.length === 0) {
    return <div className="text-center py-8 text-muted">No trend data available</div>;
  }

  const chartData = data.map(point => ({
    date: format(new Date(point.date), 'MMM dd'),
    accuracy: Math.round(point.accuracy * 100) / 100
  }));

  return (
    <div className="w-full" style={{ height: '300px' }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#333" />
          <XAxis 
            dataKey="date" 
            stroke="#a3a3a3"
            style={{ fontSize: '12px' }}
          />
          <YAxis 
            domain={[0, 100]}
            stroke="#a3a3a3"
            style={{ fontSize: '12px' }}
            label={{ value: 'Accuracy (%)', angle: -90, position: 'insideLeft', style: { fill: '#a3a3a3' } }}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--card)', 
              border: '1px solid var(--border)', 
              borderRadius: '8px',
              color: 'var(--text)'
            }}
            formatter={(value) => [`${value}%`, 'Accuracy']}
            labelFormatter={(label) => `Date: ${label}`}
          />
          <Line 
            type="monotone" 
            dataKey="accuracy" 
            stroke="#f97316" 
            strokeWidth={2}
            dot={{ r: 4, fill: '#f97316' }}
            activeDot={{ r: 6, fill: '#ea580c' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PerformanceChart;
