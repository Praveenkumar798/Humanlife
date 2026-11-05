import React, { useState } from 'react';
import {
  Upload,
  FileText,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Sparkles,
  Camera,
  Eye,
} from 'lucide-react';
import { api } from '../services/api';

const SUPPORTED_EXTS = ['pdf', 'txt', 'jpg', 'jpeg', 'png', 'webp'];
const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'webp'];

export default function UploadPage({ onNavigate }) {
  const [file, setFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Family & Relationships');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [uploadResult, setUploadResult] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [polling, setPolling] = useState(false);

  const isImage = file && IMAGE_EXTS.includes(file.name.split('.').pop().toLowerCase());

  const handleFileChange = (e) => {
    const selected = e.target.files[0];
    if (selected) {
      const ext = selected.name.split('.').pop().toLowerCase();
      if (!SUPPORTED_EXTS.includes(ext)) {
        setError('Unsupported format. Please upload PDF (.pdf), Plain Text (.txt), or Photos (.jpg, .jpeg, .png, .webp).');
        setFile(null);
        setPreviewUrl(null);
        return;
      }
      setError('');
      setFile(selected);

      // Create preview URL for images
      if (IMAGE_EXTS.includes(ext)) {
        setPreviewUrl(URL.createObjectURL(selected));
        if (!title) {
          const cleanName = selected.name.replace(/\.[^/.]+$/, '').replace(/[_-]/g, ' ');
          setTitle(cleanName);
        }
      } else {
        setPreviewUrl(null);
        if (!title) {
          setTitle(selected.name.replace(/\.[^/.]+$/, ''));
        }
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!file) {
      setError('Please select a document or photograph to upload.');
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
    <div className="page-wrapper" style={{ maxWidth: '1100px', margin: '0 auto', paddingBottom: '60px' }}>
      <div style={{ marginBottom: '28px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '6px 14px', borderRadius: '20px', backgroundColor: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc', fontSize: '12px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '10px' }}>
          <Sparkles size={14} /> Multimodal Ingestion Pipeline
        </div>
        <h1 style={{ fontSize: '30px', fontWeight: '800', letterSpacing: '-0.5px' }}>
          Upload Documents, Photos & Handwritten Diaries
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '15px', marginTop: '4px' }}>
          Ingest journals, PDF memoirs, old family photos, and handwritten notebooks. Powered by Gemini Vision OCR & 768-D vector embeddings.
        </p>
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: '20px' }}>{error}</div>}

      <div className="grid-2">
        {/* Upload Form */}
        <div className="card" style={{ padding: '28px', borderRadius: '20px' }}>
          <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* File Dropzone Area */}
            <div
              style={{
                border: '2px dashed var(--border-color)',
                borderRadius: '16px',
                padding: previewUrl ? '16px' : '36px 20px',
                textAlign: 'center',
                backgroundColor: 'rgba(15, 23, 42, 0.6)',
                cursor: 'pointer',
                position: 'relative',
                transition: 'border-color 0.2s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
            >
              <input
                type="file"
                accept=".pdf,.txt,.jpg,.jpeg,.png,.webp"
                onChange={handleFileChange}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  opacity: 0,
                  cursor: 'pointer',
                  zIndex: 10,
                }}
              />

              {previewUrl ? (
                <div>
                  <img
                    src={previewUrl}
                    alt="Uploaded preview"
                    style={{
                      maxHeight: '180px',
                      borderRadius: '12px',
                      objectFit: 'contain',
                      margin: '0 auto 12px',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      border: '1px solid rgba(255,255,255,0.1)',
                    }}
                  />
                  <div style={{ fontWeight: '600', fontSize: '14px', color: '#fff' }}>{file?.name}</div>
                  <div style={{ fontSize: '12px', color: '#38bdf8', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <Sparkles size={13} /> Gemini Vision OCR & Analysis Ready • Click to change
                  </div>
                </div>
              ) : file ? (
                <div>
                  <FileText size={40} color="var(--accent-primary)" style={{ margin: '0 auto 12px' }} />
                  <div style={{ fontWeight: '600', fontSize: '15px' }}>{file.name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {(file.size / 1024).toFixed(1)} KB • Click to change
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: '12px', marginBottom: '12px' }}>
                    <Upload size={32} color="var(--accent-primary)" />
                    <Camera size={32} color="#c084fc" />
                  </div>
                  <div style={{ fontWeight: '700', fontSize: '16px', color: '#f8fafc' }}>
                    Drop documents or vintage photos here
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px', lineHeight: '1.5' }}>
                    PDFs, Text diaries, or Photos (.jpg, .png, .webp) up to 50MB
                  </div>
                </div>
              )}
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                {isImage ? 'Photo Caption or Context Note (Optional)' : 'Document / Memory Title'}
              </label>
              <input
                type="text"
                placeholder={isImage ? "e.g. Wedding day of my parents in Hyderabad, 1982" : "e.g. 2018 Life Reflections Diary"}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '600', marginBottom: '6px' }}>
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                style={{ width: '100%', padding: '12px 14px', borderRadius: '10px' }}
              >
                <option value="Family & Relationships">Family & Relationships</option>
                <option value="Personal Records">Personal Records</option>
                <option value="Letters & Diaries">Letters & Diaries</option>
                <option value="Career & Work">Career & Work</option>
                <option value="Values & Philosophy">Values & Philosophy</option>
                <option value="Travel & Adventure">Travel & Adventure</option>
              </select>
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading || !file}
              style={{
                padding: '13px',
                width: '100%',
                fontWeight: '700',
                background: isImage
                  ? 'linear-gradient(135deg, #6366f1 0%, #c084fc 100%)'
                  : 'var(--accent-primary)',
                boxShadow: isImage ? '0 6px 20px rgba(192, 132, 252, 0.35)' : 'none',
              }}
            >
              {uploading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <RefreshCw size={16} className="spin" />
                  {isImage ? 'Analyzing with Gemini Vision...' : 'Processing & Embedding...'}
                </span>
              ) : (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  {isImage ? <Sparkles size={16} /> : <Upload size={16} />}
                  {isImage ? 'Analyze Photo with Gemini Vision' : 'Upload & Process Document'}
                </span>
              )}
            </button>
          </form>
        </div>

        {/* Processing Pipeline & Vector Indexing Card */}
        <div className="card" style={{ padding: '28px', borderRadius: '20px' }}>
          <h3 style={{ fontSize: '17px', fontWeight: '700', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Eye size={18} color="var(--accent-primary)" /> Multimodal Vision & Vector Pipeline
          </h3>

          {!uploadResult && !jobStatus ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: '1.7' }}>
              <p style={{ marginBottom: '14px', color: 'var(--text-secondary)' }}>
                How Human Legacy AI processes your uploads:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border-color)' }}>
                  <strong style={{ color: '#c084fc' }}>📷 Vintage Photos & Handcrafted Letters:</strong>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    Gemini Vision performs OCR on faded handwriting, estimates historical eras, detects people and settings, and generates an authentic memoir narrative.
                  </div>
                </div>
                <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border-color)' }}>
                  <strong style={{ color: '#38bdf8' }}>📄 PDF & TXT Manuscripts:</strong>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    Extracted page-by-page, split into overlapping semantic chunks, and embedded with 768-D vectors.
                  </div>
                </div>
                <div style={{ padding: '12px 16px', borderRadius: '12px', backgroundColor: 'rgba(15, 23, 42, 0.5)', border: '1px solid var(--border-color)' }}>
                  <strong style={{ color: '#10b981' }}>⚡ Instant RAG Grounding:</strong>
                  <div style={{ fontSize: '12px', marginTop: '4px' }}>
                    Vectors are instantly saved to PostgreSQL pgvector. Your voice & chat assistants can quote from them immediately!
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div
                style={{
                  padding: '18px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(15, 23, 42, 0.8)',
                  border: '1px solid var(--border-color)',
                  marginBottom: '20px',
                }}
              >
                {/* Media Image Preview if available */}
                {(jobStatus?.media_url || uploadResult?.media_url) && (
                  <div style={{ textAlign: 'center', marginBottom: '16px' }}>
                    <img
                      src={jobStatus?.media_url || uploadResult?.media_url}
                      alt="Archived Media"
                      style={{
                        maxHeight: '160px',
                        borderRadius: '12px',
                        border: '1px solid rgba(255,255,255,0.15)',
                        boxShadow: '0 6px 18px rgba(0,0,0,0.5)',
                      }}
                    />
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span style={{ fontWeight: '700', fontSize: '15px' }}>
                    {jobStatus?.filename || uploadResult?.filename}
                  </span>
                  <span
                    className={`badge ${
                      (jobStatus?.status || uploadResult?.status) === 'completed'
                        ? 'badge-success'
                        : (jobStatus?.status || uploadResult?.status) === 'failed'
                        ? 'badge-danger'
                        : 'badge-warning'
                    }`}
                  >
                    {(jobStatus?.status || uploadResult?.status)?.toUpperCase()}
                  </span>
                </div>

                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div>Type: <strong>{jobStatus?.job_type || uploadResult?.file_type}</strong></div>
                  <div>Chunks Indexed: <strong>{jobStatus?.chunks_created || 0}</strong> pgvector chunks</div>
                  {jobStatus?.error_message && (
                    <div style={{ color: 'var(--danger)', marginTop: '6px' }}>
                      Error: {jobStatus.error_message}
                    </div>
                  )}
                </div>
              </div>

              {jobStatus?.status === 'completed' && (
                <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => onNavigate('library')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    <CheckCircle size={15} /> View in Memory Library
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => onNavigate('chat')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                  >
                    Ask AI Replica <ArrowRight size={15} />
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
