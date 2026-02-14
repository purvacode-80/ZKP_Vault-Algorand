import React, { useState, useEffect } from 'react';

// Types (can be moved to a shared file)
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

export const ExamBuilder: React.FC = () => {
  const [exams, setExams] = useState<Exam[]>([]);
  const [currentExam, setCurrentExam] = useState<Partial<Exam>>({
    examId: '',
    title: '',
    duration: 60,
    questions: [],
    createdAt: Date.now(),
  });

  // Load and sanitize exams from localStorage
  useEffect(() => {
    const stored = localStorage.getItem('zkp_vault_exams');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        // Ensure every exam has a questions array (default to empty)
        const sanitized = parsed.map((exam: any) => ({
          ...exam,
          questions: exam.questions || [],
        }));
        setExams(sanitized);
      } catch (e) {
        console.error('Failed to parse exams', e);
        setExams([]);
      }
    }
  }, []);

  const saveExams = (updatedExams: Exam[]) => {
    localStorage.setItem('zkp_vault_exams', JSON.stringify(updatedExams));
    setExams(updatedExams);
  };

  const addQuestion = () => {
    const newQuestion: Question = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
      text: '',
      options: ['', '', '', ''],
      correctAnswer: '',
    };
    setCurrentExam({
      ...currentExam,
      questions: [...(currentExam.questions || []), newQuestion],
    });
  };

  const updateQuestion = (
    index: number,
    field: keyof Question,
    value: string | string[]
  ) => {
    const updatedQuestions = [...(currentExam.questions || [])];
    updatedQuestions[index] = { ...updatedQuestions[index], [field]: value };
    setCurrentExam({ ...currentExam, questions: updatedQuestions });
  };

  const updateOption = (qIndex: number, optIndex: number, value: string) => {
    const updatedQuestions = [...(currentExam.questions || [])];
    const options = [...updatedQuestions[qIndex].options];
    options[optIndex] = value;
    updatedQuestions[qIndex].options = options;
    setCurrentExam({ ...currentExam, questions: updatedQuestions });
  };

  const removeQuestion = (index: number) => {
    const updatedQuestions = (currentExam.questions || []).filter((_, i) => i !== index);
    setCurrentExam({ ...currentExam, questions: updatedQuestions });
  };

  const saveExam = () => {
    if (
      !currentExam.examId ||
      !currentExam.title ||
      !currentExam.duration ||
      !currentExam.questions?.length
    ) {
      alert('Please fill in all exam details and add at least one question.');
      return;
    }

    if (exams.some(e => e.examId === currentExam.examId)) {
      alert('An exam with this ID already exists. Please choose a different ID.');
      return;
    }

    const newExam: Exam = {
      examId: currentExam.examId,
      title: currentExam.title,
      duration: currentExam.duration,
      questions: currentExam.questions,
      createdAt: Date.now(),
      createdBy: 'admin',
    };

    saveExams([...exams, newExam]);

    // Reset form
    setCurrentExam({
      examId: '',
      title: '',
      duration: 60,
      questions: [],
      createdAt: Date.now(),
    });
  };

  const deleteExam = (examId: string) => {
    if (window.confirm('Are you sure you want to delete this exam?')) {
      const updatedExams = exams.filter(e => e.examId !== examId);
      saveExams(updatedExams);
    }
  };

  return (
    <div className="admin-dashboard" style={{ padding: '20px' }}>
      <h1>📝 Exam Builder</h1>

      {/* Form to create/edit exam */}
      <div className="filters-section" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <h2>Create New Exam</h2>
        <input
          type="text"
          placeholder="Exam ID (unique, e.g., MATH101)"
          value={currentExam.examId}
          onChange={e => setCurrentExam({ ...currentExam, examId: e.target.value })}
          className="search-input"
        />
        <input
          type="text"
          placeholder="Exam Title"
          value={currentExam.title}
          onChange={e => setCurrentExam({ ...currentExam, title: e.target.value })}
          className="search-input"
        />
        <input
          type="number"
          placeholder="Duration (minutes)"
          value={currentExam.duration}
          onChange={e => setCurrentExam({ ...currentExam, duration: parseInt(e.target.value) || 0 })}
          className="search-input"
        />

        <h3>Questions</h3>
        {currentExam.questions?.map((q, qIndex) => (
          <div key={q.id} className="proofs-section" style={{ marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h4>Question {qIndex + 1}</h4>
              <button onClick={() => removeQuestion(qIndex)} className="filter-btn" style={{ background: '#ff6b6b' }}>
                ❌ Remove
              </button>
            </div>
            <input
              type="text"
              placeholder="Question text"
              value={q.text}
              onChange={e => updateQuestion(qIndex, 'text', e.target.value)}
              className="search-input"
              style={{ marginBottom: '10px' }}
            />
            {q.options.map((opt, optIndex) => (
              <input
                key={optIndex}
                type="text"
                placeholder={`Option ${optIndex + 1}`}
                value={opt}
                onChange={e => updateOption(qIndex, optIndex, e.target.value)}
                className="search-input"
                style={{ marginBottom: '5px' }}
              />
            ))}
            <input
              type="text"
              placeholder="Correct answer (optional, must match an option exactly)"
              value={q.correctAnswer || ''}
              onChange={e => updateQuestion(qIndex, 'correctAnswer', e.target.value)}
              className="search-input"
              style={{ marginTop: '5px', borderColor: '#00ff88' }}
            />
          </div>
        ))}

        <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
          <button onClick={addQuestion} className="export-button">
            ➕ Add Question
          </button>
          <button onClick={saveExam} className="export-button" style={{ background: 'linear-gradient(135deg, #00ff88 0%, #00cc6f 100%)' }}>
            💾 Save Exam
          </button>
        </div>
      </div>

      {/* List of existing exams */}
      <div className="proofs-section" style={{ marginTop: '40px' }}>
        <h2>Existing Exams</h2>
        {exams.length === 0 ? (
          <p className="empty-state">No exams created yet.</p>
        ) : (
          <div className="proofs-table">
            <div className="table-header">
              <div>Exam ID</div>
              <div>Title</div>
              <div>Duration</div>
              <div>Questions</div>
              <div>Created</div>
              <div>Actions</div>
            </div>
            {exams.map(exam => (
              <div key={exam.examId} className="table-row">
                <div><code>{exam.examId}</code></div>
                <div>{exam.title}</div>
                <div>{exam.duration} min</div>
                {/* ✅ Use optional chaining to safely access questions.length */}
                <div>{exam.questions?.length ?? 0}</div>
                <div>{new Date(exam.createdAt).toLocaleDateString()}</div>
                <div>
                  <button
                    onClick={() => deleteExam(exam.examId)}
                    className="filter-btn"
                    style={{ background: '#ff6b6b' }}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
