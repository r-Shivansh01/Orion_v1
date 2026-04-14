import React from 'react';
import Link from 'next/link';
import { Clock, CheckCircle, XCircle, PlayCircle, Loader2 } from 'lucide-react';
import QASeverityBadge from './QASeverityBadge';

interface JobCardProps {
  job: {
    id: string;
    prompt: string;
    status: string;
    qaSeverity?: number | null;
    createdAt: string;
  };
}

const JobCard: React.FC<JobCardProps> = ({ job }) => {
  const getStatusIcon = () => {
    switch (job.status) {
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'FAILED':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'PENDING':
        return <Clock className="w-5 h-5 text-gray-400" />;
      default:
        return <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />;
    }
  };

  return (
    <div className="card hover:border-gray-700 transition-colors">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-medium text-gray-100 truncate flex-1 mr-2" title={job.prompt}>
          {job.prompt}
        </h3>
        {getStatusIcon()}
      </div>
      
      <div className="flex flex-wrap items-center gap-2 mb-4 text-xs text-gray-400">
        <span>{new Date(job.createdAt).toLocaleString()}</span>
        <span>•</span>
        <span className="uppercase font-mono">{job.status}</span>
        {job.qaSeverity !== undefined && <QASeverityBadge severity={job.qaSeverity} />}
      </div>

      <div className="flex gap-2">
        <Link href={`/jobs/${job.id}`} className="btn btn-secondary btn-sm flex items-center gap-1">
          <PlayCircle className="w-4 h-4" />
          Live View
        </Link>
        {(job.status === 'COMPLETED' || job.status === 'FAILED') && (
          <Link href={`/replay/${job.id}`} className="btn btn-secondary btn-sm flex items-center gap-1">
            <Clock className="w-4 h-4" />
            Replay
          </Link>
        )}
      </div>
    </div>
  );
};

export default JobCard;
