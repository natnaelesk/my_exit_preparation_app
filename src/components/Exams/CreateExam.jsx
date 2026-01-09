import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadExamFromJSON } from '../../services/uploadService';

const CreateExam = () => {
  const [examTitle, setExamTitle] = useState('');
  const [jsonFile, setJsonFile] = useState(null);
  const [jsonText, setJsonText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setJsonFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        try {
          const json = JSON.parse(event.target.result);
          setJsonText(JSON.stringify(json, null, 2));
          
          if (json.title && !examTitle.trim()) {
            setExamTitle(json.title);
          }
          
          setError(null);
        } catch (err) {
          setError('Invalid JSON file: ' + err.message);
        }
      };
      reader.readAsText(file);
    }
  };

  const handleJsonTextChange = (e) => {
    const text = e.target.value;
    setJsonText(text);
    setError(null);
    
    if (text.trim()) {
      try {
        const parsed = JSON.parse(text);
        if (parsed.title && !examTitle.trim()) {
          setExamTitle(parsed.title);
        }
      } catch {
        // Not valid JSON yet
      }
    }
  };

  const validateJson = () => {
    if (!examTitle.trim()) {
      throw new Error('Exam title is required');
    }

    if (!jsonText.trim()) {
      throw new Error('Please provide JSON data');
    }

    let questions;
    try {
      const parsed = JSON.parse(jsonText);
      if (Array.isArray(parsed)) {
        questions = parsed;
      } else if (parsed.questions && Array.isArray(parsed.questions)) {
        questions = parsed.questions;
      } else {
        throw new Error('JSON must contain an array of questions or an object with a "questions" array');
      }
    } catch (err) {
      throw new Error('Invalid JSON format: ' + err.message);
    }

    if (questions.length === 0) {
      throw new Error('Questions array cannot be empty');
    }

    return questions;
  };

  const handleUpload = async () => {
    try {
      setError(null);
      setUploadResult(null);
      
      const questions = validateJson();
      
      setIsUploading(true);
      const result = await uploadExamFromJSON(examTitle.trim(), questions);
      setUploadResult(result);
      
      setTimeout(() => {
        setExamTitle('');
        setJsonText('');
        setJsonFile(null);
        setUploadResult(null);
      }, 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg text-text px-4 py-6 pb-24 md:pb-6">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <button className="btn-secondary mb-4" onClick={() => navigate('/exams')}>
            ← Back to Exams
          </button>
          <h2 className="text-2xl font-bold text-text">Create New Exam</h2>
        </div>

        <div className="card space-y-4">
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Exam Title
            </label>
            <input
              type="text"
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder="e.g., Model from Addis Ababa University"
              className="input w-full"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Upload JSON File
            </label>
            <input
              type="file"
              accept=".json"
              onChange={handleFileChange}
              className="w-full text-sm text-text-secondary file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-500 file:text-white hover:file:bg-primary-600"
            />
            <p className="text-xs text-text-secondary mt-1">Or paste JSON directly below</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Questions JSON
            </label>
            <textarea
              value={jsonText}
              onChange={handleJsonTextChange}
              placeholder='[{"question": "...", "choices": ["A", "B", "C", "D"], "correctAnswer": "A", "explanation": "...", "subject": "Computer Programming", "topic": "..."}]'
              className="input w-full font-mono text-sm min-h-[300px]"
              rows={15}
            />
            <p className="text-xs text-text-secondary mt-1">
              Format: Array of questions. Each question needs: question, choices, correctAnswer, explanation, subject, topic (optional)
            </p>
          </div>

          {error && (
            <div className="bg-red-500/10 border border-red-500 rounded-lg p-4">
              <strong className="text-red-500 block mb-2">Error:</strong>
              <p className="text-red-400 text-sm">{error}</p>
              {error.includes('Firestore permission denied') && (
                <div className="mt-4 p-3 bg-primary-500/10 border border-primary-500/50 rounded-lg">
                  <strong className="text-primary-500 block mb-2 text-sm">Firestore Security Rules Setup Required</strong>
                  <p className="text-text-secondary text-xs mb-2">Your questions are valid, but you need to configure Firestore security rules:</p>
                  <ol className="text-xs text-text-secondary list-decimal list-inside space-y-1 mb-2">
                    <li>Go to <a href="https://console.firebase.google.com/" target="_blank" rel="noopener noreferrer" className="text-primary-500 underline">Firebase Console</a></li>
                    <li>Select your project</li>
                    <li>Click <strong>Firestore Database</strong> → <strong>Rules</strong> tab</li>
                    <li>Replace the rules with:</li>
                  </ol>
                  <pre className="text-xs bg-bg p-2 rounded overflow-auto mt-2">
{`rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}`}
                  </pre>
                  <p className="text-xs text-text-secondary mt-2">Click <strong>Publish</strong> to save. Then try uploading again.</p>
                </div>
              )}
            </div>
          )}

          {uploadResult && (
            <div className="bg-green-500/10 border border-green-500 rounded-lg p-4">
              <h3 className="text-green-500 font-bold mb-2">Upload Successful!</h3>
              <p className="text-text text-sm mb-2">
                Uploaded {uploadResult.uploadedCount} out of {uploadResult.totalCount} questions
              </p>
              {uploadResult.errors && (
                <div className="mt-3 pt-3 border-t border-green-500/30">
                  <p className="text-sm font-medium text-green-500 mb-2">Some questions had errors:</p>
                  <ul className="text-xs text-text-secondary list-disc list-inside space-y-1">
                    {uploadResult.errors.map((err, idx) => (
                      <li key={idx}>Question {err.index}: {err.error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-border">
            <button
              className="btn-primary flex-1"
              onClick={handleUpload}
              disabled={isUploading || !examTitle.trim() || !jsonText.trim()}
            >
              {isUploading ? 'Uploading...' : 'Upload Exam'}
            </button>
            <button
              className="btn-secondary flex-1"
              onClick={() => navigate('/exams')}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateExam;
