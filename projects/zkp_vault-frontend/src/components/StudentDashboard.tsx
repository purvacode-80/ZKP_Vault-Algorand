import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useWallet } from '../context/WalletContext';
import { StudentExam } from './StudentExam';

export const StudentDashboard: React.FC = () => {
  const { logout, user } = useAuth();
  const { accountAddress } = useWallet(); // 👈 get wallet address
  const [examId, setExamId] = useState('');
  const [startExam, setStartExam] = useState(false);
  const [studentId] = useState(user?.email || 'student'); // Use email as student ID for demo

  if (startExam) {
    return (
      <StudentExam
        examId={examId}
        studentId={studentId}
        examDuration={60} // will be overridden by loaded exam
        onComplete={() => setStartExam(false)}
      />
    );
  }

  return (
    <div className="admin-dashboard" style={{ padding: '20px' }}>
      <div className="dashboard-header">
        <h1>Student Dashboard</h1>
        <button className="export-button" onClick={logout}>Logout</button>
      </div>

      <div className="stats-grid" style={{ maxWidth: '600px', margin: '40px auto' }}>
        <div className="stat-card" style={{ flexDirection: 'column', textAlign: 'center' }}>
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <div className="stat-label">Enter Exam ID</div>
            <input
              type="text"
              placeholder="e.g., MATH101"
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              style={{ marginTop: '10px', width: '100%' }}
              className="search-input"
            />
            {!accountAddress && (
              <p style={{ color: '#ffaa00', marginTop: '8px', fontSize: '14px' }}>
                ⚠️ Please connect your wallet first.
              </p>
            )}
            <button
              className="start-button"
              onClick={() => setStartExam(true)}
              disabled={!examId || !accountAddress} // 👈 disabled if missing examId OR wallet
              style={{ marginTop: '20px', width: '100%' }}
            >
              Start Exam
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
