import React, { useEffect, useRef, useState } from 'react';
import { aiProctor, DetectionResult, IncidentLog, SessionData } from '../services/ai-proctor-service';
import { algodClient, submitProofToBlockchain } from '../services/algorand-service';
import './StudentExam.css';

interface StudentExamProps {
  examId: string;
  studentId: string;
  examDuration: number; // in minutes
  onComplete: (sessionData: SessionData) => void;
}

export const StudentExam: React.FC<StudentExamProps> = ({
  examId,
  studentId,
  examDuration,
  onComplete,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationFrameRef = useRef<number>();
  
  const [isInitializing, setIsInitializing] = useState(true);
  const [isProctoring, setIsProctoring] = useState(false);
  const [currentDetection, setCurrentDetection] = useState<DetectionResult | null>(null);
  const [incidents, setIncidents] = useState<IncidentLog[]>([]);
  const [detections, setDetections] = useState<DetectionResult[]>([]);
  const [trustScore, setTrustScore] = useState(100);
  const [timeRemaining, setTimeRemaining] = useState(examDuration * 60); // seconds
  const [sessionData, setSessionData] = useState<Partial<SessionData>>({
    examId,
    studentHash: '',
    startTime: Date.now(),
    incidents: [],
    detections: [],
    trustScore: 100,
    proofHash: '',
  });
  
  const [webcamError, setWebcamError] = useState<string | null>(null);
  
  // Initialize AI models and webcam
  useEffect(() => {
    const initialize = async () => {
      try {
        // Initialize AI Proctor
        await aiProctor.initialize();
        
        // Generate student hash
        const studentHash = await aiProctor.generateStudentHash(studentId);
        setSessionData(prev => ({ ...prev, studentHash }));
        
        // Request webcam access
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480 },
          audio: false,
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        
        setIsInitializing(false);
      } catch (error) {
        console.error('Initialization error:', error);
        setWebcamError('Failed to initialize. Please allow camera access.');
        setIsInitializing(false);
      }
    };
    
    initialize();
    
    return () => {
      // Cleanup
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      aiProctor.dispose();
    };
  }, [studentId]);
  
  // Start proctoring
  const startProctoring = () => {
    setIsProctoring(true);
    setSessionData(prev => ({ ...prev, startTime: Date.now() }));
    detectFrame();
  };
  
  // Timer countdown
  useEffect(() => {
    if (!isProctoring) return;
    
    const timer = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          endExam();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, [isProctoring]);
  
  // Detection loop
  const detectFrame = async () => {
    if (!videoRef.current || !isProctoring) return;
    
    try {
      // Analyze current frame
      const detection = await aiProctor.analyzeFrame(videoRef.current);
      setCurrentDetection(detection);
      
      // Store detection
      setDetections(prev => [...prev, detection]);
      
      // Check for incidents
      const newIncidents = aiProctor.checkForIncidents(detection, incidents);
      if (newIncidents.length > incidents.length) {
        setIncidents(newIncidents);
      }
      
      // Update trust score
      const score = aiProctor.calculateTrustScore({
        incidents: newIncidents,
      });
      setTrustScore(score);
      
      // Draw detection overlays
      drawOverlays(detection);
      
      // Continue detection loop
      animationFrameRef.current = requestAnimationFrame(detectFrame);
    } catch (error) {
      console.error('Detection error:', error);
    }
  };
  
  // Draw AI detection overlays on canvas
  const drawOverlays = (detection: DetectionResult) => {
    if (!canvasRef.current || !videoRef.current) return;
    
    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) return;
    
    // Match canvas size to video
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    
    // Clear previous drawings
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw face count indicator
    ctx.strokeStyle = detection.faceCount === 1 ? '#00ff00' : '#ff0000';
    ctx.lineWidth = 3;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);
    
    // Draw status text
    ctx.font = 'bold 24px Arial';
    ctx.fillStyle = '#00ff00';
    ctx.fillText('🔒 Privacy Mode Active', 30, 50);
    
    // Draw detection indicators
    const indicators = [
      { label: 'Face Count', value: detection.faceCount, ok: detection.faceCount === 1 },
      { label: 'Eyes on Screen', value: detection.isLookingAtScreen ? 'Yes' : 'No', ok: detection.isLookingAtScreen },
      { label: 'Phone Detected', value: detection.phoneDetected ? 'Yes' : 'No', ok: !detection.phoneDetected },
    ];
    
    let yPos = canvas.height - 100;
    indicators.forEach(ind => {
      ctx.fillStyle = ind.ok ? '#00ff00' : '#ff6600';
      ctx.font = '18px Arial';
      ctx.fillText(`${ind.label}: ${ind.value}`, 30, yPos);
      yPos += 30;
    });
  };
  
  // End exam and submit proof
  const endExam = async () => {
    setIsProctoring(false);
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    
    const finalSessionData: SessionData = {
      examId,
      studentHash: sessionData.studentHash!,
      startTime: sessionData.startTime!,
      endTime: Date.now(),
      incidents,
      detections,
      trustScore,
      proofHash: '',
    };
    
    // Generate proof hash
    const proofHash = await aiProctor.generateProofHash({
      ...finalSessionData,
      trustScore,
    });
    
    finalSessionData.proofHash = proofHash;
    setSessionData(finalSessionData);
    
    // Call completion callback
    onComplete(finalSessionData);
  };
  
  // Format time remaining
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
        {/* Video Feed Section */}
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
          
          {!isProctoring && !isInitializing && !webcamError && (
            <button
              className="start-button"
              onClick={startProctoring}
            >
              Start Exam
            </button>
          )}
          
          {isProctoring && (
            <button
              className="end-button"
              onClick={endExam}
            >
              Submit Exam
            </button>
          )}
        </div>
        
        {/* Privacy & Status Section */}
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
          
          {currentDetection && (
            <div className="detection-status">
              <h4>Current Status</h4>
              <div className="status-item">
                <span className={currentDetection.faceCount === 1 ? 'status-ok' : 'status-warning'}>
                  {currentDetection.faceCount === 1 ? '✅' : '⚠️'}
                </span>
                Face Detected: {currentDetection.faceCount}
              </div>
              <div className="status-item">
                <span className={currentDetection.isLookingAtScreen ? 'status-ok' : 'status-warning'}>
                  {currentDetection.isLookingAtScreen ? '✅' : '⚠️'}
                </span>
                Eyes on Screen
              </div>
              <div className="status-item">
                <span className={!currentDetection.phoneDetected ? 'status-ok' : 'status-warning'}>
                  {!currentDetection.phoneDetected ? '✅' : '⚠️'}
                </span>
                No Phone Detected
              </div>
            </div>
          )}
          
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
              Models: Face Detection, Gaze Tracking, Object Detection
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};