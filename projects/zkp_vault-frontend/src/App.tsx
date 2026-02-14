import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { StudentDashboard } from './components/StudentDashboard';
import { AdminHome } from './components/AdminHome';
import { PeraWalletConnect } from '@perawallet/connect';
import './App.css';

// Pera Wallet instance
const peraWallet = new PeraWalletConnect();

function App() {
  const [accountAddress, setAccountAddress] = useState<string | null>(null);
  const [isWalletConnecting, setIsWalletConnecting] = useState(false);

  // Reconnect wallet session on mount
  useEffect(() => {
    peraWallet.reconnectSession()
      .then((accounts) => {
        if (accounts.length) setAccountAddress(accounts[0]);
      })
      .catch((e) => console.log('No saved session', e));
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

  return (
    <AuthProvider>
      <AppContent
        accountAddress={accountAddress}
        isWalletConnecting={isWalletConnecting}
        connectWallet={connectWallet}
        disconnectWallet={disconnectWallet}
      />
    </AuthProvider>
  );
}

interface AppContentProps {
  accountAddress: string | null;
  isWalletConnecting: boolean;
  connectWallet: () => void;
  disconnectWallet: () => void;
}

const AppContent: React.FC<AppContentProps> = ({
  accountAddress,
  isWalletConnecting,
  connectWallet,
  disconnectWallet,
}) => {
  const { user } = useAuth();
  const [isLoginView, setIsLoginView] = useState(true);

  if (!user) {
    // Show login/signup with wallet connection
    return (
      <div className="auth-container">
        <div className="auth-card">
          {/* Wallet connection section */}
          <div style={{ textAlign: 'center', marginBottom: '20px' }}>
            {!accountAddress ? (
              <button
                className="connect-wallet-btn"
                onClick={connectWallet}
                disabled={isWalletConnecting}
                style={{ width: '100%' }}
              >
                {isWalletConnecting ? 'Connecting...' : '🔌 Connect Pera Wallet'}
              </button>
            ) : (
              <div className="connected-info" style={{ justifyContent: 'center' }}>
                <span className="wallet-address">
                  <code>{accountAddress.slice(0, 6)}...{accountAddress.slice(-4)}</code>
                </span>
                <button className="disconnect-btn" onClick={disconnectWallet}>
                  Disconnect
                </button>
              </div>
            )}
          </div>

          {/* Authentication forms */}
          {isLoginView ? (
            <Login onToggleForm={() => setIsLoginView(false)} walletAddress={accountAddress} />
          ) : (
            <Signup onToggleForm={() => setIsLoginView(true)} walletAddress={accountAddress} />
          )}
        </div>
      </div>
    );
  }

  // User is logged in – show role‑specific dashboard
  if (user.role === 'student') {
    return <StudentDashboard />;
  } else {
    return <AdminHome />;
  }
};

export default App;
