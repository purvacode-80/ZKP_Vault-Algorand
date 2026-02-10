# ZKP-Vault: Privacy-Preserving AI Proctoring on Algorand

## 🎯 Project Overview

**ZKP-Vault** is a revolutionary exam proctoring system that combines:
- **Local AI Processing** - Face detection, gaze tracking, and phone detection run entirely in the browser
- **Blockchain Trust** - Immutable cryptographic proofs stored on Algorand
- **Zero-Knowledge Privacy** - Video never leaves the student's device

### The Problem We Solve
Traditional AI proctoring systems violate student privacy by:
- Recording and uploading webcam video
- Storing sensitive biometric data on centralized servers
- Creating data breach risks
- Requiring blind trust in institutions

### Our Solution
- ✅ **100% Local Processing**: AI runs in the student's browser using TensorFlow.js
- ✅ **No Video Upload**: Only trust scores and cryptographic proofs are transmitted
- ✅ **Blockchain Verification**: Immutable proofs on Algorand ensure transparency
- ✅ **Privacy-First**: Student identities are hashed, no PII on blockchain
- ✅ **ZKP-Ready**: Architected for future ZK-SNARK verification with AlgoPlonk

---

## 📦 Project Structure

```
zkp_vault/
├── projects/
│   ├── zkp_vault-contracts/              # Smart Contracts
│   │   ├── smart_contracts/
│   │   │   └── zkp_vault/
│   │   │       └── contract.py           # Main Algorand smart contract
│   │   └── tests/
│   │
│   └── zkp_vault-frontend/               # React Frontend
│       ├── src/
│       │   ├── components/
│       │   │   ├── StudentExam.tsx       # Student exam interface
│       │   │   ├── StudentExam.css
│       │   │   ├── AdminDashboard.tsx    # Admin dashboard
│       │   │   └── AdminDashboard.css
│       │   ├── services/
│       │   │   ├── ai-proctor-service.ts # AI detection logic
│       │   │   └── algorand-service.ts   # Blockchain integration
│       │   ├── App.tsx                   # Main application
│       │   └── App.css
│       └── package.json
│
└── docs/
    ├── SETUP_GUIDE.md                    # Deployment instructions
    └── ARCHITECTURE.md                   # Technical deep dive
```

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
# Backend (Smart Contracts)
cd zkp_vault/projects/zkp_vault-contracts
algokit project bootstrap all

# Frontend
cd ../zkp_vault-frontend
npm install
```

### 2. Deploy Smart Contract
```bash
cd zkp_vault/projects/zkp_vault-contracts

# Deploy to TestNet
algokit project deploy testnet

# Save the App ID from output
```

### 3. Configure Frontend
```bash
# Update App.tsx with your App ID
# Line 7: const APP_ID = YOUR_APP_ID_HERE;
```

### 4. Run Development Server
```bash
cd zkp_vault/projects/zkp_vault-frontend
npm run dev
```

### 5. Open in Browser
```
http://localhost:5173
```

---

## 🔑 Key Features

### For Students
- **Privacy Guarantee**: Video processing happens locally, nothing uploaded
- **Real-time Feedback**: See AI detections with visual overlays
- **Trust Score**: Live score based on behavior during exam
- **Blockchain Proof**: Immutable certificate of exam integrity

### For Instructors
- **No Video Access**: Can't see student recordings (by design)
- **Dashboard Analytics**: View aggregated trust scores
- **Blockchain Verification**: Every proof is verifiable on Algorand Explorer
- **Automated Monitoring**: No manual proctoring required

### Technical Highlights
- **AI Models**:
  - BlazeFace for face detection
  - COCO-SSD for object detection (phones)
  - Custom gaze estimation algorithms
  
- **Blockchain**:
  - PyTeal smart contracts
  - Box storage for proofs
  - ASA/NFT minting capability
  - AlgoPlonk-compatible architecture

---

## 🛠️ Technology Stack

### Frontend
- **React** 18.2 + TypeScript
- **TensorFlow.js** 4.15 - Browser-based ML
- **BlazeFace** - Face detection model
- **COCO-SSD** - Object detection
- **AlgoSDK** 2.7 - Algorand integration
- **Pera Wallet** - Wallet connection

### Backend (Smart Contracts)
- **Python** 3.10+
- **AlgoPy** (PyTeal) - Smart contract language
- **AlgoKit** - Development framework

### Blockchain
- **Algorand** TestNet/MainNet
- **Box Storage** - On-chain data storage
- **ASA** - Asset creation for proofs

---

## 📊 How It Works

### Student Flow
```
1. Connect Pera Wallet
2. Enter Exam ID & Student ID
3. Grant camera permission
4. AI monitors in real-time
   ├─ Face count (must be 1)
   ├─ Gaze direction (looking at screen)
   └─ Phone detection (not allowed)
5. Complete exam
6. Generate proof hash (SHA-256)
7. Submit to Algorand blockchain
8. Receive confirmation + Explorer link
```

### Admin Flow
```
1. Connect Pera Wallet
2. Create exam with:
   ├─ Exam ID
   ├─ Duration
   └─ Minimum trust score
3. Share exam link with students
4. Monitor submissions in dashboard
5. View proofs on Algorand Explorer
6. Export analytics report
```

---

## 🔐 Privacy Architecture

### What Stays Local (Never Uploaded)
- ❌ Video frames
- ❌ Student face images
- ❌ Webcam recordings
- ❌ Personal identifiable information

### What Goes to Blockchain
- ✅ Hashed student ID (SHA-256)
- ✅ Trust score (0-100)
- ✅ Proof hash (cryptographic signature)
- ✅ Timestamp
- ✅ Exam ID

### Identity Protection
```javascript
// Student ID hashing example
const studentHash = SHA256(studentId + salt)
// Output: 0x4f2a1b8c3d9e7f...
// Irreversible and anonymous
```

---

## 🧪 Testing Guide

### Local Testing
1. Start AlgoKit LocalNet
   ```bash
   algokit localnet start
   ```

2. Deploy contract locally
   ```bash
   algokit project deploy localnet
   ```

3. Get test ALGO from faucet
   ```bash
   algokit goal clerk send -a 1000000 -f YOUR_ADDRESS -t YOUR_ADDRESS
   ```

4. Test student exam flow
5. Verify proof in admin dashboard

### TestNet Testing
1. Deploy to TestNet
2. Get free TestNet ALGO: https://bank.testnet.algorand.network/
3. Run full demo scenario
4. Verify on Algorand Explorer

---

## 📈 Demo Metrics (Expected)

### Performance
- **AI Processing**: ~30 FPS on modern laptops
- **Transaction Time**: 4-5 seconds (Algorand)
- **Model Load Time**: 3-5 seconds (first load)
- **Transaction Cost**: ~0.001 ALGO (~$0.0003)

### Scalability
- **Students per Exam**: Unlimited
- **Concurrent Exams**: Unlimited
- **Proof Storage**: Persistent on-chain
- **Box Storage Cost**: ~0.0025 ALGO per proof

---

## 🏆 Hackathon Advantages

### Addresses All Theme Requirements
| Theme | Our Implementation |
|-------|-------------------|
| **Trust** | Blockchain immutability, no central authority |
| **Privacy** | Zero video upload, local-only processing |
| **Automation** | AI replaces manual proctoring |
| **Verifiable Records** | On-chain proofs, publicly auditable |
| **No Centralization** | Smart contracts govern, not institutions |

### Innovation Points
1. **First True Privacy-Preserving Proctor**: No competitor offers local-only AI
2. **Real-World Campus Use Case**: Immediately deployable for universities
3. **Deep Algorand Integration**: Smart contracts, box storage, ASA, AlgoPlonk-ready
4. **Beginner-Friendly**: Simple UI, clear documentation
5. **Production-Ready MVP**: Not just a concept, fully functional

---

## 🔮 Roadmap

### Phase 1: MVP (Hackathon) ✅
- [x] Local AI detection (face, gaze, phone)
- [x] Algorand smart contract
- [x] Student exam interface
- [x] Admin dashboard
- [x] Wallet integration
- [x] Proof submission

### Phase 2: Enhancement
- [ ] Full ZK-SNARK implementation (AlgoPlonk)
- [ ] Advanced gaze algorithms
- [ ] Multi-exam management
- [ ] Email notifications
- [ ] PDF report generation
- [ ] Mobile app (React Native)

### Phase 3: Production
- [ ] Security audit
- [ ] MainNet deployment
- [ ] University partnerships
- [ ] LMS integration (Canvas, Moodle)
- [ ] Federated learning for AI improvement

---

## 📚 Documentation

### For Developers
- `SETUP_GUIDE.md` - Complete setup and deployment instructions
- Smart contract code comments
- Frontend service documentation

### For Users
- Student quick start guide (in app)
- Admin user manual (in app)
- Privacy policy explanation

### For Judges
- Architecture deep dive
- Technical decision rationale
- Innovation highlights
- Demo script

---

## 🎬 Demo Preparation

### Pre-Demo Checklist
- [ ] Smart contract deployed to TestNet
- [ ] Frontend deployed to Vercel
- [ ] Wallet funded with TestNet ALGO
- [ ] Camera/webcam tested
- [ ] Test exam created
- [ ] Mock proof submitted successfully
- [ ] Algorand Explorer link working
- [ ] Slides prepared
- [ ] Backup video recorded

### 3-Minute Demo Script
**0:00-0:30** - Problem statement + our solution
**0:30-2:00** - Live student exam demo
**2:00-2:30** - Admin dashboard + blockchain verification
**2:30-3:00** - Technical highlights + Q&A

---

## 🤝 Contributing

This is a hackathon project, but contributions are welcome!

### How to Contribute
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

### Areas for Contribution
- Improved AI models
- UI/UX enhancements
- Additional language support
- Bug fixes
- Documentation improvements

---

## 📄 License

MIT License - Open source for educational purposes

---

## 👥 Team

Built for the **AI and Automation in Blockchain** Hackathon

- Privacy-focused design
- Campus-first approach
- Algorand ecosystem integration

---

## 🙏 Acknowledgments

- **Algorand Foundation** - For the incredible blockchain platform
- **TensorFlow.js Team** - For enabling browser-based ML
- **AlgoKit Team** - For the amazing developer tools
- **Pera Wallet** - For seamless wallet integration

---

## 📞 Support

For questions, issues, or feedback:
- Open an issue in the repository
- Check `SETUP_GUIDE.md` for troubleshooting
- Review code comments for implementation details

---

## 🌟 Why ZKP-Vault Will Win

1. **Solves a Real Problem**: Privacy violation in current proctoring systems
2. **Perfect Theme Fit**: AI + Blockchain + Privacy + Campus use case
3. **Technical Excellence**: Clean code, modern stack, production-ready
4. **Innovation**: First local-only AI proctor with blockchain verification
5. **Impact**: Immediately deployable for universities worldwide
6. **Algorand Depth**: Smart contracts, box storage, ASA, AlgoPlonk-ready
7. **User Experience**: Beautiful UI, intuitive flow, clear privacy messaging
8. **Completeness**: Full stack solution, not just a concept

---

**ZKP-Vault: Where Privacy Meets Trust** 🔒⛓️

---

## 🚀 Get Started Now!

```bash
# Clone and setup
git clone <your-repo>
cd zkp_vault

# Follow SETUP_GUIDE.md
cat docs/SETUP_GUIDE.md

# Start building the future of privacy-preserving proctoring!
```

