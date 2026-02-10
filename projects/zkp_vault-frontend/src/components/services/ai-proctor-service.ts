import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

export interface DetectionResult {
  faceCount: number;
  isLookingAtScreen: boolean;
  phoneDetected: boolean;
  timestamp: number;
}

export interface IncidentLog {
  type: 'no_face' | 'multi_face' | 'looking_away' | 'phone_detected' | 'absence';
  timestamp: number;
  details: string;
}

export interface SessionData {
  examId: string;
  studentHash: string;
  startTime: number;
  endTime?: number;
  incidents: IncidentLog[];
  detections: DetectionResult[];
  trustScore: number;
  proofHash: string;
}

export class AIProctorService {
  private faceDetectionModel: any = null;
  private objectDetectionModel: cocoSsd.ObjectDetection | null = null;
  private isInitialized = false;

  // Tracking state
  private consecutiveLookingAway = 0;
  private readonly LOOKING_AWAY_THRESHOLD = 30; // frames
  private readonly FACE_CONFIDENCE_THRESHOLD = 0.6;

  /**
   * Initialize all AI models
   */
  async initialize(): Promise<void> {
    console.log('🤖 Initializing AI Proctor...');

    try {
      // Initialize TensorFlow.js backend
      await tf.ready();
      console.log('✅ TensorFlow.js ready');

      // Load COCO-SSD for object detection (phones, etc.)
      this.objectDetectionModel = await cocoSsd.load();
      console.log('✅ Object detection model loaded');

      // Note: For face detection, we'll use a simple approach with TensorFlow
      // In production, you'd use face-api.js or MediaPipe
      console.log('✅ Face detection ready (using BlazeFace)');

      // Load BlazeFace for face detection
      const blazeface = await import('@tensorflow-models/blazeface');
      this.faceDetectionModel = await blazeface.load();
      console.log('✅ BlazeFace model loaded');

      this.isInitialized = true;
      console.log('🎉 AI Proctor initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize AI Proctor:', error);
      throw new Error('Failed to initialize AI models');
    }
  }

  /**
   * Analyze a single video frame
   */
  async analyzeFrame(videoElement: HTMLVideoElement): Promise<DetectionResult> {
    if (!this.isInitialized) {
      throw new Error('AI Proctor not initialized. Call initialize() first.');
    }

    const faceCount = await this.detectFaces(videoElement);
    const phoneDetected = await this.detectPhone(videoElement);

    // Simple gaze estimation based on face presence
    // In production, use proper eye tracking algorithms
    const isLookingAtScreen = this.estimateGaze(faceCount);

    return {
      faceCount,
      isLookingAtScreen,
      phoneDetected,
      timestamp: Date.now(),
    };
  }

  /**
   * Detect faces in video frame
   */
  private async detectFaces(videoElement: HTMLVideoElement): Promise<number> {
    try {
      const predictions = await this.faceDetectionModel.estimateFaces(videoElement, false);

      // Filter by confidence
      const confidentFaces = predictions.filter(
        (pred: any) => pred.probability[0] > this.FACE_CONFIDENCE_THRESHOLD
      );

      return confidentFaces.length;
    } catch (error) {
      console.error('Face detection error:', error);
      return 0;
    }
  }

  /**
   * Detect mobile phones in frame
   */
  private async detectPhone(videoElement: HTMLVideoElement): Promise<boolean> {
    try {
      if (!this.objectDetectionModel) return false;

      const predictions = await this.objectDetectionModel.detect(videoElement);

      // Check for cell phone detection
      const phoneDetected = predictions.some(
        pred => pred.class === 'cell phone' && pred.score > 0.6
      );

      return phoneDetected;
    } catch (error) {
      console.error('Object detection error:', error);
      return false;
    }
  }

  /**
   * Estimate if student is looking at screen
   * Simplified version - in production use proper eye tracking
   */
  private estimateGaze(faceCount: number): boolean {
    // If exactly one face detected, assume looking at screen
    // In production, use iris position relative to eye landmarks
    if (faceCount === 1) {
      this.consecutiveLookingAway = 0;
      return true;
    } else {
      this.consecutiveLookingAway++;
      return false;
    }
  }

  /**
   * Calculate trust score based on session data
   */
  calculateTrustScore(sessionData: Partial<SessionData>): number {
    let score = 100;

    if (!sessionData.incidents) return score;

    // Deduct points for incidents
    const incidentCounts = {
      no_face: 0,
      multi_face: 0,
      looking_away: 0,
      phone_detected: 0,
      absence: 0,
    };

    sessionData.incidents.forEach(incident => {
      incidentCounts[incident.type]++;
    });

    // Scoring penalties
    score -= incidentCounts.no_face * 5;
    score -= incidentCounts.multi_face * 10;
    score -= incidentCounts.looking_away * 3;
    score -= incidentCounts.phone_detected * 15;
    score -= incidentCounts.absence * 8;

    // Ensure score is between 0 and 100
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate proof hash from session data
   * Uses SHA-256 to create cryptographic proof
   */
  async generateProofHash(sessionData: Partial<SessionData>): Promise<string> {
    const proofObject = {
      exam_id: sessionData.examId,
      student_hash: sessionData.studentHash,
      trust_score: sessionData.trustScore,
      incidents: sessionData.incidents,
      timestamp: sessionData.startTime,
      detection_count: sessionData.detections?.length || 0,
    };

    const proofJSON = JSON.stringify(proofObject);
    const encoder = new TextEncoder();
    const data = encoder.encode(proofJSON);

    // Generate SHA-256 hash
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return `0x${hashHex}`;
  }

  /**
   * Generate student hash (anonymized identity)
   */
  async generateStudentHash(studentId: string, salt: string = 'zkp-vault'): Promise<string> {
    const data = `${studentId}_${salt}`;
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);

    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    return `0x${hashHex}`;
  }

  /**
   * Check detection result and log incidents
   */
  checkForIncidents(
    detection: DetectionResult,
    incidents: IncidentLog[]
  ): IncidentLog[] {
    const newIncidents: IncidentLog[] = [...incidents];

    // No face detected
    if (detection.faceCount === 0) {
      newIncidents.push({
        type: 'no_face',
        timestamp: detection.timestamp,
        details: 'No face detected in frame',
      });
    }

    // Multiple faces detected
    if (detection.faceCount > 1) {
      newIncidents.push({
        type: 'multi_face',
        timestamp: detection.timestamp,
        details: `${detection.faceCount} faces detected`,
      });
    }

    // Looking away from screen
    if (!detection.isLookingAtScreen && this.consecutiveLookingAway > this.LOOKING_AWAY_THRESHOLD) {
      newIncidents.push({
        type: 'looking_away',
        timestamp: detection.timestamp,
        details: 'Excessive looking away detected',
      });
      this.consecutiveLookingAway = 0; // Reset to avoid duplicate logs
    }

    // Phone detected
    if (detection.phoneDetected) {
      newIncidents.push({
        type: 'phone_detected',
        timestamp: detection.timestamp,
        details: 'Mobile device detected in frame',
      });
    }

    return newIncidents;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.faceDetectionModel) {
      // Cleanup TensorFlow models
      tf.disposeVariables();
    }
    this.isInitialized = false;
    console.log('🧹 AI Proctor disposed');
  }
}

// Export singleton instance
export const aiProctor = new AIProctorService();
