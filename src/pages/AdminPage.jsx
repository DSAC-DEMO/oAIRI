import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

function AdminPage() {
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    // Check if already authenticated
    const token = localStorage.getItem('adminToken');
    if (token) {
      setIsAuthenticated(true);
      fetchData(token);
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = async (e) => {
    e.preventDefault();
    setAuthError('');

    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      const result = await response.json();

      if (result.success) {
        localStorage.setItem('adminToken', result.token);
        setIsAuthenticated(true);
        setPassword('');
        fetchData(result.token);
      } else {
        setAuthError('Invalid password');
      }
    } catch (err) {
      setAuthError('Authentication failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    setIsAuthenticated(false);
    setData(null);
    navigate('/');
  };

  const fetchData = async (token) => {
    try {
      const response = await fetch('/api/admin', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.status === 401) {
        // Token invalid, clear and show login
        localStorage.removeItem('adminToken');
        setIsAuthenticated(false);
        setLoading(false);
        return;
      }

      if (!response.ok) throw new Error('Failed to fetch data');
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Login screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex items-center justify-center px-4">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-md w-full">
          <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">Admin Login</h1>
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter admin password"
                required
              />
            </div>
            {authError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
                {authError}
              </div>
            )}
            <button
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-gray-600">Loading data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-xl text-red-600">Error: {error}</div>
      </div>
    );
  }

  const { stats, responses } = data;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2 rounded-lg transition-colors"
          >
            Logout
          </button>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold text-blue-600">{stats.total_responses}</div>
            <div className="text-gray-600">Total Responses</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold text-green-600">
              {stats.avg_score ? Math.round(stats.avg_score) : 0}/100
            </div>
            <div className="text-gray-600">Average Score</div>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="text-3xl font-bold text-purple-600">
              {stats.max_score || 0}/100
            </div>
            <div className="text-gray-600">Highest Score</div>
          </div>
        </div>

        {/* Readiness Level Distribution */}
        <div className="bg-white p-6 rounded-lg shadow mb-8">
          <h2 className="text-2xl font-bold mb-4">Readiness Level Distribution</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-emerald-700 font-semibold">Expert Ready</span>
              <span className="bg-emerald-100 px-3 py-1 rounded">{stats.expert_count || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-green-700 font-semibold">Advanced Ready</span>
              <span className="bg-green-100 px-3 py-1 rounded">{stats.advanced_count || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-yellow-700 font-semibold">Moderately Ready</span>
              <span className="bg-yellow-100 px-3 py-1 rounded">{stats.moderate_count || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-orange-700 font-semibold">Developing</span>
              <span className="bg-orange-100 px-3 py-1 rounded">{stats.developing_count || 0}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-red-700 font-semibold">Novice</span>
              <span className="bg-red-100 px-3 py-1 rounded">{stats.novice_count || 0}</span>
            </div>
          </div>
        </div>

        {/* Responses Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <h2 className="text-2xl font-bold p-6 border-b">All Responses</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Readiness Level</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Score</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Percentage</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {responses.map((response) => (
                  <tr key={response.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{response.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded ${
                        response.readiness_level === 'Expert Ready' ? 'bg-emerald-100 text-emerald-800' :
                        response.readiness_level === 'Advanced Ready' ? 'bg-green-100 text-green-800' :
                        response.readiness_level === 'Moderately Ready' ? 'bg-yellow-100 text-yellow-800' :
                        response.readiness_level === 'Developing' ? 'bg-orange-100 text-orange-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {response.readiness_level}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{response.total_score}/100</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{response.score_pct}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(response.submitted_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {responses.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No responses yet. Complete the assessment to see data here!
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminPage;
