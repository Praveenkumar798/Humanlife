import React, { useState, useEffect } from 'react';
import {
  BookOpen,
  Search,
  Filter,
  Plus,
  Calendar,
  Tag,
  Star,
  CheckCircle,
  FileText,
  X,
  LayoutGrid,
  GitCommit,
  BrainCircuit,
} from 'lucide-react';
import { api } from '../services/api';
import LifeTimelineView from '../components/LifeTimelineView';
import NeuralMindMapView from '../components/NeuralMindMapView';

export default function LibraryPage({ onNavigate }) {
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'timeline' | 'mindmap'
  const [memories, setMemories] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(12);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // New Memory Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newCategory, setNewCategory] = useState('Personal Reflection');
  const [newMemoryType, setNewMemoryType] = useState('episodic');
  const [newImportance, setNewImportance] = useState(5.0);
  const [newEventDate, setNewEventDate] = useState('');
  const [newTags, setNewTags] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchMemories = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await api.memories.list({
        search: search || undefined,
        category: category || undefined,
        verification_status: verificationStatus || undefined,
        page,
        page_size: pageSize,
      });
      setMemories(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      setError(err.message || 'Failed to load memories.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, [page, category, verificationStatus]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchMemories();
  };

  const handleCreateMemory = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      const tagsArray = newTags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean);

      await api.memories.create({
        title: newTitle,
        content: newContent,
        category: newCategory,
        memory_type: newMemoryType,
        importance: parseFloat(newImportance),
        event_date: newEventDate || null,
        tags: tagsArray,
        verification_status: 'owner_confirmed',
      });

      setIsModalOpen(false);
      setNewTitle('');
      setNewContent('');
      setNewTags('');
      setNewEventDate('');
      fetchMemories();
    } catch (err) {
      alert(err.message || 'Failed to create memory.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="page-wrapper">
      {/* Header & Controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '28px', fontWeight: '800', letterSpacing: '-0.5px' }}>Memory Library</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
            Explore your life legacy across Card, Timeline, and Neural Mind Map views ({total} total)
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          {/* View Mode Switcher */}
          <div
            style={{
              display: 'inline-flex',
              padding: '4px',
              backgroundColor: 'rgba(15, 23, 42, 0.7)',
              borderRadius: '12px',
              border: '1px solid var(--border-color)',
            }}
          >
            <button
              onClick={() => setViewMode('grid')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                fontSize: '13px',
                fontWeight: '600',
                borderRadius: '8px',
                backgroundColor: viewMode === 'grid' ? 'var(--accent-primary)' : 'transparent',
                color: viewMode === 'grid' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              <LayoutGrid size={15} /> Grid
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                fontSize: '13px',
                fontWeight: '600',
                borderRadius: '8px',
                backgroundColor: viewMode === 'timeline' ? 'var(--accent-primary)' : 'transparent',
                color: viewMode === 'timeline' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              <GitCommit size={15} /> Timeline
            </button>
            <button
              onClick={() => setViewMode('mindmap')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                fontSize: '13px',
                fontWeight: '600',
                borderRadius: '8px',
                backgroundColor: viewMode === 'mindmap' ? 'var(--accent-primary)' : 'transparent',
                color: viewMode === 'mindmap' ? '#fff' : 'var(--text-secondary)',
                transition: 'all 0.15s ease',
              }}
            >
              <BrainCircuit size={15} /> Mind Map
            </button>
          </div>

          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> Record Memory
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger">{error}</div>}

      {/* Filter and Search Bar */}
      <div className="card" style={{ padding: '16px', marginBottom: '24px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: '2', minWidth: '220px', display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
            <input
              type="text"
              placeholder="Search by keywords in memory title or content..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ width: '100%', paddingLeft: '36px' }}
            />
            <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '12px' }} />
          </div>

          <div style={{ flex: '1', minWidth: '160px' }}>
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                setPage(1);
              }}
              style={{ width: '100%' }}
            >
              <option value="">All Categories</option>
              <option value="Personal Reflection">Personal Reflection</option>
              <option value="Childhood">Childhood</option>
              <option value="Career & Work">Career & Work</option>
              <option value="Family & Relationships">Family & Relationships</option>
              <option value="Values & Philosophy">Values & Philosophy</option>
              <option value="Education">Education</option>
              <option value="Personal Records">Personal Records</option>
            </select>
          </div>

          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>
      </div>

      {/* Memories Grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
          Loading memories...
        </div>
      ) : memories.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <BookOpen size={48} style={{ margin: '0 auto 16px', opacity: 0.4 }} />
          <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px', color: 'var(--text-primary)' }}>
            No Memories Found
          </h3>
          <p style={{ fontSize: '14px', marginBottom: '20px' }}>
            {search || category ? 'Try adjusting your search terms or filters.' : 'Begin building your legacy by recording your first personal memory.'}
          </p>
          <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
            <Plus size={16} /> Record Memory
          </button>
        </div>
      ) : viewMode === 'timeline' ? (
        <LifeTimelineView
          memories={memories}
          onOpenMemory={(m) => onNavigate('memory-detail', { memoryId: m.id })}
        />
      ) : viewMode === 'mindmap' ? (
        <NeuralMindMapView
          memories={memories}
          onOpenMemory={(m) => onNavigate('memory-detail', { memoryId: m.id })}
        />
      ) : (
        <div className="grid-3" style={{ marginBottom: '32px' }}>
          {memories.map((m) => (
            <div
              key={m.id}
              className="card"
              onClick={() => onNavigate('memory-detail', { memoryId: m.id })}
              style={{
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                transition: 'border-color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--accent-primary)')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                  <span className="badge badge-info">{m.category || 'General'}</span>
                  <span style={{ fontSize: '12px', color: m.source_type === 'photo' ? '#c084fc' : 'var(--text-muted)', fontWeight: m.source_type === 'photo' ? '700' : '500' }}>
                    {m.source_type === 'photo' ? '📷 PHOTO MEMORY' : m.source_type.toUpperCase()}
                  </span>
                </div>

                <h3 style={{ fontSize: '16px', fontWeight: '700', marginBottom: '10px', lineHeight: '1.4' }}>
                  {m.title}
                </h3>

                <p style={{
                  fontSize: '13px',
                  color: 'var(--text-secondary)',
                  lineHeight: '1.6',
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                  marginBottom: '16px'
                }}>
                  {m.content}
                </p>
              </div>

              <div style={{
                paddingTop: '12px',
                borderTop: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '11px',
                color: 'var(--text-muted)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Calendar size={13} />
                  <span>{m.event_date ? new Date(m.event_date).toLocaleDateString() : 'Date Unknown'}</span>
                </div>
                {m.importance && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '3px', color: 'var(--warning)' }}>
                    <Star size={13} fill="var(--warning)" />
                    <span>{m.importance}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > pageSize && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '20px' }}>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page <= 1}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span style={{ alignSelf: 'center', fontSize: '13px', color: 'var(--text-muted)', margin: '0 8px' }}>
            Page {page} of {Math.ceil(total / pageSize)}
          </span>
          <button
            className="btn btn-secondary btn-sm"
            disabled={page >= Math.ceil(total / pageSize)}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* Record New Memory Modal */}
      {isModalOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.7)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          backdropFilter: 'blur(3px)',
        }}>
          <div className="card" style={{ maxWidth: '600px', width: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <h3 style={{ fontSize: '18px', fontWeight: '700' }}>Record Personal Memory</h3>
              <button onClick={() => setIsModalOpen(false)} style={{ color: 'var(--text-muted)' }}>
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateMemory} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                  Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Founding my first venture in Bangalore"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                  Content / Narrative *
                </label>
                <textarea
                  required
                  rows={5}
                  placeholder="Describe the experience, why decisions were made, lessons learned, and the values involved..."
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  style={{ width: '100%', resize: 'vertical' }}
                />
              </div>

              <div className="grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                    Category
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="Personal Reflection">Personal Reflection</option>
                    <option value="Childhood">Childhood</option>
                    <option value="Career & Work">Career & Work</option>
                    <option value="Family & Relationships">Family & Relationships</option>
                    <option value="Values & Philosophy">Values & Philosophy</option>
                    <option value="Education">Education</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                    Event Date (if known)
                  </label>
                  <input
                    type="date"
                    value={newEventDate}
                    onChange={(e) => setNewEventDate(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className="grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                    Memory Type (Blueprint)
                  </label>
                  <select
                    value={newMemoryType}
                    onChange={(e) => setNewMemoryType(e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="episodic">Episodic (Event/Experience)</option>
                    <option value="value">Value (Core Principle)</option>
                    <option value="semantic">Semantic (Knowledge/Fact)</option>
                    <option value="procedural">Procedural (How-to/Decision Pattern)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                    Significance (1-10): {newImportance}
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    step="0.5"
                    value={newImportance}
                    onChange={(e) => setNewImportance(e.target.value)}
                    style={{ width: '100%', accentColor: 'var(--accent-primary)' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="e.g. startup, leadership, resilience"
                  value={newTags}
                  onChange={(e) => setNewTags(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={creating}
                >
                  {creating ? 'Saving...' : 'Save to Archive'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

