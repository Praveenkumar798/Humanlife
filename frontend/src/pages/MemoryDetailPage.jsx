import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Calendar,
  Tag,
  Star,
  CheckCircle,
  Edit2,
  Trash2,
  Save,
  X,
} from 'lucide-react';
import { api } from '../services/api';
import ConfirmModal from '../components/ConfirmModal';

export default function MemoryDetailPage({ memoryId, onNavigate }) {
  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editImportance, setEditImportance] = useState(5.0);
  const [editEventDate, setEditEventDate] = useState('');
  const [saving, setSaving] = useState(false);

  // Deletion state
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

  const fetchMemory = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.memories.get(memoryId);
      setMemory(data);
      setEditTitle(data.title);
      setEditContent(data.content);
      setEditCategory(data.category || '');
      setEditImportance(data.importance || 5.0);
      setEditEventDate(data.event_date || '');
    } catch (err) {
      setError(err.message || 'Failed to load memory details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (memoryId) fetchMemory();
  }, [memoryId]);

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.memories.update(memoryId, {
        title: editTitle,
        content: editContent,
        category: editCategory || null,
        importance: parseFloat(editImportance),
        event_date: editEventDate || null,
      });
      setMemory(updated);
      setIsEditing(false);
    } catch (err) {
      alert(err.message || 'Failed to save changes.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    try {
      await api.memories.delete(memoryId);
      setIsDeleteModalOpen(false);
      onNavigate('library');
    } catch (err) {
      alert(err.message || 'Failed to delete memory.');
    }
  };

  if (loading) {
    return (
      <div className="page-wrapper" style={{ textAlign: 'center', padding: '80px', color: 'var(--text-muted)' }}>
        Loading memory details...
      </div>
    );
  }

  if (error || !memory) {
    return (
      <div className="page-wrapper">
        <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('library')} style={{ marginBottom: '20px' }}>
          <ArrowLeft size={14} /> Back to Library
        </button>
        <div className="alert alert-danger">{error || 'Memory not found.'}</div>
      </div>
    );
  }

  return (
    <div className="page-wrapper" style={{ maxWidth: '860px' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => onNavigate('library')}>
          <ArrowLeft size={14} /> Back to Library
        </button>

        <div style={{ display: 'flex', gap: '10px' }}>
          {!isEditing ? (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(true)}>
                <Edit2 size={14} /> Edit
              </button>
              <button className="btn btn-danger btn-sm" onClick={() => setIsDeleteModalOpen(true)}>
                <Trash2 size={14} /> Delete
              </button>
            </>
          ) : (
            <button className="btn btn-secondary btn-sm" onClick={() => setIsEditing(false)}>
              <X size={14} /> Cancel
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="card" style={{ padding: '32px' }}>
        {!isEditing ? (
          <div>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
              <span className="badge badge-info">{memory.category || 'General'}</span>
              <span className="badge badge-success" style={{ textTransform: 'capitalize' }}>
                {memory.verification_status || 'unverified'}
              </span>
              <span className="badge" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                {memory.memory_type}
              </span>
            </div>

            <h1 style={{ fontSize: '26px', fontWeight: '800', lineHeight: '1.3', marginBottom: '16px' }}>
              {memory.title}
            </h1>

            <div style={{
              display: 'flex',
              gap: '20px',
              color: 'var(--text-muted)',
              fontSize: '13px',
              paddingBottom: '20px',
              marginBottom: '24px',
              borderBottom: '1px solid var(--border-color)',
              flexWrap: 'wrap',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Calendar size={15} />
                <span>Event Date: {memory.event_date ? new Date(memory.event_date).toLocaleDateString() : 'Unknown'}</span>
              </div>
              {memory.importance && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--warning)' }}>
                  <Star size={15} fill="var(--warning)" />
                  <span>Significance: {memory.importance} / 10</span>
                </div>
              )}
              <div style={{ color: 'var(--text-muted)' }}>
                Recorded: {new Date(memory.created_at).toLocaleDateString()}
              </div>
            </div>

            {/* Memory Narrative */}
            <div style={{
              fontSize: '15px',
              lineHeight: '1.8',
              color: 'var(--text-primary)',
              whiteSpace: 'pre-wrap',
            }}>
              {memory.content}
            </div>

            {memory.tags && memory.tags.length > 0 && (
              <div style={{ display: 'flex', gap: '8px', marginTop: '32px', paddingTop: '20px', borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                <Tag size={16} color="var(--text-muted)" />
                {memory.tags.map((t, i) => (
                  <span key={i} className="badge" style={{ backgroundColor: 'var(--bg-hover)', color: 'var(--text-secondary)' }}>
                    #{t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : (
          <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                Title
              </label>
              <input
                type="text"
                required
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                Category
              </label>
              <input
                type="text"
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                style={{ width: '100%' }}
              />
            </div>

            <div className="grid-2">
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                  Event Date
                </label>
                <input
                  type="date"
                  value={editEventDate}
                  onChange={(e) => setEditEventDate(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                  Significance: {editImportance}
                </label>
                <input
                  type="range"
                  min="1"
                  max="10"
                  step="0.5"
                  value={editImportance}
                  onChange={(e) => setEditImportance(e.target.value)}
                  style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                Content / Narrative
              </label>
              <textarea
                required
                rows={10}
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                style={{ width: '100%', resize: 'vertical' }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setIsEditing(false)}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={saving}
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        )}
      </div>

      <ConfirmModal
        isOpen={isDeleteModalOpen}
        title="Delete Memory"
        message="Are you sure you want to permanently delete this memory? All associated vector embeddings and source chunks will also be removed."
        onConfirm={handleDelete}
        onCancel={() => setIsDeleteModalOpen(false)}
      />
    </div>
  );
}

