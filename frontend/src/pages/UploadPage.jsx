import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, RefreshCw, ArrowRight } from 'lucide-react';
import { api } from '../services/api';

export default function UploadPage({ onNavigate }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Personal Records');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [polling, setPolling] = useState(false);

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      const ext = selected.name.split('.').pop().toLowerCase();
      if (!['pdf', 'txt'].includes(ext)) {
        setError('Only .pdf and .txt files are supported.');
        setFile(null);
        return;
      }
      setError('');
      setFile(selected);
      if (!title) {
        setTitle(selected.name.replace(/\.[^/.]+$/, ''));
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a PDF or TXT file to upload.');
      return;
    }

    setUploading(true);
    setError('');
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    if (category) formData.append('category', category);

    try {
      const result = await api.uploads.uploadFile(formData);
      setUploadResult(result);

      // Poll status if still processing
      if (result.status === 'processing') {
        pollStatus(result.job_id);
      } else {
        // Fetch final status
        const statusData = await api.uploads.getStatus(result.job_id);
        setJobStatus(statusData);
      }
    } catch (err) {
      setError(err.message || 'File upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const pollStatus = async (jobId) => {
    setPolling(true);
    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      try {
        const data = await api.uploads.getStatus(jobId);
        setJobStatus(data);
        if (data.status === 'completed' || data.status === 'failed' || attempts > 20) {
          clearInterval(interval);
          setPolling(false);
        }
      } catch (err) {
        clearInterval(interval);
        setPolling(false);
      }
    }, 2000);
  };

  const handleRetry = async () => {
    if (!uploadResult?.job_id) return;
    try {
      setError('');
      setUploading(true);
      const res = await api.uploads.retry(uploadResult.job_id);
      setJobStatus(res);
      if (res.status === 'processing') {
        pollStatus(res.job_id);
      }
    } catch (err) {
      setError(err.message || 'Retry failed.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="page-wrapper">
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: '800' }}>Upload Life Documents</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
          Ingest journals, essays, letters, or life records in PDF or TXT format.
        </p>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      <div className="grid-2">
        {/* Upload Form */}
        <div className="card">
          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* File Dropzone Area */}
            <div style={{
              border: '2px dashed var(--border-color)',
              borderRadius: 'var(--radius-md)',
              padding: '36px 20px',
              textAlign: 'center',
              backgroundColor: 'var(--bg-primary)',
              cursor: 'pointer',
              position: 'relative'
            }}>
              <input
                type="file"
                accept=".pdf,.txt"
                onChange={handleFileChange}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                }}
              />
              <Upload size={36} color="var(--accent-primary)" style={{ margin: '0 auto 12px' }} />
              {file ? (
                <div>
                  <div style={{ fontWeight: '600', fontSize: '15px' }}>{file.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {(file.size / 1024).toFixed(1)} KB • Click to change
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ fontWeight: '600', fontSize: '15px' }}>Choose or drag & drop file</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Supported formats: PDF (.pdf), Plain Text (.txt) up to 50MB
                  </div>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                Memory / Document Title
              </label>
              <input
                type="text"
                placeholder="e.g. 2018 Life Reflections Diary"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ width: '100%' }}
              >
                <option value="Personal Records">Personal Records</option>
                <option value="Career & Work">Career & Work</option>
                <option value="Family & Relationships">Family & Relationships</option>
                <option value="Values & Philosophy">Values & Philosophy</option>
                <option value="Education">Education</option>
                <option value="Travel & Adventure">Travel & Adventure</option>
              </select>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading || !file}
              style={{ padding: '12px', width: '100%' }}
            >
              {uploading ? 'Processing & Embedding...' : 'Upload & Process Document'}
            </button>
          </form>
        </div>

        {/* Processing Status & Summary */}
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>
            Processing Pipeline & Vector Indexing
          </h3>

          {!uploadResult && !jobStatus ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.6' }}>
              <p style={{ marginBottom: '12px' }}>
                When you upload a document:
              </p>
              <ol style={{ paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <li>Text is extracted page-by-page (preserving page citations).</li>
                <li>Clean text is split into semantic paragraphs with overlap.</li>
                <li>Dense 768-dimensional vectors are generated using Gemini.</li>
                <li>Chunks and vectors are stored in PostgreSQL with pgvector for instant RAG search.</li>
              </ol>
            </div>
          ) : (
            <div>
              <div style={{
                padding: '16px',
                borderRadius: 'var(--radius-sm)',
                backgroundColor: 'var(--bg-primary)',
                border: '1px solid var(--border-color)',
                marginBottom: '16px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ fontWeight: '600', fontSize: '14px' }}>
                    {jobStatus?.filename || uploadResult?.filename}
                  </span>
                  <span className={`badge ${
                    (jobStatus?.status || uploadResult?.status) === 'completed'
                      ? 'badge-success'
                      : (jobStatus?.status || uploadResult?.status) === 'failed'
                      ? 'badge-danger'
                      : 'badge-warning'
                  }`}>
                    {jobStatus?.status || uploadResult?.status}
                  </span>
                </div>

                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <div>Job Type: {jobStatus?.job_type || 'Extraction and Embedding'}</div>
                  <div>Chunks Indexed: <strong>{jobStatus?.chunks_created || 0}</strong> vector chunks</div>
                  {jobStatus?.error_message && (
                    <div style={{ color: 'var(--danger)', marginTop: '6px' }}>
                      Error: {jobStatus.error_message}
                    </div>
                  )}
                </div>
              </div>

              {jobStatus?.status === 'completed' && (
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => onNavigate('chat')}
                  >
                    Ask AI about this document <ArrowRight size={14} />
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => onNavigate('library')}
                  >
                    View in Library
                  </button>
                </div>
              )}

              {jobStatus?.status === 'failed' && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={handleRetry}
                  disabled={uploading}
                >
                  <RefreshCw size={14} /> Retry Processing Job
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

