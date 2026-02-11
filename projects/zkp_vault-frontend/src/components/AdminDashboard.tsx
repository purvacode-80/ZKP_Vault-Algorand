import React, { useEffect, useState } from 'react';
import { getExamProofs, getExamMetadata, getExplorerUrl } from './services/algorand-service';
import './AdminDashboard.css';

interface ProofData {
  studentHash: string;
  trustScore: number;
  proofHash: string;
  timestamp: number;
  txId?: string;
}

interface ExamStats {
  totalSubmissions: number;
  averageTrustScore: number;
  highIntegrity: number; // Count of scores > 90
  mediumIntegrity: number; // Count of scores 70-90
  lowIntegrity: number; // Count of scores < 70
}

interface AdminDashboardProps {
  examId: string;
  appId: number;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ examId, appId }) => {
  const [proofs, setProofs] = useState<ProofData[]>([]);
  const [stats, setStats] = useState<ExamStats>({
    totalSubmissions: 0,
    averageTrustScore: 0,
    highIntegrity: 0,
    mediumIntegrity: 0,
    lowIntegrity: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'high' | 'medium' | 'low'>('all');

  useEffect(() => {
    loadProofs();
  }, [examId, appId]);

  const loadProofs = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch all proofs for this exam
      const examProofs = await getExamProofs(examId);

      // Parse proof data
      const parsedProofs: ProofData[] = examProofs.map((proof: any) => {
        // TODO: Implement proper ABI decoding
        // For now, this is a placeholder structure
        const boxName = proof.boxName;
        const studentHash = boxName.split('_')[1] || 'unknown';

        return {
          studentHash: studentHash.substring(0, 16) + '...',
          trustScore: Math.floor(Math.random() * 40 + 60), // Placeholder
          proofHash: `0x${Math.random().toString(16).substring(2, 18)}...`,
          timestamp: Date.now() - Math.random() * 86400000,
          txId: `TX${Math.random().toString(36).substring(2, 15)}`,
        };
      });

      setProofs(parsedProofs);
      calculateStats(parsedProofs);
    } catch (err) {
      console.error('Failed to load proofs:', err);
      setError('Failed to load exam data. Please check the exam ID and try again.');

      // Load mock data for demo
      loadMockData();
    } finally {
      setIsLoading(false);
    }
  };

  const loadMockData = () => {
    // Generate mock data for demonstration
    const mockProofs: ProofData[] = Array.from({ length: 15 }, (_, i) => ({
      studentHash: `0x${Math.random().toString(16).substring(2, 18)}...`,
      trustScore: Math.floor(Math.random() * 40 + 60),
      proofHash: `0x${Math.random().toString(16).substring(2, 18)}...`,
      timestamp: Date.now() - Math.random() * 86400000,
      txId: `TX${Math.random().toString(36).substring(2, 15)}`,
    }));

    setProofs(mockProofs);
    calculateStats(mockProofs);
  };

  const calculateStats = (proofList: ProofData[]) => {
    const totalSubmissions = proofList.length;
    const averageTrustScore = totalSubmissions > 0
      ? proofList.reduce((sum, p) => sum + p.trustScore, 0) / totalSubmissions
      : 0;

    const highIntegrity = proofList.filter(p => p.trustScore > 90).length;
    const mediumIntegrity = proofList.filter(p => p.trustScore >= 70 && p.trustScore <= 90).length;
    const lowIntegrity = proofList.filter(p => p.trustScore < 70).length;

    setStats({
      totalSubmissions,
      averageTrustScore: Math.round(averageTrustScore * 10) / 10,
      highIntegrity,
      mediumIntegrity,
      lowIntegrity,
    });
  };

  const getStatusBadge = (score: number) => {
    if (score >= 90) return { className: 'status-high', label: 'High', icon: '🟢' };
    if (score >= 70) return { className: 'status-medium', label: 'Medium', icon: '🟡' };
    return { className: 'status-low', label: 'Review', icon: '🔴' };
  };

  const filteredProofs = proofs
    .filter(proof => {
      if (searchTerm) {
        return proof.studentHash.toLowerCase().includes(searchTerm.toLowerCase());
      }
      return true;
    })
    .filter(proof => {
      if (filterStatus === 'all') return true;
      if (filterStatus === 'high') return proof.trustScore > 90;
      if (filterStatus === 'medium') return proof.trustScore >= 70 && proof.trustScore <= 90;
      if (filterStatus === 'low') return proof.trustScore < 70;
      return true;
    });

  const exportReport = () => {
    const csvContent = [
      ['Student Hash', 'Trust Score', 'Proof Hash', 'Timestamp', 'Status'].join(','),
      ...proofs.map(p => [
        p.studentHash,
        p.trustScore,
        p.proofHash,
        new Date(p.timestamp).toISOString(),
        getStatusBadge(p.trustScore).label,
      ].join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `zkp-vault-${examId}-report.csv`;
    a.click();
  };

  return (
    <div className="admin-dashboard">
      <div className="dashboard-header">
        <div className="header-content">
          <h1>ZKP-Vault Admin Dashboard</h1>
          <p className="exam-info">
            Exam: <strong>{examId}</strong> | Date: {new Date().toLocaleDateString()}
          </p>
        </div>
        <button className="export-button" onClick={exportReport}>
          📊 Export Report
        </button>
      </div>

      {/* Statistics Section */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalSubmissions}</div>
            <div className="stat-label">Total Submissions</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon">⭐</div>
          <div className="stat-content">
            <div className="stat-value">{stats.averageTrustScore}</div>
            <div className="stat-label">Average Trust Score</div>
          </div>
        </div>

        <div className="stat-card highlight-green">
          <div className="stat-icon">🟢</div>
          <div className="stat-content">
            <div className="stat-value">{stats.highIntegrity}</div>
            <div className="stat-label">High Integrity (&gt;90)</div>
          </div>
        </div>

        <div className="stat-card highlight-yellow">
          <div className="stat-icon">🟡</div>
          <div className="stat-content">
            <div className="stat-value">{stats.mediumIntegrity}</div>
            <div className="stat-label">Medium (70-90)</div>
          </div>
        </div>

        <div className="stat-card highlight-red">
          <div className="stat-icon">🔴</div>
          <div className="stat-content">
            <div className="stat-value">{stats.lowIntegrity}</div>
            <div className="stat-label">Needs Review (&lt;70)</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters-section">
        <input
          type="text"
          className="search-input"
          placeholder="Search by student hash..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />

        <div className="filter-buttons">
          <button
            className={filterStatus === 'all' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilterStatus('all')}
          >
            All
          </button>
          <button
            className={filterStatus === 'high' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilterStatus('high')}
          >
            High Integrity
          </button>
          <button
            className={filterStatus === 'medium' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilterStatus('medium')}
          >
            Medium
          </button>
          <button
            className={filterStatus === 'low' ? 'filter-btn active' : 'filter-btn'}
            onClick={() => setFilterStatus('low')}
          >
            Needs Review
          </button>
        </div>
      </div>

      {/* Proofs Table */}
      <div className="proofs-section">
        <h2>Student Proofs</h2>

        {isLoading ? (
          <div className="loading-state">
            <div className="spinner"></div>
            <p>Loading proofs from blockchain...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <p>{error}</p>
            <button onClick={loadProofs}>Retry</button>
          </div>
        ) : filteredProofs.length === 0 ? (
          <div className="empty-state">
            <p>No proofs found</p>
          </div>
        ) : (
          <div className="proofs-table">
            <div className="table-header">
              <div className="col-hash">Student Hash</div>
              <div className="col-score">Trust Score</div>
              <div className="col-status">Status</div>
              <div className="col-time">Timestamp</div>
              <div className="col-blockchain">Blockchain</div>
            </div>

            {filteredProofs.map((proof, index) => {
              const status = getStatusBadge(proof.trustScore);
              return (
                <div key={index} className="table-row">
                  <div className="col-hash">
                    <code>{proof.studentHash}</code>
                  </div>
                  <div className="col-score">
                    <div className="score-badge" style={{
                      backgroundColor: proof.trustScore >= 90 ? '#00ff88' : proof.trustScore >= 70 ? '#ffaa00' : '#ff6b6b'
                    }}>
                      {proof.trustScore}
                    </div>
                  </div>
                  <div className="col-status">
                    <span className={`status-badge ${status.className}`}>
                      {status.icon} {status.label}
                    </span>
                  </div>
                  <div className="col-time">
                    {new Date(proof.timestamp).toLocaleString()}
                  </div>
                  <div className="col-blockchain">
                    <a
                      href={getExplorerUrl(proof.txId || '', 'testnet')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="explorer-link"
                    >
                      View on Explorer →
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Privacy Notice */}
      <div className="privacy-notice">
        <div className="notice-icon">🔒</div>
        <div className="notice-content">
          <h3>Privacy Protection Active</h3>
          <p>
            No video data is stored or accessible. Only cryptographic proofs and trust scores
            are recorded on the Algorand blockchain. Student identities are hashed and cannot
            be reverse-engineered.
          </p>
        </div>
      </div>
    </div>
  );
};
