import React, { useState, useRef, useEffect } from 'react';
import EbookBoard from './EbookBoard';
import EbookPuzzle from './EbookPuzzle';
import EbookQuiz from './EbookQuiz';

export default function EbookChapter({ chapter, onSectionComplete }) {
  const [expandedSections, setExpandedSections] = useState(() => {
    const initial = {};
    chapter?.sections?.forEach((s, i) => { initial[i] = true; });
    return initial;
  });
  const sectionRefs = useRef([]);

  const toggleSection = (idx) => {
    setExpandedSections(prev => ({ ...prev, [idx]: !prev[idx] }));
  };

  useEffect(() => {
    sectionRefs.current = sectionRefs.current.slice(0, chapter?.sections?.length || 0);
  }, [chapter]);

  useEffect(() => {
    const initial = {};
    chapter?.sections?.forEach((s, i) => { initial[i] = true; });
    setExpandedSections(initial);
  }, [chapter?.id, chapter?.sections]);

  if (!chapter) {
    return <div className="ebook-loading" style={{ padding: 40, textAlign: 'center', color: '#999' }}>Loading chapter...</div>;
  }

  const completeBlock = (block, success = true) => {
    if (onSectionComplete) {
      onSectionComplete(chapter.id, block.id || block.sectionId || 'unknown-block', success);
    }
  };

  const renderBlock = (block, blockIdx) => {
    switch (block.type) {
      case 'text':
      case 'prose':
        return (
          <div
            key={blockIdx}
            className="ebook-text"
            dangerouslySetInnerHTML={{ __html: block.html }}
            style={{ lineHeight: 1.7, fontSize: 15, color: '#333' }}
          />
        );

      case 'board':
      case 'board_diagram':
        return (
          <EbookBoard
            key={blockIdx}
            fen={block.fen}
            arrows={block.arrows || []}
            highlights={block.highlights || []}
            orientation={block.orientation || 'white'}
            interactive={block.interactive || false}
            caption={block.caption || ''}
            boardSize={block.size || 360}
          />
        );

      case 'animation':
      case 'board_animation':
        return (
          <EbookBoard
            key={blockIdx}
            fen={block.fen}
            animationSequence={block.sequence || []}
            animationSpeed={block.speed || 'normal'}
            animationLoop={block.loop || false}
            orientation={block.orientation || 'white'}
            caption={block.caption || ''}
            arrows={block.arrows || []}
            highlights={block.highlights || []}
            boardSize={block.size || 360}
          />
        );

      case 'interactive':
      case 'guided_move':
        return (
          <div key={blockIdx} style={{ margin: '14px 0' }}>
            {block.promptHtml && (
              <div
                style={{ lineHeight: 1.65, fontSize: 14, color: '#333', marginBottom: 8 }}
                dangerouslySetInnerHTML={{ __html: block.promptHtml }}
              />
            )}
            <EbookBoard
              fen={block.fen}
              interactive={true}
              orientation={block.orientation || 'white'}
              caption={block.caption || ''}
              arrows={block.arrows || []}
              highlights={block.highlights || []}
              boardSize={block.size || 360}
              acceptedMoves={block.acceptedMoves || []}
              successMessage={block.successMessage}
              failureMessage={block.failureMessage}
              onMoveAccepted={() => completeBlock(block, true)}
            />
          </div>
        );

      case 'puzzle':
        return (
          <EbookPuzzle
            key={blockIdx}
            puzzle={block.puzzle}
            boardSize={block.size || 320}
            onSolved={(success, wrongCount) => {
              if (onSectionComplete) onSectionComplete(chapter.id, block.sectionId, success);
            }}
          />
        );

      case 'mistake_refutation':
        return (
          <div
            key={blockIdx}
            style={{
              margin: '16px 0',
              padding: 14,
              border: '1px solid #f0c8c8',
              borderRadius: 8,
              background: '#fffafa',
            }}
          >
            {block.title && (
              <div style={{ fontSize: 14, fontWeight: 700, color: '#7a2525', marginBottom: 8 }}>
                {block.title}
              </div>
            )}
            {block.html && (
              <div
                style={{ lineHeight: 1.65, fontSize: 14, color: '#333' }}
                dangerouslySetInnerHTML={{ __html: block.html }}
              />
            )}
            <EbookBoard
              fen={block.fen}
              orientation={block.orientation || 'white'}
              caption={block.caption || ''}
              arrows={block.arrows || []}
              highlights={block.highlights || []}
              boardSize={block.size || 340}
            />
          </div>
        );

      case 'quiz':
        return (
          <EbookQuiz
            key={blockIdx}
            quiz={block}
            onSolved={() => completeBlock(block, true)}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="ebook-chapter" style={{ maxWidth: 720, margin: '0 auto', padding: '20px 0' }}>
      <div className="ebook-chapter-header" style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 12, color: '#888', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
          ELO {chapter.eloRange}
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, color: '#1a1a1a', margin: 0 }}>{chapter.title}</h1>
        {chapter.subtitle && (
          <p style={{ fontSize: 15, color: '#666', fontStyle: 'italic', marginTop: 6 }}>{chapter.subtitle}</p>
        )}
      </div>

      {chapter.sections.map((section, sIdx) => (
        <div key={sIdx} className="ebook-section" style={{ marginBottom: 24 }} ref={el => sectionRefs.current[sIdx] = el}>
          <div
            onClick={() => toggleSection(sIdx)}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
              padding: '8px 0', borderBottom: '2px solid #e8e8e8', marginBottom: 12,
              userSelect: 'none',
            }}
          >
            <span style={{
              fontSize: 14, color: '#81b64c', transition: 'transform 0.2s',
              transform: expandedSections[sIdx] ? 'rotate(90deg)' : 'rotate(0deg)',
              display: 'inline-block',
            }}>&gt;</span>
            <h2 style={{ fontSize: 20, fontWeight: 600, color: '#333', margin: 0 }}>
              {section.title}
            </h2>
          </div>

          {expandedSections[sIdx] && (
            <div className="ebook-section-body" style={{ paddingLeft: 8 }}>
              {section.blocks.map((block, bIdx) => renderBlock(block, `${sIdx}-${bIdx}`))}
            </div>
          )}
        </div>
      ))}

      {typeof chapter.checkpoint === 'string' && (
        <div style={{
          marginTop: 24, padding: 16, borderRadius: 10,
          background: 'linear-gradient(135deg, #e8f5e9, #f1f8e9)',
          border: '1px solid #c8e6c9',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2e7d32', marginBottom: 6 }}>Chapter Checkpoint</div>
          <p style={{ fontSize: 14, color: '#33691e', margin: 0 }}>{chapter.checkpoint}</p>
        </div>
      )}

      {chapter.checkpoint && typeof chapter.checkpoint === 'object' && (
        <div style={{
          marginTop: 24,
          padding: 16,
          borderRadius: 8,
          background: '#f5fbf1',
          border: '1px solid #c8e6c9',
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#2e7d32', marginBottom: 6 }}>
            {chapter.checkpoint.title || 'Chapter Checkpoint'}
          </div>
          {chapter.checkpoint.summaryHtml && (
            <div
              style={{ fontSize: 14, color: '#33691e', lineHeight: 1.6, marginBottom: 10 }}
              dangerouslySetInnerHTML={{ __html: chapter.checkpoint.summaryHtml }}
            />
          )}
          {(chapter.checkpoint.blocks || []).map((block, idx) => renderBlock(block, `checkpoint-${idx}`))}
        </div>
      )}

      {chapter.summary && (
        <div style={{ marginTop: 24, padding: 16, borderRadius: 10, background: '#f5f5f5', border: '1px solid #e0e0e0' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#555', marginBottom: 8 }}>Summary Table</div>
          <div style={{ fontSize: 14, color: '#333' }} dangerouslySetInnerHTML={{ __html: chapter.summary }} />
        </div>
      )}
    </div>
  );
}
