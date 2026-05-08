/* global require */
import React, { useState, useEffect, useCallback } from 'react';
import EbookChapter from './EbookChapter';
import { adaptV2Chapter } from './utils/ebookV2Adapter';
import { useSubscription } from '../../contexts/SubscriptionContext';
import { canAccessTier, getSubscriptionLabel } from '../../constants/learningCurriculum';

const manifestContext = require.context('../../data/ebooks/v2', true, /manifest\.json$/);
const chapterContext = require.context('../../data/ebooks/v2', true, /chapters\/.*\.json$/);

const loadContextValue = (context, key) => {
  const value = context(key);
  return value.default || value;
};

const EBOOK_LIBRARY = manifestContext.keys()
  .map((manifestPath) => loadContextValue(manifestContext, manifestPath))
  .sort((a, b) => (a.seriesPosition || 0) - (b.seriesPosition || 0))
  .map((manifest) => ({
    manifest,
    chapters: manifest.chapterOrder.map((chapter) => ({
      ...chapter,
      id: `${manifest.bookId}:${chapter.chapterId}`,
      loader: () => Promise.resolve(loadContextValue(
        chapterContext,
        `./${manifest.bookId}/${chapter.path}`,
      )),
    })),
  }));

const CHAPTER_INDEX = EBOOK_LIBRARY.reduce((index, book) => {
  book.chapters.forEach((chapter) => {
    index[chapter.id] = {
      ...chapter,
      book: book.manifest,
    };
  });
  return index;
}, {});

const FIRST_CHAPTER_ID = EBOOK_LIBRARY[0].chapters[0].id;
const STORAGE_KEY = 'chess99_ebook_progress_v2';

function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch { /* ignore */ }
}

export default function EbookViewer() {
  const { currentTier } = useSubscription();
  const [activeChapterId, setActiveChapterId] = useState(FIRST_CHAPTER_ID);
  const [chapters, setChapters] = useState({});
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(loadProgress);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const id = activeChapterId;
    if (chapters[id]) {
      setLoading(false);
      return;
    }

    const info = CHAPTER_INDEX[id];
    if (!info) {
      setLoading(false);
      return;
    }

    setLoading(true);
    info.loader()
      .then((module) => {
        const rawChapter = module.default || module;
        setChapters((prev) => ({
          ...prev,
          [id]: adaptV2Chapter(info.book, rawChapter),
        }));
        setLoading(false);
      })
      .catch((err) => {
        console.error(`Failed to load ebook chapter ${id}:`, err);
        setLoading(false);
      });
  }, [activeChapterId, chapters]);

  const handleSectionComplete = useCallback((chapterId, sectionId, success) => {
    setProgress((prev) => {
      const next = { ...prev };
      if (!next[chapterId]) next[chapterId] = { completedSections: [], puzzlesSolved: 0 };
      if (!next[chapterId].completedSections.includes(sectionId)) {
        next[chapterId].completedSections.push(sectionId);
      }
      if (success) next[chapterId].puzzlesSolved = (next[chapterId].puzzlesSolved || 0) + 1;
      saveProgress(next);
      return next;
    });
  }, []);

  const chapterProgress = (id) => {
    const cp = progress[id];
    const chapter = chapters[id];
    if (!chapter || !cp) return 0;
    const checkpointBlocks = chapter.checkpoint?.blocks?.length || 0;
    const totalSections = (chapter.sections?.length || 1) + checkpointBlocks;
    return Math.min(100, Math.round((cp.completedSections?.length || 0) / totalSections * 100));
  };

  const currentChapter = chapters[activeChapterId];

  return (
    <div className="ebook-viewer" style={{ display: 'flex', minHeight: '100vh', background: '#f7f8f6' }}>
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        style={{
          position: 'fixed', bottom: 20, right: 20, zIndex: 100,
          height: 44, borderRadius: 8, border: 'none', padding: '0 14px',
          background: '#81b64c', color: '#fff', fontSize: 13, fontWeight: 700,
          cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}
        className="ebook-mobile-toggle"
      >
        Menu
      </button>

      <div
        className="ebook-sidebar"
        style={{
          width: sidebarOpen ? 300 : 0,
          minWidth: sidebarOpen ? 300 : 0,
          transition: 'width 0.3s, min-width 0.3s',
          overflow: 'hidden',
          background: '#fff',
          borderRight: '1px solid #e1e5dc',
          position: 'sticky',
          top: 0,
          height: '100vh',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 10,
        }}
      >
        <div style={{ padding: '20px 16px', borderBottom: '1px solid #e1e5dc' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: '#1f2a1a', margin: 0 }}>
            Chess99 E-Books
          </h2>
          <p style={{ fontSize: 12, color: '#65705f', margin: '5px 0 0', lineHeight: 1.4 }}>
            Structured v2 learning library
          </p>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '10px 0' }}>
          {EBOOK_LIBRARY.map(({ manifest, chapters: bookChapters }) => (
            <div key={manifest.bookId} style={{ padding: '8px 0 14px' }}>
              <div style={{ padding: '0 16px 8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#263320' }}>{manifest.title}</div>
                  <span style={{
                    fontSize: 10,
                    color: '#2e7d32',
                    border: '1px solid #c8e6c9',
                    borderRadius: 999,
                    padding: '2px 7px',
                    background: '#f5fbf1',
                    textTransform: 'uppercase',
                  }}>
                    {getSubscriptionLabel(manifest.requiredTier)}
                  </span>
                </div>
                <div style={{ fontSize: 11, color: '#7a8274', marginTop: 3 }}>
                  ELO {manifest.eloStart}-{manifest.eloEnd}
                </div>
              </div>

              {bookChapters.map((chapter) => {
                const isActive = chapter.id === activeChapterId;
                const locked = !canAccessTier(currentTier, chapter.requiredTier || manifest.requiredTier);
                const pct = chapterProgress(chapter.id);

                return (
                  <button
                    key={chapter.id}
                    onClick={() => { if (!locked) setActiveChapterId(chapter.id); }}
                    disabled={locked}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '12px 16px',
                      border: 'none',
                      borderLeft: isActive ? '3px solid #81b64c' : '3px solid transparent',
                      background: isActive ? '#f1f8e9' : 'transparent',
                      cursor: locked ? 'not-allowed' : 'pointer',
                      fontSize: 14,
                      color: locked ? '#9aa096' : isActive ? '#1a1a1a' : '#4c5547',
                      fontWeight: isActive ? 700 : 500,
                      opacity: locked ? 0.65 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                      <span>{chapter.title}</span>
                      <span style={{ fontSize: 10, color: '#9aa096', whiteSpace: 'nowrap' }}>
                        {chapter.estimatedMinutes} min
                      </span>
                    </div>
                    {locked && (
                      <div style={{ fontSize: 11, color: '#9a6a12', marginTop: 4 }}>
                        Requires {getSubscriptionLabel(chapter.requiredTier || manifest.requiredTier)}
                      </div>
                    )}
                    {pct > 0 && (
                      <div style={{ marginTop: 7, height: 3, borderRadius: 2, background: '#e6e9e1', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: '#81b64c', borderRadius: 2, transition: 'width 0.3s' }} />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ padding: '12px 16px', borderTop: '1px solid #e1e5dc', fontSize: 11, color: '#7a8274', lineHeight: 1.45 }}>
          Progress saved locally. Current tier: {getSubscriptionLabel(currentTier)}.
        </div>
      </div>

      <div className="ebook-content" style={{ flex: 1, padding: '20px 24px', overflowY: 'auto' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 300 }}>
            <div style={{ color: '#778070', fontSize: 15 }}>Loading chapter...</div>
          </div>
        ) : currentChapter ? (
          <EbookChapter
            chapter={currentChapter}
            onSectionComplete={handleSectionComplete}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: 60, color: '#778070' }}>
            <p>Chapter data not available.</p>
            <p style={{ fontSize: 13 }}>The v2 ebook package may be missing a chapter file.</p>
          </div>
        )}
      </div>
    </div>
  );
}
