import { useState, useEffect } from 'react';
import { ApiEndpoint, FetchLog } from '../types/database';
import { api } from '../lib/api';
import {
  RefreshCw, Play, CheckCircle, XCircle, Clock, AlertCircle, Loader2, Database,
} from 'lucide-react';

export function FetchPage() {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [recentLogs, setRecentLogs] = useState<(FetchLog & { endpoint_name: string })[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchingIds, setFetchingIds] = useState<Set<string>>(new Set());
  const [fetchingAll, setFetchingAll] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allEndpoints, logsData] = await Promise.all([
        api.getEndpoints(),
        api.getLogs({ limit: 10 }),
      ]);
      setEndpoints(allEndpoints.filter((e) => e.is_active));
      setRecentLogs(logsData);
    } catch (err) {
      console.error('Failed to load data:', err);
    }
    setIsLoading(false);
  };

  const fetchFromEndpoint = async (endpoint: ApiEndpoint) => {
    setFetchingIds((prev) => new Set(prev).add(endpoint.id));
    const startTime = Date.now();
    let status: 'success' | 'error' | 'partial' = 'success';
    let errorMessage: string | null = null;
    let recordsFetched = 0, recordsCreated = 0, recordsUpdated = 0;

    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const authConfig = endpoint.auth_config as Record<string, unknown>;
      if (endpoint.auth_type === 'bearer' && authConfig?.token) {
        headers['Authorization'] = `Bearer ${authConfig.token}`;
      } else if (endpoint.auth_type === 'api_key') {
        const ha = authConfig?.headers as Record<string, string> | undefined;
        if (ha) Object.assign(headers, ha);
      } else if (endpoint.auth_type === 'basic') {
        const { username, password } = authConfig as { username?: string; password?: string };
        if (username && password) headers['Authorization'] = `Basic ${btoa(`${username}:${password}`)}`;
      }

      const response = await fetch(endpoint.base_url, { headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);

      const jsonData = await response.json();
      let data = jsonData;
      if (endpoint.response_path) {
        for (const path of endpoint.response_path.split('.')) data = data?.[path];
      }

      const items = Array.isArray(data) ? data : [data].filter(Boolean);
      recordsFetched = items.length;
      const mappings = endpoint.field_mappings as Array<{ sourceField: string; targetField: string; transform?: string }> | null;

      for (const item of items) {
        const externalId = item?.id?.toString() || item?._id?.toString() || null;
        let mappedData: Record<string, unknown> = {};
        if (mappings && mappings.length > 0) {
          for (const mapping of mappings) {
            const value = item?.[mapping.sourceField];
            if (value !== undefined) {
              let tv: unknown = value;
              if (mapping.transform === 'number') tv = Number(value);
              else if (mapping.transform === 'boolean') tv = Boolean(value);
              else if (mapping.transform === 'date') tv = new Date(value).toISOString();
              else tv = String(value);
              mappedData[mapping.targetField] = tv;
            }
          }
        }
        const result = await api.upsertRecord({ endpoint_id: endpoint.id, external_id: externalId, raw_data: item, mapped_data: mappedData });
        if (result.action === 'updated') recordsUpdated++; else recordsCreated++;
      }

      await api.updateEndpointStatus(endpoint.id, { last_fetched_at: new Date().toISOString(), last_error: null });
    } catch (err) {
      status = 'error';
      errorMessage = (err as Error).message;
      await api.updateEndpointStatus(endpoint.id, { last_error: errorMessage });
    }

    await api.createLog({ endpoint_id: endpoint.id, status, records_fetched: recordsFetched, records_created: recordsCreated, records_updated: recordsUpdated, error_message: errorMessage, duration_ms: Date.now() - startTime });
    setFetchingIds((prev) => { const n = new Set(prev); n.delete(endpoint.id); return n; });
    loadData();
  };

  const fetchAllEndpoints = async () => {
    setFetchingAll(true);
    for (const ep of endpoints) await fetchFromEndpoint(ep);
    setFetchingAll(false);
  };

  if (isLoading) return <div className="flex items-center justify-center h-64"><RefreshCw className="w-8 h-8 text-blue-500 animate-spin" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Fetch Data</h1>
          <p className="text-slate-400 mt-1">Pull data from configured API endpoints</p>
        </div>
        <button onClick={fetchAllEndpoints} disabled={fetchingAll || endpoints.length === 0} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition shadow-lg shadow-green-500/20 disabled:opacity-50">
          {fetchingAll ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
          Fetch All ({endpoints.length})
        </button>
      </div>

      {endpoints.length === 0 ? (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-12 text-center">
          <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4"><Database className="w-8 h-8 text-slate-500" /></div>
          <h3 className="text-lg font-semibold text-white mb-2">No active endpoints</h3>
          <p className="text-slate-400">Configure and activate API endpoints first</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {endpoints.map((endpoint) => {
            const isFetching = fetchingIds.has(endpoint.id);
            return (
              <div key={endpoint.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${endpoint.last_error ? 'bg-yellow-500/20' : endpoint.last_fetched_at ? 'bg-green-500/20' : 'bg-slate-700'}`}>
                      {endpoint.last_error ? <AlertCircle className="w-5 h-5 text-yellow-400" /> : endpoint.last_fetched_at ? <CheckCircle className="w-5 h-5 text-green-400" /> : <Database className="w-5 h-5 text-slate-500" />}
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white">{endpoint.name}</h3>
                      <p className="text-sm text-slate-500 font-mono truncate max-w-md">{endpoint.base_url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {endpoint.last_fetched_at && <span className="text-sm text-slate-500 flex items-center gap-1"><Clock className="w-4 h-4" />{new Date(endpoint.last_fetched_at).toLocaleString()}</span>}
                    <button onClick={() => fetchFromEndpoint(endpoint)} disabled={isFetching} className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 shadow-lg shadow-blue-500/20">
                      {isFetching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                      Fetch
                    </button>
                  </div>
                </div>
                {endpoint.last_error && <div className="mt-3 flex items-center gap-2 text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2"><AlertCircle className="w-4 h-4 shrink-0" /><span className="truncate">{endpoint.last_error}</span></div>}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-8">
        <h2 className="text-lg font-semibold text-white mb-4">Recent Fetch History</h2>
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
          {recentLogs.length === 0 ? <p className="text-slate-500 text-center py-8">No fetch history yet</p> : (
            <table className="w-full">
              <thead className="bg-slate-700/50">
                <tr>
                  {['Endpoint','Status','Fetched','Created','Updated','Duration','Time'].map(h => <th key={h} className={`px-4 py-3 text-sm font-medium text-slate-400 ${h==='Endpoint'||h==='Status'||h==='Time' ? 'text-left' : 'text-right'}`}>{h}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {recentLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-700/30">
                    <td className="px-4 py-3 text-white">{log.endpoint_name}</td>
                    <td className="px-4 py-3"><span className={`inline-flex items-center gap-1 text-sm ${log.status==='success'?'text-green-400':log.status==='partial'?'text-yellow-400':'text-red-400'}`}>{log.status==='success'?<CheckCircle className="w-4 h-4"/>:log.status==='partial'?<AlertCircle className="w-4 h-4"/>:<XCircle className="w-4 h-4"/>}{log.status}</span></td>
                    <td className="px-4 py-3 text-right text-slate-300">{log.records_fetched}</td>
                    <td className="px-4 py-3 text-right text-green-400">{log.records_created}</td>
                    <td className="px-4 py-3 text-right text-blue-400">{log.records_updated}</td>
                    <td className="px-4 py-3 text-right text-slate-400">{log.duration_ms}ms</td>
                    <td className="px-4 py-3 text-slate-500 text-sm">{new Date(log.created_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
