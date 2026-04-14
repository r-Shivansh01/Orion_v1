import React from 'react';

interface QASeverityBadgeProps {
  severity: number | null | undefined;
}

const QASeverityBadge: React.FC<QASeverityBadgeProps> = ({ severity }) => {
  if (severity === null || severity === undefined) return null;

  const getColors = () => {
    if (severity <= 3) return 'bg-green-500/10 text-green-500 border-green-500/50';
    if (severity <= 7) return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/50';
    return 'bg-red-500/10 text-red-500 border-red-500/50';
  };

  return (
    <span className={`px-2 py-0.5 text-xs font-mono border rounded-full ${getColors()}`}>
      QA Severity: {severity}/10
    </span>
  );
};

export default QASeverityBadge;
