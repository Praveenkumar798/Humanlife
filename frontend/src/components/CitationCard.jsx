import React, { useState } from 'react';
import { BookMarked, FileText, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

export default function CitationCard({ citation, onOpenMemory }) {
  const [expanded, setExpanded] = useState(false);

  const isPdf = citation.source_type === 'pdf';
  const Icon = isPdf ? FileText : BookMarked;

  const scorePercent = Math.round(citation.similarity_score * 100);

  return (
    <div style={{
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--radius-sm)',
      backgroundColor: 'var(--bg-primary)',
      padding: '12px 14px',
      marginBottom: '10px',
      fontSize: '13px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
          <Icon size={16} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
          <span style={{ fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {citation.memory_title}
          </span>
          {citation.page_number && (
            <span className="badge badge-info" style={{ fontSize: '11px', padding: '2px 6px' }}>
              Page {citation.page_number}
            </span>
          )}
          {citation.filename && (
            <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>
              ({citation.filename})
            </span>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span className="badge badge-success" style={{ fontSize: '11px', padding: '2px 6px' }}>
            {scorePercent}% Match
          </span>
          {onOpenMemory && (
            <button
              onClick={() => onOpenMemory(citation.memory_id)}
              title="Open full memory"
              style={{ color: 'var(--accent-primary)', display: 'flex', alignItems: 'center' }}
            >
              <ExternalLink size={14} />
            </button>
          )}
          <button
            onClick={() => setExpanded(!expanded)}
            style={{ color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}
          >
            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
        </div>
      </div>

      {expanded && (
        <div style={{
          marginTop: '10px',
          paddingTop: '10px',
          borderTop: '1px solid var(--border-color)',
          color: 'var(--text-secondary)',
          lineHeight: '1.6',
          whiteSpace: 'pre-wrap',
          fontSize: '12px',
        }}>
          "{citation.chunk_text}"
        </div>
      )}
    </div>
  );
}

