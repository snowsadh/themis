import React from 'react';

const LEGAL_TERMS = [
  'article 21', 'article 14', 'article 19', 'article 32',
  'res judicata', 'habeas corpus', 'audi alteram partem',
  'stare decisis', 'basic structure', 'judicial review',
  'precedent', 'appellant', 'respondent', 'jurisdiction',
  'puttaswamy', 'fundamental right', 'ultra vires'
];

export const highlightLegalTerms = (text) => {
  if (!text) return text;
  
  // Create a case-insensitive regex for all terms
  const regex = new RegExp(`(${LEGAL_TERMS.join('|')})`, 'gi');
  const parts = text.split(regex);
  
  return parts.map((part, i) => {
    if (LEGAL_TERMS.includes(part.toLowerCase())) {
      return (
        <span key={i} style={{ 
          color: '#c9a84c', 
          fontWeight: 'bold', 
          textShadow: '0 0 8px rgba(201,168,76,0.3)' 
        }}>
          {part}
        </span>
      );
    }
    return part;
  });
};
