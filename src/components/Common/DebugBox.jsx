import { useState, useEffect } from 'react';
import { get } from '../../services/apiClient';

function DebugBox() {
  const [stats, setStats] = useState({
    connected: false,
    tables: {
      exam: 0,
      attempt: 0,
      daily_plan: 0
    },
    error: null,
    lastUpdate: null
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await get('/debug/stats/');
        setStats({
          connected: data.connected,
          tables: data.tables || {
            exam: 0,
            attempt: 0,
            daily_plan: 0
          },
          error: null,
          lastUpdate: new Date().toLocaleTimeString()
        });
      } catch (error) {
        setStats(prev => ({
          ...prev,
          connected: false,
          error: error.message || 'Connection failed',
          lastUpdate: new Date().toLocaleTimeString()
        }));
      }
    };

    // Fetch immediately
    fetchStats();

    // Then fetch every second
    const interval = setInterval(fetchStats, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="fixed bottom-6 right-6 z-[9999] bg-gray-900 text-white p-5 rounded-lg shadow-2xl border-2 border-gray-700 min-w-[320px] font-mono text-sm">
      <div className="flex items-center justify-between mb-3">
        <span className="font-bold text-lg">Debug Panel</span>
        <div className={`w-4 h-4 rounded-full ${stats.connected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
      </div>
      
      <div className="space-y-2">
        <div className="flex justify-between items-center py-1">
          <span className="text-gray-400 text-base">Backend:</span>
          <span className={`text-base font-semibold ${stats.connected ? 'text-green-400' : 'text-red-400'}`}>
            {stats.connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        
        <div className="border-t border-gray-700 my-2 pt-2">
          <div className="text-gray-300 font-semibold mb-2 text-base">Table Counts:</div>
          <div className="flex justify-between items-center py-1">
            <span className="text-gray-400 text-base">Exam:</span>
            <span className="text-yellow-400 text-lg font-bold">{stats.tables.exam}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-gray-400 text-base">Attempt:</span>
            <span className="text-yellow-400 text-lg font-bold">{stats.tables.attempt}</span>
          </div>
          <div className="flex justify-between items-center py-1">
            <span className="text-gray-400 text-base">Daily Plan:</span>
            <span className="text-yellow-400 text-lg font-bold">{stats.tables.daily_plan}</span>
          </div>
        </div>

        {stats.error && (
          <div className="text-red-400 text-xs mt-2 break-words bg-red-900/30 p-2 rounded">
            {stats.error}
          </div>
        )}

        {stats.lastUpdate && (
          <div className="text-gray-500 text-xs mt-2 pt-2 border-t border-gray-700">
            Updated: {stats.lastUpdate}
          </div>
        )}
      </div>
    </div>
  );
}

export default DebugBox;

