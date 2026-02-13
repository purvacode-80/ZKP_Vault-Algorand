import React, { useEffect, useRef, useState } from 'react';
import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { submitProofToBlockchain } from '../services/algorand-service';
import './StudentExam.css';

interface StudentExamProps {
  examId: string;
  studentId: string;
  examDuration: number;
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
  
  // Timer
  const [timeRemaining, setTimeRemaining] = useState(examDuration * 60);
  
  // Consecutive counters
  const consecutiveNoFaceRef = useRef(0);
  const consecutiveMultiFaceRef = useRef(0);
  const lastIncidentTimeRef = useRef<Record<string, number>>({});

  // Initialize models and webcam
  useEffect(() => {
    const init = async () => {
      try {
        console.log('🚀 Starting initialization...');
        
        // Initialize TensorFlow
        await tf.setBackend('webgl');
        await tf.ready();
        console.log('✅ TensorFlow ready');

        // Start webcam
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await new Promise(resolve => {
            if (videoRef.current) {
              videoRef.current.onloadedmetadata = resolve;
            }
          });
          console.log('✅ Webcam started');
        }

        // Load BlazeFace
        console.log('📥 Loading BlazeFace...');
        const blazeface = await import('@tensorflow-models/blazeface');
        const face = await blazeface.load();
        setFaceModel(face);
        console.log('✅ BlazeFace loaded');

        // Load COCO-SSD
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
      // Cleanup
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (detectionIntervalRef.current) {
        clearInterval(detectionIntervalRef.current);
      }
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

  // Start proctoring
  const handleStartProctoring = () => {
    if (!faceModel || !objectModel) {
      alert('AI models not loaded yet. Please wait a moment.');
      return;
    }

    console.log('▶️ Starting exam proctoring...');
    setIsProctoring(true);
    
    // Start detection loop - runs every 500ms
    detectionIntervalRef.current = setInterval(async () => {
      await runDetection();
    }, 500);
  };

  // Main detection function
  const runDetection = async () => {
    if (!videoRef.current || !faceModel || !objectModel) return;

    try {
      // Detect faces
      const faces = await faceModel.estimateFaces(videoRef.current, false);
      const faceCount = faces.filter((f: any) => {
        const conf = Array.isArray(f.probability) ? f.probability[0] : f.probability;
        return conf > 0.5;
      }).length;

      setCurrentFaceCount(faceCount);

      // Detect objects
      const objects = await objectModel.detect(videoRef.current);
      const phoneDetected = objects.some(
        (obj: any) => obj.class === 'cell phone' && obj.score > 0.3
      );

      setCurrentPhoneDetected(phoneDetected);

      // Log occasionally
      if (Math.random() < 0.1) {
        console.log(`📊 Detection: ${faceCount} face(s), phone: ${phoneDetected}`);
        if (objects.length > 0) {
          console.log('🔍 Objects:', objects.map((o: any) => `${o.class} (${(o.score*100).toFixed(1)}%)`));
        }
      }

      // Check for incidents
      checkIncidents(faceCount, phoneDetected);

      // Draw overlays
      drawOverlay(faceCount, phoneDetected);

    } catch (error) {
      console.error('Detection error:', error);
    }
  };

  // Check for incidents
  const checkIncidents = (faceCount: number, phoneDetected: boolean) => {
    const now = Date.now();
    const canLog = (type: string) => {
      const lastTime = lastIncidentTimeRef.current[type] || 0;
      return now - lastTime > 3000; // 3 second cooldown
    };

    // No face
    if (faceCount === 0) {
      consecutiveNoFaceRef.current++;
      if (consecutiveNoFaceRef.current > 5 && canLog('no_face')) {
        addIncident('no_face', 'No face detected');
        consecutiveNoFaceRef.current = 0;
      }
    } else {
      consecutiveNoFaceRef.current = 0;
    }

    // Multiple faces
    if (faceCount > 1) {
      consecutiveMultiFaceRef.current++;
      if (consecutiveMultiFaceRef.current > 3 && canLog('multi_face')) {
        addIncident('multi_face', `${faceCount} faces detected`);
        consecutiveMultiFaceRef.current = 0;
      }
    } else {
      consecutiveMultiFaceRef.current = 0;
    }

    // Phone detected
    if (phoneDetected && canLog('phone_detected')) {
      addIncident('phone_detected', 'Mobile phone detected');
    }
  };

  // Add incident
  const addIncident = (type: Incident['type'], details: string) => {
    const incident: Incident = {
      type,
      timestamp: Date.now(),
      details,
    };

    console.log(`🚨 INCIDENT: ${type} - ${details}`);
    
    setIncidents(prev => {
      const newIncidents = [...prev, incident];
      
      // Update trust score
      let penalty = 0;
      if (type === 'no_face') penalty = 5;
      if (type === 'multi_face') penalty = 10;
      if (type === 'phone_detected') penalty = 15;
      
      setTrustScore(current => Math.max(0, current - penalty));
      
      return newIncidents;
    });

    lastIncidentTimeRef.current[type] = Date.now();
  };

  // Draw overlay on canvas
  const drawOverlay = (faceCount: number, phoneDetected: boolean) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Border color based on status
    ctx.strokeStyle = faceCount === 1 && !phoneDetected ? '#00ff00' : '#ff0000';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // Privacy text
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#00ff88';
    ctx.fillText('🔒 Privacy Protected', 20, 40);

    // Status indicators
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

  // End exam
  const handleEndExam = async () => {
    console.log('⏹️ Ending exam...');
    setIsProctoring(false);
    
    if (detectionIntervalRef.current) {
      clearInterval(detectionIntervalRef.current);
    }

    // Generate student hash
    const encoder = new TextEncoder();
    const data = encoder.encode(`${studentId}_zkp-vault`);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const studentHash = '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // Generate proof hash
    const proofData = {
      examId,
      studentHash,
      trustScore,
      incidents: incidents.length,
      timestamp: Date.now(),
    };
    const proofJSON = JSON.stringify(proofData);
    const proofBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(proofJSON));
    const proofArray = Array.from(new Uint8Array(proofBuffer));
    const proofHash = '0x' + proofArray.map(b => b.toString(16).padStart(2, '0')).join('');

    const sessionData = {
      examId,
      studentId,
      studentHash,
      startTime: Date.now() - (examDuration * 60 - timeRemaining) * 1000,
      endTime: Date.now(),
      incidents,
      trustScore,
      proofHash,
      detections: [],
    };

    onComplete(sessionData);
  };

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="student-exam">
      <div className="exam-header">
        <h2>ZKP-Vault Exam: {examId}</h2>
        {isProctoring && (
          <div className="time-remaining">
            Time Remaining: {formatTime(timeRemaining)}
          </div>
        )}
      </div>

      <div className="exam-content">
        <div className="video-section">
          <div className="video-container">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="webcam-feed"
            />
            <canvas
              ref={canvasRef}
              className="detection-overlay"
            />
          </div>

          {webcamError && (
            <div className="error-message">{webcamError}</div>
          )}

          {isInitializing && !webcamError && (
            <div className="loading-message">
              Initializing AI models... Please wait.
            </div>
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

        <div className="status-section">
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
                  backgroundColor: trustScore >= 80 ? '#00ff00' : trustScore >= 60 ? '#ffaa00' : '#ff0000'
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
            <p className="small-text">
              Detection running every 0.5 seconds
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};