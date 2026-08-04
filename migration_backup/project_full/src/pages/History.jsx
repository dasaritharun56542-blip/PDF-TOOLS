import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

export default function History() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchHistoryLogs = async () => {
    try {
      const res = await axios.get('/api/history-data/');
      setLogs(res.data.logs);
    } catch (err) {
      console.error('Failed to load history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate('/accounts/login');
      } else {
        fetchHistoryLogs();
      }
    }
  }, [user, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="container py-5 text-center">
        <div className="spinner-border text-primary" role="status"></div>
        <p className="mt-2 text-muted">Loading history logs...</p>
      </div>
    );
  }

  return (
    <div className="container py-5">
      <div className="row mb-5" data-aos="fade-down">
        <div className="col-md-8">
          <h1 className="display-5 fw-bold text-dark">Tool Usage History</h1>
          <p className="text-muted lead">Keep track of all your document processing activities.</p>
        </div>
        <div className="col-md-4 text-md-end">
          <Link to="/" className="btn btn-primary rounded-pill px-4 fw-bold">
            <i className="bi bi-plus-lg me-2"></i> New Tool
          </Link>
        </div>
      </div>

      <div className="card border-0 shadow-sm rounded-4 overflow-hidden" data-aos="fade-up">
        <div className="table-responsive">
          <table className="table table-hover mb-0">
            <thead className="bg-light">
              <tr>
                <th className="px-4 py-3 text-muted fw-bold small text-uppercase">Tool Name</th>
                <th className="px-4 py-3 text-muted fw-bold small text-uppercase">Date & Time</th>
                <th className="px-4 py-3 text-muted fw-bold small text-uppercase text-end">Outcome</th>
              </tr>
            </thead>
            <tbody>
              {logs && logs.length > 0 ? (
                logs.map((log) => (
                  <tr className="align-middle" key={log.id}>
                    <td className="px-4 py-4">
                      <div className="d-flex align-items-center">
                        <div className="bg-primary-subtle p-2 rounded-3 me-3">
                          <i className="bi bi-gear-fill text-primary"></i>
                        </div>
                        <span className="fw-bold text-dark">
                          {log.tool_name.replace('-', ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-muted">{log.timestamp}</td>
                    <td className="px-4 py-4 text-end">
                      <span className="badge bg-success-subtle text-success px-3 py-2 rounded-pill fw-bold">
                        <i className="bi bi-check-circle-fill me-1"></i> Success
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="3" className="text-center py-5">
                    <i className="bi bi-calendar-x display-2 text-muted opacity-25 mb-3 d-block"></i>
                    <h4 className="text-muted">No usage logs found</h4>
                    <p className="text-muted small">Your activity will appear here once you start using the tools.</p>
                    <Link to="/" className="btn btn-outline-primary btn-sm rounded-pill px-4 mt-2">
                      Get Started
                    </Link>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .table thead th {
            border-bottom: none;
        }
        .table tbody tr:last-child td {
            border-bottom: none;
        }
      `}} />
    </div>
  );
}
