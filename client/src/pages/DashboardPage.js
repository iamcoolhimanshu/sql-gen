import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { useAuth } from '../hooks/useAuth';
import { dbAPI, queryAPI } from '../services/api';
import Sidebar from '../components/dashboard/Sidebar';
import Header from '../components/dashboard/Header';
import ConnectionManager from '../components/db/ConnectionManager';
import QueryWorkspace from '../components/query/QueryWorkspace';
import QueryHistory from '../components/history/QueryHistory';
import './Dashboard.css';

export default function DashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('query'); // query | connections | history
  const [connections, setConnections] = useState([]);
  const [activeConnection, setActiveConnection] = useState(null);
  const [schema, setSchema] = useState([]);
  const [schemaLoading, setSchemaLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    loadConnections();
  }, []);

  const loadConnections = async () => {
    try {
      const res = await dbAPI.getConnections();
      setConnections(res.data.connections);
      if (res.data.connections.length > 0 && !activeConnection) {
        selectConnection(res.data.connections[0]);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const selectConnection = useCallback(async (conn) => {
    setActiveConnection(conn);
    setSchema([]);
    setSchemaLoading(true);
    try {
      const res = await dbAPI.getSchema(conn.id);
      setSchema(res.data.schema);
    } catch (err) {
      toast.error('Could not load schema: ' + (err.response?.data?.error || err.message));
    } finally {
      setSchemaLoading(false);
    }
  }, []);

  return (
    <div className="dashboard">
      <Header
        user={user}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
      />
      <div className="dashboard-body">
        {sidebarOpen && (
          <Sidebar
            connections={connections}
            activeConnection={activeConnection}
            onSelectConnection={selectConnection}
            schema={schema}
            schemaLoading={schemaLoading}
            onAddConnection={() => setActiveTab('connections')}
          />
        )}
        <main className="dashboard-main">
          {activeTab === 'query' && (
            <QueryWorkspace
              activeConnection={activeConnection}
              schema={schema}
            />
          )}
          {activeTab === 'connections' && (
            <ConnectionManager
              connections={connections}
              onUpdate={loadConnections}
              onSelectConnection={(conn) => { selectConnection(conn); setActiveTab('query'); }}
            />
          )}
          {activeTab === 'history' && (
            <QueryHistory
              activeConnection={activeConnection}
              onRerun={(query) => { setActiveTab('query'); }}
            />
          )}
        </main>
      </div>
    </div>
  );
}
