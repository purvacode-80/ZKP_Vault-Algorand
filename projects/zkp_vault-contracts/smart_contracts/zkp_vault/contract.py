from algopy import (
    ARC4Contract,
    String,
    UInt64,
    Bytes,
    gtxn,
    Global,
    Txn,
    arc4,
    subroutine,
    op,
)


class ExamProof(arc4.Struct):
    """Structure to store exam proof data"""
    student_hash: arc4.String  # Hashed student identity
    trust_score: arc4.UInt64   # Trust score (0-100)
    proof_hash: arc4.String    # SHA-256 hash of proof data
    timestamp: arc4.UInt64     # Submission timestamp
    exam_id: arc4.String       # Exam identifier


class ExamMetadata(arc4.Struct):
    """Structure to store exam configuration"""
    exam_id: arc4.String
    instructor: arc4.Address
    start_time: arc4.UInt64
    end_time: arc4.UInt64
    min_trust_score: arc4.UInt64
    is_active: arc4.Bool


class ZKPVault(ARC4Contract):
    """
    ZKP-Vault Smart Contract
    Privacy-preserving AI proctoring on Algorand
    """

    @arc4.abimethod(create="require")
    def create_application(self) -> None:
        """Initialize the contract"""
        pass

    @arc4.abimethod
    def create_exam(
        self,
        exam_id: arc4.String,
        duration_minutes: arc4.UInt64,
        min_trust_score: arc4.UInt64,
    ) -> arc4.String:
        """
        Create a new exam
        
        Args:
            exam_id: Unique identifier for the exam
            duration_minutes: How long the exam is available
            min_trust_score: Minimum acceptable trust score (0-100)
            
        Returns:
            Success message with exam ID
        """
        # Only the contract creator can create exams (could be modified for multi-admin)
        assert Txn.sender == Global.creator_address, "Only contract creator can create exams"
        
        # Calculate end time
        start_time = Global.latest_timestamp
        end_time = start_time + (duration_minutes.native * 60)
        
        # Store exam metadata in box storage (exam_id as key)
        exam_metadata = ExamMetadata(
            exam_id=exam_id,
            instructor=arc4.Address(Txn.sender),
            start_time=arc4.UInt64(start_time),
            end_time=arc4.UInt64(end_time),
            min_trust_score=min_trust_score,
            is_active=arc4.Bool(True),
        )
        
        # Use box storage for exam metadata
        box_key = exam_id.native.encode()
        op.Box.put(box_key, exam_metadata.bytes)
        
        return arc4.String(f"Exam created: {exam_id.native}")

    @arc4.abimethod
    def submit_proof(
        self,
        exam_id: arc4.String,
        student_hash: arc4.String,
        trust_score: arc4.UInt64,
        proof_hash: arc4.String,
    ) -> arc4.String:
        """
        Submit exam proof for a student
        
        Args:
            exam_id: The exam identifier
            student_hash: Hashed student identity (keccak256)
            trust_score: Final trust score (0-100)
            proof_hash: SHA-256 hash of the proof data
            
        Returns:
            Success message with transaction details
        """
        # Retrieve exam metadata
        box_key = exam_id.native.encode()
        assert op.Box.length(box_key) > 0, "Exam does not exist"
        
        exam_data_bytes = op.Box.get(box_key)
        exam_metadata = ExamMetadata.from_bytes(exam_data_bytes)
        
        # Verify exam is active
        assert exam_metadata.is_active.native, "Exam is not active"
        
        # Verify exam time window
        current_time = Global.latest_timestamp
        assert current_time >= exam_metadata.start_time.native, "Exam has not started"
        assert current_time <= exam_metadata.end_time.native, "Exam has ended"
        
        # Verify trust score meets minimum threshold
        assert trust_score.native >= exam_metadata.min_trust_score.native, "Trust score below minimum"
        
        # Verify trust score is valid (0-100)
        assert trust_score.native <= 100, "Trust score cannot exceed 100"
        
        # Create proof record
        proof = ExamProof(
            student_hash=student_hash,
            trust_score=trust_score,
            proof_hash=proof_hash,
            timestamp=arc4.UInt64(current_time),
            exam_id=exam_id,
        )
        
        # Store proof in box storage (composite key: exam_id + student_hash)
        proof_key = f"{exam_id.native}_{student_hash.native}".encode()
        
        # Prevent duplicate submissions
        assert op.Box.length(proof_key) == 0, "Proof already submitted for this exam"
        
        # Store the proof
        op.Box.put(proof_key, proof.bytes)
        
        return arc4.String(f"Proof submitted successfully for {exam_id.native}")

    @arc4.abimethod
    def get_proof(
        self,
        exam_id: arc4.String,
        student_hash: arc4.String,
    ) -> ExamProof:
        """
        Retrieve a submitted proof
        
        Args:
            exam_id: The exam identifier
            student_hash: Hashed student identity
            
        Returns:
            The exam proof structure
        """
        proof_key = f"{exam_id.native}_{student_hash.native}".encode()
        assert op.Box.length(proof_key) > 0, "Proof not found"
        
        proof_bytes = op.Box.get(proof_key)
        return ExamProof.from_bytes(proof_bytes)

    @arc4.abimethod
    def get_exam_metadata(self, exam_id: arc4.String) -> ExamMetadata:
        """
        Retrieve exam metadata
        
        Args:
            exam_id: The exam identifier
            
        Returns:
            The exam metadata structure
        """
        box_key = exam_id.native.encode()
        assert op.Box.length(box_key) > 0, "Exam does not exist"
        
        exam_data_bytes = op.Box.get(box_key)
        return ExamMetadata.from_bytes(exam_data_bytes)

    @arc4.abimethod
    def close_exam(self, exam_id: arc4.String) -> arc4.String:
        """
        Manually close an exam (instructor only)
        
        Args:
            exam_id: The exam identifier
            
        Returns:
            Success message
        """
        # Retrieve exam metadata
        box_key = exam_id.native.encode()
        assert op.Box.length(box_key) > 0, "Exam does not exist"
        
        exam_data_bytes = op.Box.get(box_key)
        exam_metadata = ExamMetadata.from_bytes(exam_data_bytes)
        
        # Verify sender is the instructor
        assert Txn.sender == exam_metadata.instructor.native, "Only instructor can close exam"
        
        # Update exam status
        exam_metadata.is_active = arc4.Bool(False)
        op.Box.put(box_key, exam_metadata.bytes)
        
        return arc4.String(f"Exam {exam_id.native} closed successfully")

    @arc4.abimethod
    def verify_proof_exists(
        self,
        exam_id: arc4.String,
        student_hash: arc4.String,
    ) -> arc4.Bool:
        """
        Check if a proof exists for a student
        
        Args:
            exam_id: The exam identifier
            student_hash: Hashed student identity
            
        Returns:
            True if proof exists, False otherwise
        """
        proof_key = f"{exam_id.native}_{student_hash.native}".encode()
        return arc4.Bool(op.Box.length(proof_key) > 0)
