import React, { useState, useEffect } from 'react';
import { PeraWalletConnect } from '@perawallet/connect';
import { StudentExam } from './components/StudentExam';
import { AdminDashboard } from './components/AdminDashboard';
import { setAppId } from './components/services/algorand-service';
import './App.css';

// Initialize Pera Wallet
const peraWallet = new PeraWalletConnect();

// Algorand App ID (replace with your deployed contract ID)
const APP_ID : number = 755317770; // TODO: Replace with actual App ID after deployment

interface AppProps {}

const App: React.FC<AppProps> = () => {
  const [accountAddress, setAccountAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentView, setCurrentView] = useState<'home' | 'student' | 'admin'>('home');
  const [examId, setExamId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [examDuration, setExamDuration] = useState(60);

  useEffect(() => {
    // Set the App ID for Algorand service
    setAppId(APP_ID);

    // Reconnect to previous session if exists
    peraWallet.reconnectSession().then((accounts) => {
      if (accounts.length > 0) {
        setAccountAddress(accounts[0]);
        setIsConnected(true);
      }
    });
  }, []);

  const handleConnectWallet = async () => {
    try {
      const accounts = await peraWallet.connect();
      setAccountAddress(accounts[0]);
      setIsConnected(true);
      console.log('✅ Wallet connected:', accounts[0]);
    } catch (error) {
      console.error('Wallet connection error:', error);
      if (error instanceof Error) {
        alert(`Failed to connect wallet: ${error.message}`);
      }
    }
  };

  const handleDisconnectWallet = () => {
    peraWallet.disconnect();
    setAccountAddress(null);
    setIsConnected(false);
    setCurrentView('home');
  };

  const signTransactions = async (txns: any[]): Promise<Uint8Array[]> => {
    try {
      const signedTxns = await peraWallet.signTransaction([txns]);
      return signedTxns.map((txn: any) => txn);
    } catch (error) {
      console.error('Transaction signing error:', error);
      throw error;
    }
  };

  const handleExamComplete = (sessionData: any) => {
    console.log('📊 Exam completed:', sessionData);
    alert(`Exam completed! Trust Score: ${sessionData.trustScore}\nProof Hash: ${sessionData.proofHash}`);
    setCurrentView('home');
  };

  const renderHome = () => (
    <div className="home-view">
      <div className="hero-section">
        <div className="logo">
          <div className="logo-icon">🔒</div>
          <h1>ZKP-Vault</h1>
        </div>
        <p className="tagline">Privacy-Preserving AI Proctoring on Algorand</p>
        <p className="description">
          AI runs locally. No video upload. Only cryptographic proofs on blockchain.
        </p>

        {!isConnected ? (
          <button className="connect-wallet-btn" onClick={handleConnectWallet}>
            🔗 Connect Pera Wallet
          </button>
        ) : (
          <div className="connected-info">
            <div className="wallet-address">
              <span className="label">Connected:</span>
              <code>{accountAddress?.substring(0, 8)}...{accountAddress?.substring(accountAddress.length - 8)}</code>
            </div>
            <button className="disconnect-btn" onClick={handleDisconnectWallet}>
              Disconnect
            </button>
          </div>
        )}
      </div>

      {isConnected && (
        <div className="action-cards">
          <div className="action-card">
            <div className="card-icon">👨‍🎓</div>
            <h3>Take Exam</h3>
            <p>Start your proctored exam with AI monitoring</p>

            <div className="form-group">
              <label>Exam ID</label>
              <input
                type="text"
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
                placeholder="e.g., CS101_FINAL_2024"
              />
            </div>

            <div className="form-group">
              <label>Student ID</label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g., STU12345"
              />
            </div>

            <div className="form-group">
              <label>Duration (minutes)</label>
              <input
                type="number"
                value={examDuration}
                onChange={(e) => setExamDuration(parseInt(e.target.value))}
                min="1"
                max="300"
              />
            </div>

            <button
              className="action-btn student-btn"
              onClick={() => setCurrentView('student')}
              disabled={!examId || !studentId}
            >
              Start Exam →
            </button>
          </div>

          <div className="action-card">
            <div className="card-icon">👨‍💼</div>
            <h3>Admin Dashboard</h3>
            <p>View student proofs and exam analytics</p>

            <div className="form-group">
              <label>Exam ID to Monitor</label>
              <input
                type="text"
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
                placeholder="e.g., CS101_FINAL_2024"
              />
            </div>

            <button
              className="action-btn admin-btn"
              onClick={() => setCurrentView('admin')}
              disabled={!examId}
            >
              Open Dashboard →
            </button>
          </div>
        </div>
      )}

      <div className="features-section">
        <h2>Why ZKP-Vault?</h2>
        <div className="features-grid">
          <div className="feature">
            <div className="feature-icon">🔒</div>
            <h4>100% Privacy</h4>
            <p>Video never leaves your device. Only cryptographic proofs are shared.</p>
          </div>
          <div className="feature">
            <div className="feature-icon">🤖</div>
            <h4>Local AI</h4>
            <p>Face detection, gaze tracking, and phone detection run in your browser.</p>
          </div>
          <div className="feature">
            <div className="feature-icon">⛓️</div>
            <h4>Blockchain Trust</h4>
            <p>Immutable proofs stored on Algorand. Fully transparent and verifiable.</p>
          </div>
          <div className="feature">
            <div className="feature-icon">🔐</div>
            <h4>Zero-Knowledge</h4>
            <p>Designed for ZK-SNARK verification with AlgoPlonk compatibility.</p>
          </div>
        </div>
      </div>

      {APP_ID === 0 && (
        <div className="warning-banner">
          ⚠️ Smart contract not deployed yet. Please update APP_ID in App.tsx after deployment.
        </div>
      )}
    </div>
  );

  const renderStudent = () => (
    <div className="student-view">
      <div className="view-header">
        <button className="back-btn" onClick={() => setCurrentView('home')}>
          ← Back to Home
        </button>
        <button className="disconnect-btn" onClick={handleDisconnectWallet}>
          Disconnect Wallet
        </button>
      </div>
      <StudentExam
        examId={examId}
        studentId={studentId}
        examDuration={examDuration}
        onComplete={handleExamComplete}
      />
    </div>
  );

  const renderAdmin = () => (
    <div className="admin-view">
      <div className="view-header">
        <button className="back-btn" onClick={() => setCurrentView('home')}>
          ← Back to Home
        </button>
        <button className="disconnect-btn" onClick={handleDisconnectWallet}>
          Disconnect Wallet
        </button>
      </div>
      <AdminDashboard examId={examId} appId={APP_ID} />
    </div>
  );

  return (
    <div className="app">
      {currentView === 'home' && renderHome()}
      {currentView === 'student' && renderStudent()}
      {currentView === 'admin' && renderAdmin()}
    </div>
  );
};

export default App;
