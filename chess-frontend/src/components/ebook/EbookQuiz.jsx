import React, { useState } from 'react';

export default function EbookQuiz({ quiz, onSolved }) {
  const [selectedId, setSelectedId] = useState(null);

  const selected = quiz.options?.find((option) => option.id === selectedId);
  const isCorrect = Boolean(selected?.isCorrect);

  const handleSelect = (option) => {
    setSelectedId(option.id);
    if (option.isCorrect && onSolved) {
      onSolved(true);
    }
  };

  return (
    <div style={{
      margin: '16px 0',
      padding: 14,
      border: '1px solid #d8e2d1',
      borderRadius: 8,
      background: '#fbfcfa',
    }}>
      {quiz.title && (
        <div style={{ fontSize: 14, fontWeight: 700, color: '#2f3a2c', marginBottom: 8 }}>
          {quiz.title}
        </div>
      )}
      {quiz.questionHtml && (
        <div
          style={{ fontSize: 14, color: '#333', lineHeight: 1.6, marginBottom: 10 }}
          dangerouslySetInnerHTML={{ __html: quiz.questionHtml }}
        />
      )}
      <div style={{ display: 'grid', gap: 8 }}>
        {(quiz.options || []).map((option) => {
          const isSelected = selectedId === option.id;
          const background = isSelected
            ? option.isCorrect ? '#e8f5e9' : '#fff1f1'
            : '#fff';
          const borderColor = isSelected
            ? option.isCorrect ? '#81b64c' : '#dc3c3c'
            : '#d6d6d6';

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => handleSelect(option)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '10px 12px',
                border: `1px solid ${borderColor}`,
                borderRadius: 6,
                background,
                color: '#222',
                cursor: 'pointer',
                fontSize: 14,
                lineHeight: 1.35,
              }}
            >
              {option.label}
            </button>
          );
        })}
      </div>
      {selected && (
        <div style={{
          marginTop: 10,
          padding: '8px 10px',
          borderRadius: 6,
          background: isCorrect ? '#e8f5e9' : '#fff1f1',
          color: isCorrect ? '#2e7d32' : '#a62727',
          fontSize: 13,
          lineHeight: 1.5,
        }}>
          {selected.feedback || (isCorrect ? quiz.successMessage : 'Try again.')}
        </div>
      )}
    </div>
  );
}

