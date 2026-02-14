import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { submitProofToBlockchain } from './services/algorand-service';
import './StudentExam.css';

// --- Types for exam questions (can be moved to a separate file) ---
interface Question {
  id: string;
  text: string;
  options: string[];
  correctAnswer?: string;
}

interface Exam {
  examId: string;
  title: string;
  duration: number; // minutes
  questions: Question[];
  createdAt: number;
  createdBy?: string;
}

interface StudentExamProps {
  examId: string;
  studentId: string;
  examDuration: number; // fallback if exam not found
  onComplete: (sessionData: any) => void;
}

interface Incident {
  type: 'no_face' | 'multi_face' | 'looking_away' | 'phone_detected';
  timestamp: number;
  details: string;
}

export const StudentExam: React.FC<StudentExamProps> = ({
  examId,
  studentId,
  examDuration,
  onComplete,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const detectionIntervalRef = useRef<any>(null);

  // Models
  const [faceModel, setFaceModel] = useState<any>(null);
  const [objectModel, setObjectModel] = useState<any>(null);

  // State
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProctoring, setIsProctoring] = useState(false);
  const [webcamError, setWebcamError] = useState<string | null>(null);

  // Detection data
  const [currentFaceCount, setCurrentFaceCount] = useState(0);
  const [currentPhoneDetected, setCurrentPhoneDetected] = useState(false);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [trustScore, setTrustScore] = useState(100);

  // Timer – will be updated after exam loads
  const [timeRemaining, setTimeRemaining] = useState(examDuration * 60);

  // Consecutive counters
  const consecutiveNoFaceRef = useRef(0);
  const consecutiveMultiFaceRef = useRef(0);
  const lastIncidentTimeRef = useRef<Record<string, number>>({});

  // Exam content
  const [examData, setExamData] = useState<Exam | null>(null);
  const [currentAnswers, setCurrentAnswers] = useState<Record<string, string>>({});
  const [loadingExam, setLoadingExam] = useState(true);

  // Load exam data from localStorage
  useEffect(() => {
    const loadExam = async () => {
      setLoadingExam(true);
      try {
        const stored = localStorage.getItem('zkp_vault_exams');
        if (stored) {
          const exams: Exam[] = JSON.parse(stored);
          const found = exams.find(e => e.examId === examId);
          setExamData(found || null);
          if (found) {
            // Override timer with loaded exam duration
            setTimeRemaining(found.duration * 60);
          }
        }
      } catch (err) {
        console.error('Failed to load exam:', err);
      } finally {
        setLoadingExam(false);
      }
    };
    loadExam();
  }, [examId]);

  // Initialize models and webcam
  useEffect(() => {
    const init = async () => {
      try {
        console.log('🚀 Starting initialization...');
        await tf.setBackend('webgl');
        await tf.ready();
        console.log('✅ TensorFlow ready');

        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise(resolve => {
            if (videoRef.current) videoRef.current.onloadedmetadata = resolve;
          });
          console.log('✅ Webcam started');
        }

        console.log('📥 Loading BlazeFace...');
        const blazeface = await import('@tensorflow-models/blazeface');
        const face = await blazeface.load();
        setFaceModel(face);
        console.log('✅ BlazeFace loaded');

        console.log('📥 Loading COCO-SSD...');
        const obj = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
        setObjectModel(obj);
        console.log('✅ COCO-SSD loaded');

        setIsInitializing(false);
        console.log('🎉 Initialization complete!');
      } catch (error) {
        console.error('❌ Initialization error:', error);
        setWebcamError('Failed to initialize. Please allow camera access and refresh.');
        setIsInitializing(false);
      }
    };

    init();

    return () => {
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);
    };
  }, []);

  // Timer countdown
  useEffect(() => {
    if (!isProctoring) return;
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          handleEndExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isProctoring]);

  const handleStartProctoring = () => {
    if (!examData) {
      alert('Exam data not loaded yet. Please wait.');
      return;
    }
    if (!faceModel || !objectModel) {
      alert('AI models not loaded yet. Please wait a moment.');
      return;
    }
    console.log('▶️ Starting exam proctoring...');
    setIsProctoring(true);
    detectionIntervalRef.current = setInterval(async () => {
      await runDetection();
    }, 500);
  };

  const runDetection = async () => {
    if (!videoRef.current || !faceModel || !objectModel) return;
    try {
      const faces = await faceModel.estimateFaces(videoRef.current, false);
      const faceCount = faces.filter((f: any) => {
        const conf = Array.isArray(f.probability) ? f.probability[0] : f.probability;
        return conf > 0.5;
      }).length;
      setCurrentFaceCount(faceCount);

      const objects = await objectModel.detect(videoRef.current);
      const phoneDetected = objects.some(
        (obj: any) => obj.class === 'cell phone' && obj.score > 0.3
      );
      setCurrentPhoneDetected(phoneDetected);

      checkIncidents(faceCount, phoneDetected);
      drawOverlay(faceCount, phoneDetected);
    } catch (error) {
      console.error('Detection error:', error);
    }
  };

  const checkIncidents = (faceCount: number, phoneDetected: boolean) => {
    const now = Date.now();
    const canLog = (type: string) => (now - (lastIncidentTimeRef.current[type] || 0)) > 3000;

    if (faceCount === 0) {
      consecutiveNoFaceRef.current++;
      if (consecutiveNoFaceRef.current > 5 && canLog('no_face')) {
        addIncident('no_face', 'No face detected');
        consecutiveNoFaceRef.current = 0;
      }
    } else {
      consecutiveNoFaceRef.current = 0;
    }

    if (faceCount > 1) {
      consecutiveMultiFaceRef.current++;
      if (consecutiveMultiFaceRef.current > 3 && canLog('multi_face')) {
        addIncident('multi_face', `${faceCount} faces detected`);
        consecutiveMultiFaceRef.current = 0;
      }
    } else {
      consecutiveMultiFaceRef.current = 0;
    }

    if (phoneDetected && canLog('phone_detected')) {
      addIncident('phone_detected', 'Mobile phone detected');
    }
  };

  const addIncident = (type: Incident['type'], details: string) => {
    const incident: Incident = { type, timestamp: Date.now(), details };
    console.log(`🚨 INCIDENT: ${type} - ${details}`);
    setIncidents(prev => {
      const newIncidents = [...prev, incident];
      let penalty = 0;
      if (type === 'no_face') penalty = 5;
      if (type === 'multi_face') penalty = 10;
      if (type === 'phone_detected') penalty = 15;
      setTrustScore(current => Math.max(0, current - penalty));
      return newIncidents;
    });
    lastIncidentTimeRef.current[type] = Date.now();
  };

  const drawOverlay = (faceCount: number, phoneDetected: boolean) => {
    if (!canvasRef.current || !videoRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = faceCount === 1 && !phoneDetected ? '#00ff00' : '#ff0000';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#00ff88';
    ctx.fillText('🔒 Privacy Protected', 20, 40);

    const indicators = [
      { label: `Faces: ${faceCount}`, ok: faceCount === 1 },
      { label: `Phone: ${phoneDetected ? 'YES' : 'NO'}`, ok: !phoneDetected },
    ];
    let y = canvas.height - 60;
    indicators.forEach(ind => {
      ctx.fillStyle = ind.ok ? '#00ff88' : '#ff6b6b';
      ctx.font = '16px Arial';
      ctx.fillText(ind.label, 20, y);
      y += 25;
    });
  };

  // Compute academic score based on correct answers
  const computeAcademicScore = (): number => {
    if (!examData) return 0;
    let correct = 0;
    examData.questions.forEach(q => {
      const studentAnswer = currentAnswers[q.id];
      if (q.correctAnswer && studentAnswer === q.correctAnswer) {
        correct++;
      }
    });
    return examData.questions.length > 0
      ? Math.round((correct / examData.questions.length) * 100)
      : 0;
  };

  const handleEndExam = async () => {
    console.log('⏹️ Ending exam...');
    setIsProctoring(false);
    if (detectionIntervalRef.current) clearInterval(detectionIntervalRef.current);

    // Generate student hash
    const encoder = new TextEncoder();
    const data = encoder.encode(`${studentId}_zkp-vault`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const studentHash = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const academicScore = computeAcademicScore();

    // Generate proof hash (includes academic score and answers)
    const proofData = {
      examId,
      studentHash,
      trustScore,
      academicScore,
      incidents: incidents.length,
      timestamp: Date.now(),
      answers: currentAnswers,
    };
    const proofJSON = JSON.stringify(proofData);
    const proofBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(proofJSON));
    const proofArray = Array.from(new Uint8Array(proofBuffer));
    const proofHash = '0x' + proofArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const sessionData = {
      examId,
      studentId,
      studentHash,
      startTime: Date.now() - ((examData?.duration || examDuration) * 60 - timeRemaining) * 1000,
      endTime: Date.now(),
      incidents,
      trustScore,
      academicScore,
      proofHash,
      detections: [],
      answers: currentAnswers,
      examData,
    };

    // Save proof to localStorage (for AdminDashboard)
    const allProofs = JSON.parse(localStorage.getItem('zkp_vault_proofs') || '[]');
    const newProof = {
      studentHash,
      trustScore,
      academicScore,
      proofHash,
      timestamp: Date.now(),
      examId,
      incidents: incidents.length,
    };
    allProofs.push(newProof);
    localStorage.setItem('zkp_vault_proofs', JSON.stringify(allProofs));

    onComplete(sessionData);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAnswerChange = (questionId: string, value: string) => {
    setCurrentAnswers(prev => ({ ...prev, [questionId]: value }));
  };

   return (
    <div className="student-exam">
      <div className="exam-header">
        <h2>ZKP-Vault Exam: {examId}</h2>
        {isProctoring && (
          <div className="time-remaining">Time Remaining: {formatTime(timeRemaining)}</div>
        )}
      </div>

      <div className="exam-content" style={{ display: 'flex', gap: '20px' }}>
        {/* LEFT COLUMN: Questions (60%) */}
        <div className="exam-questions-section" style={{ flex: '0 0 60%' }}>
          {loadingExam ? (
            <div className="loading-state">Loading questions...</div>
          ) : examData ? (
            <>
              <h3>{examData.title}</h3>
              {examData.questions.map((question, index) => (
                <div key={question.id} className="question-card">
                  <p><strong>Q{index + 1}:</strong> {question.text}</p>
                  <div className="options">
                    {question.options.map((option, optIndex) => (
                      <label key={optIndex}>
                        <input
                          type="radio"
                          name={`question_${question.id}`}
                          value={option}
                          checked={currentAnswers[question.id] === option}
                          onChange={() => handleAnswerChange(question.id, option)}
                          disabled={!isProctoring}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <div className="error-message">Exam not found. Please check the Exam ID.</div>
          )}
        </div>

        {/* RIGHT COLUMN: Camera + Status (40%) */}
        <div className="status-section" style={{ flex: '0 0 40%' }}>
          {/* Camera and controls (moved from bottom) */}
          <div className="video-section" style={{ marginBottom: '20px' }}>
            <div className="video-container">
              <video ref={videoRef} autoPlay playsInline muted className="webcam-feed" />
              <canvas ref={canvasRef} className="detection-overlay" />
            </div>

            {webcamError && <div className="error-message">{webcamError}</div>}
            {isInitializing && !webcamError && (
              <div className="loading-message">Initializing AI models... Please wait.</div>
            )}

            {!isProctoring && !isInitializing && !webcamError && (
              <button className="start-button" onClick={handleStartProctoring}>
                Start Exam
              </button>
            )}

            {isProctoring && (
              <button className="end-button" onClick={handleEndExam}>
                Submit Exam
              </button>
            )}
          </div>

          {/* Status Cards (privacy, trust score, etc.) */}
          <div className="privacy-status">
            <div className="status-icon">🟢</div>
            <div className="status-text">
              <h3>Privacy Protected</h3>
              <p>No video data leaves this device</p>
            </div>
          </div>

          <div className="trust-score">
            <h4>Trust Score</h4>
            <div className="score-bar">
              <div
                className="score-fill"
                style={{
                  width: `${trustScore}%`,
                  backgroundColor: trustScore >= 80 ? '#00ff00' : trustScore >= 60 ? '#ffaa00' : '#ff0000',
                }}
              />
            </div>
            <div className="score-value">{trustScore}</div>
          </div>

          <div className="detection-status">
            <h4>Current Status</h4>
            <div className="status-item">
              <span className={currentFaceCount === 1 ? 'status-ok' : 'status-warning'}>
                {currentFaceCount === 1 ? '✅' : '⚠️'}
              </span>
              Face Count: {currentFaceCount}
            </div>
            <div className="status-item">
              <span className={!currentPhoneDetected ? 'status-ok' : 'status-warning'}>
                {!currentPhoneDetected ? '✅' : '⚠️'}
              </span>
              Phone: {currentPhoneDetected ? 'DETECTED' : 'None'}
            </div>
          </div>

          <div className="incidents-log">
            <h4>Incidents: {incidents.length}</h4>
            {incidents.length > 0 && (
              <div className="incident-list">
                {incidents.slice(-5).reverse().map((incident, idx) => (
                  <div key={idx} className="incident-item">
                    <span className="incident-type">{incident.type.replace('_', ' ')}</span>
                    <span className="incident-time">
                      {new Date(incident.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="ai-status">
            <p>🤖 Local AI Processing Active</p>
            <p className="small-text">Detection running every 0.5 seconds</p>
          </div>
        </div>
      </div>
    </div>
  );
};
