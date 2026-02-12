import React, { useState, useEffect } from 'react';
import { PeraWalletConnect } from '@perawallet/connect';
import { StudentExam } from './components/StudentExam';
import { AdminDashboard } from './components/AdminDashboard';
import { setAppId, submitProofToBlockchain, getExplorerUrl } from './services/algorand-service';
import './App.css';

// Initialize Pera Wallet
const peraWallet = new PeraWalletConnect();

// Algorand App ID
const APP_ID = 755317770;

interface Exam {
  examId: string;
  duration: number;
  minTrustScore: number;
  createdAt: number;
  createdBy: string;
}

const App: React.FC = () => {
  const [accountAddress, setAccountAddress] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentView, setCurrentView] = useState<'home' | 'student' | 'admin' | 'create-exam'>('home');
  const [examId, setExamId] = useState('');
  const [studentId, setStudentId] = useState('');
  const [selectedExam, setSelectedExam] = useState<Exam | null>(null);
  
  // Create exam form
  const [newExamId, setNewExamId] = useState('');
  const [newExamDuration, setNewExamDuration] = useState(60);
  const [newExamMinScore, setNewExamMinScore] = useState(70);

  useEffect(() => {
    setAppId(APP_ID);
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

  const handleExamComplete = async (sessionData: any) => {
    console.log('📊 Exam completed:', sessionData);
    
    // Save to localStorage
    const proofs = JSON.parse(localStorage.getItem('zkp_vault_proofs') || '[]');
    proofs.push({
      examId: sessionData.examId,
      studentHash: sessionData.studentHash,
      trustScore: sessionData.trustScore,
      proofHash: sessionData.proofHash,
      timestamp: sessionData.endTime || Date.now(),
      incidents: sessionData.incidents.length,
    });
    localStorage.setItem('zkp_vault_proofs', JSON.stringify(proofs));
    
    // Try blockchain submission
    try {
      if (accountAddress) {
        const txId = await submitProofToBlockchain(sessionData, accountAddress, signTransactions);
        const explorerUrl = getExplorerUrl(txId);
        alert(`✅ Exam completed!\n\nTrust Score: ${sessionData.trustScore}\nProof Hash: ${sessionData.proofHash}\n\nView on Algorand Explorer:\n${explorerUrl}`);
      } else {
        alert(`✅ Exam completed locally!\n\nTrust Score: ${sessionData.trustScore}\nIncidents: ${sessionData.incidents.length}\n\n(Connect wallet to submit to blockchain)`);
      }
    } catch (error) {
      console.error('Blockchain submission error:', error);
      alert(`✅ Exam completed and saved locally!\n\nTrust Score: ${sessionData.trustScore}\n\n(Blockchain submission failed, but proof is saved)`);
    }
    
    setCurrentView('home');
  };

  const handleCreateExam = () => {
    if (!newExamId.trim()) {
      alert('Please enter an exam ID');
      return;
    }
    
    // Check if exam already exists
    const exams = JSON.parse(localStorage.getItem('zkp_vault_exams') || '[]');
    if (exams.some((e: Exam) => e.examId === newExamId)) {
      alert('An exam with this ID already exists!');
      return;
    }
    
    exams.push({
      examId: newExamId,
      duration: newExamDuration,
      minTrustScore: newExamMinScore,
      createdAt: Date.now(),
      createdBy: accountAddress || 'unknown',
    });
    localStorage.setItem('zkp_vault_exams', JSON.stringify(exams));
    
    alert(`✅ Exam "${newExamId}" created successfully!`);
    
    // Reset form
    setNewExamId('');
    setNewExamDuration(60);
    setNewExamMinScore(70);
    setCurrentView('home');
  };

  const handleStartExam = () => {
    if (!examId.trim()) {
      alert('Please enter an exam ID');
      return;
    }
    
    if (!studentId.trim()) {
      alert('Please enter your student ID');
      return;
    }
    
    // Check if exam exists
    const exams = JSON.parse(localStorage.getItem('zkp_vault_exams') || '[]');
    const exam = exams.find((e: Exam) => e.examId === examId);
    
    if (!exam) {
      alert(`Exam "${examId}" not found!\n\nPlease check the exam ID or ask your instructor to create it.`);
      return;
    }
    
    setSelectedExam(exam);
    setCurrentView('student');
  };

  const renderCreateExam = () => (
    <div className="create-exam-view">
      <div className="view-header">
        <button className="back-btn" onClick={() => setCurrentView('home')}>
          ← Back to Home
        </button>
        <button className="disconnect-btn" onClick={handleDisconnectWallet}>
          Disconnect Wallet
        </button>
      </div>

      <div className="create-exam-container">
        <h1>Create New Exam</h1>
        <p className="subtitle">Set up a new proctored exam for students</p>

        <div className="form-section">
          <div className="form-group">
            <label>Exam ID *</label>
            <input
              type="text"
              value={newExamId}
              onChange={(e) => setNewExamId(e.target.value)}
              placeholder="e.g., CS101_FINAL_2024"
            />
            <small>Use a unique identifier for this exam</small>
          </div>

          <div className="form-group">
            <label>Duration (minutes) *</label>
            <input
              type="number"
              value={newExamDuration}
              onChange={(e) => setNewExamDuration(parseInt(e.target.value) || 60)}
              min="1"
              max="300"
            />
            <small>How long students have to complete the exam</small>
          </div>

          <div className="form-group">
            <label>Minimum Trust Score *</label>
            <input
              type="number"
              value={newExamMinScore}
              onChange={(e) => setNewExamMinScore(parseInt(e.target.value) || 70)}
              min="0"
              max="100"
            />
            <small>Minimum score required to pass integrity check (0-100)</small>
          </div>

          <button className="action-btn create-btn" onClick={handleCreateExam}>
            ✓ Create Exam
          </button>
        </div>

        <div className="info-box">
          <h3>ℹ️ How It Works</h3>
          <ul>
            <li>Students use the Exam ID to start their proctored exam</li>
            <li>AI monitors in real-time for integrity violations</li>
            <li>Trust scores are calculated based on detected incidents</li>
            <li>Proofs are submitted to Algorand blockchain</li>
          </ul>
        </div>
      </div>
    </div>
  );

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
              <label>Exam ID *</label>
              <input
                type="text"
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
                placeholder="e.g., CS101_FINAL_2024"
              />
              <small>Enter the exam ID provided by your instructor</small>
            </div>
            
            <div className="form-group">
              <label>Student ID *</label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g., STU12345"
              />
              <small>Your unique student identifier</small>
            </div>

            <button
              className="action-btn student-btn"
              onClick={handleStartExam}
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
              <label>Exam ID to Monitor *</label>
              <input
                type="text"
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
                placeholder="e.g., CS101_FINAL_2024"
              />
              <small>View submissions for this exam</small>
            </div>

            <button
              className="action-btn admin-btn"
              onClick={() => setCurrentView('admin')}
              disabled={!examId}
            >
              Open Dashboard →
            </button>
          </div>

          <div className="action-card">
            <div className="card-icon">➕</div>
            <h3>Create Exam</h3>
            <p>Set up a new proctored exam for students</p>

            <button
              className="action-btn create-btn"
              onClick={() => setCurrentView('create-exam')}
            >
              Create New Exam →
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
    </div>
  );

  const renderStudent = () => (
    <div className="student-view">
      <div className="view-header">
        <button className="back-btn" onClick={() => {
          setCurrentView('home');
          setSelectedExam(null);
        }}>
          ← Back to Home
        </button>
        <button className="disconnect-btn" onClick={handleDisconnectWallet}>
          Disconnect Wallet
        </button>
      </div>
      {selectedExam && (
        <StudentExam
          examId={selectedExam.examId}
          studentId={studentId}
          examDuration={selectedExam.duration}
          onComplete={handleExamComplete}
        />
      )}
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
      {currentView === 'create-exam' && renderCreateExam()}
    </div>
  );
};

export default App;