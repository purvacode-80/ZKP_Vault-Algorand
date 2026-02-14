import React, { useState, useEffect } from 'react';
import { StudentExam } from './components/StudentExam';
import { AdminDashboard } from './components/AdminDashboard';
import { ExamBuilder } from './components/ExamBuilder';
import { PeraWalletConnect } from '@perawallet/connect';
import './App.css';

// Pera Wallet integration
const peraWallet = new PeraWalletConnect();

type View = 'home' | 'student' | 'admin' | 'builder';

function App() {
  const [currentView, setCurrentView] = useState<View>('home');
  const [accountAddress, setAccountAddress] = useState<string | null>(null);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);

  // Student exam state
  const [examId, setExamId] = useState('');
  const [studentId, setStudentId] = useState('');

  // Admin state (examId for dashboard)
  const [adminExamId, setAdminExamId] = useState('');

  const APP_ID = 755317770; // Replace with your deployed app ID

  // Reconnect wallet on mount
  useEffect(() => {
    peraWallet.reconnectSession().then((accounts) => {
      if (accounts.length) setAccountAddress(accounts[0]);
    }).catch(e => console.log('No saved session', e));
  }, []);

  const connectWallet = async () => {
    setIsWalletConnecting(true);
    try {
      const accounts = await peraWallet.connect();
      setAccountAddress(accounts[0]);
    } catch (error) {
      console.error('Wallet connection failed', error);
    } finally {
      setIsWalletConnecting(false);
    }
  };

  const disconnectWallet = () => {
    peraWallet.disconnect();
    setAccountAddress(null);
  };

  const handleStartExam = () => {
    if (!examId || !studentId) {
      alert('Please enter Exam ID and Student ID');
      return;
    }
    setCurrentView('student');
  };

  const handleExamComplete = (sessionData: any) => {
    console.log('Exam completed:', sessionData);
    alert('Exam submitted successfully!');
    setCurrentView('home');
    // Clear inputs
    setExamId('');
    setStudentId('');
  };

  const handleAdminDashboard = () => {
    if (!adminExamId) {
      alert('Please enter an Exam ID');
      return;
    }
    setCurrentView('admin');
  };

  const goHome = () => setCurrentView('home');

  return (
    <div className="app">
      {currentView === 'home' && (
        <div className="home-view">
          {/* Hero Section */}
          <div className="hero-section">
            <div className="logo">
              <span className="logo-icon">🔒</span>
              <h1>ZKP-Vault</h1>
            </div>
            <p className="tagline">Privacy-Preserving AI Proctoring on Algorand</p>
            <p className="description">
              Local AI analysis + blockchain proofs = trust without compromise.
            </p>

            {/* Wallet Connection */}
            {!accountAddress ? (
              <button
                className="connect-wallet-btn"
                onClick={connectWallet}
                disabled={isWalletConnecting}
              >
                {isWalletConnecting ? 'Connecting...' : '🔌 Connect Pera Wallet'}
              </button>
            ) : (
              <div className="connected-info">
                <div className="wallet-address">
                  <span className="label">Wallet:</span>
                  <code>{accountAddress.slice(0, 6)}...{accountAddress.slice(-4)}</code>
                </div>
                <button className="disconnect-btn" onClick={disconnectWallet}>
                  Disconnect
                </button>
              </div>
            )}
          </div>

          {/* Action Cards */}
          <div className="action-cards">
            {/* Student Card */}
            <div className="action-card">
              <div className="card-icon">👨‍🎓</div>
              <h3>Student</h3>
              <p>Take an exam with real‑time AI proctoring</p>
              <div className="form-group">
                <label>Exam ID</label>
                <input
                  type="text"
                  placeholder="e.g., MATH101"
                  value={examId}
                  onChange={e => setExamId(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label>Student ID</label>
                <input
                  type="text"
                  placeholder="Your student identifier"
                  value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                />
              </div>
              <button
                className="action-btn student-btn"
                onClick={handleStartExam}
                disabled={!accountAddress}
              >
                Start Exam
              </button>
              {!accountAddress && (
                <small style={{ color: '#ffaa00', marginTop: '8px', display: 'block' }}>
                  Connect wallet to begin
                </small>
              )}
            </div>

            {/* Admin Card */}
            <div className="action-card">
              <div className="card-icon">👨‍🏫</div>
              <h3>Admin</h3>
              <p>Monitor submissions and verify proofs</p>
              <div className="form-group">
                <label>Exam ID</label>
                <input
                  type="text"
                  placeholder="Exam ID to view"
                  value={adminExamId}
                  onChange={e => setAdminExamId(e.target.value)}
                />
              </div>
              <button
                className="action-btn admin-btn"
                onClick={handleAdminDashboard}
                disabled={!accountAddress}
              >
                Admin Dashboard
              </button>
              <div style={{ marginTop: '20px' }}>
                <button
                  className="action-btn create-btn"
                  onClick={() => setCurrentView('builder')}
                  disabled={!accountAddress}
                >
                  📝 Exam Builder
                </button>
              </div>
            </div>
          </div>

          {/* Features Grid */}
          <div className="features-section">
            <h2>Why ZKP‑Vault?</h2>
            <div className="features-grid">
              <div className="feature">
                <div className="feature-icon">🔒</div>
                <h4>Local AI</h4>
                <p>All processing stays on your device – no video ever leaves.</p>
              </div>
              <div className="feature">
                <div className="feature-icon">⛓️</div>
                <h4>Blockchain Proofs</h4>
                <p>Immutable records on Algorand guarantee integrity.</p>
              </div>
              <div className="feature">
                <div className="feature-icon">🛡️</div>
                <h4>Zero‑Knowledge Ready</h4>
                <p>Architected for future ZK‑SNARK verification.</p>
              </div>
              <div className="feature">
                <div className="feature-icon">📊</div>
                <h4>Real‑time Dashboard</h4>
                <p>Monitor trust scores and academic results instantly.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {currentView === 'student' && (
        <>
          <div className="view-header">
            <button className="back-btn" onClick={goHome}>← Back to Home</button>
            <div className="wallet-indicator">
              {accountAddress && (
                <code>{accountAddress.slice(0, 6)}...{accountAddress.slice(-4)}</code>
              )}
            </div>
          </div>
          <StudentExam
            examId={examId}
            studentId={studentId}
            examDuration={60} // fallback, will be overridden by loaded exam
            onComplete={handleExamComplete}
          />
        </>
      )}

      {currentView === 'admin' && (
        <>
          <div className="view-header">
            <button className="back-btn" onClick={goHome}>← Back to Home</button>
            <div className="wallet-indicator">
              {accountAddress && (
                <code>{accountAddress.slice(0, 6)}...{accountAddress.slice(-4)}</code>
              )}
            </div>
          </div>
          <AdminDashboard examId={adminExamId} appId={APP_ID} />
        </>
      )}

      {currentView === 'builder' && (
        <>
          <div className="view-header">
            <button className="back-btn" onClick={goHome}>← Back to Home</button>
            <div className="wallet-indicator">
              {accountAddress && (
                <code>{accountAddress.slice(0, 6)}...{accountAddress.slice(-4)}</code>
              )}
            </div>
          </div>
          <ExamBuilder />
        </>
      )}
    </div>
  );
}

export default App;
