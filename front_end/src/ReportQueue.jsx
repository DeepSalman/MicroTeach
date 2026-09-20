import React from 'react';
import './ReportQueue.css';

const ReportQueue = ({ user }) => {

  const reportedPosts = [
    {
      id: 'MT-8842',
      course: 'CSE 221: Algorithms',
      time: '12m ago',
      author: 'Tanvir Ahmed (#21101428)',
      content: 'Student states code snippets provided failed testcases 10 minutes prior to LMS window close.',
      violation: 'Escrow Dispute',
    },
    {
      id: 'MT-8839',
      course: 'CSE 221',
      time: '28m ago',
      author: 'anonymous_student_91',
      content: 'Automated code scanner flagged 98.4% match with exam repository.',
      violation: 'Academic Integrity',
    },
    {
      id: 'MT-8831',
      course: 'Mathematics Dept',
      time: '45m ago',
      author: 'Nusrat Jahan',
      content: 'Candidate uploaded official transcript PDF for tutor verification.',
      violation: 'Credential Review',
    },
    {
      id: 'MT-8815',
      course: 'Session #SES-4920',
      time: '1h ago',
      author: 'Rafiqul Islam',
      content: 'Tutor inactive for >15 mins. Failed to join scheduled Google Meet.',
      violation: 'No-Show Report',
    },
  ];

  return (
    <div className="admin-content">
      <div className="page-header">
        <div className="page-header-left">
          <div className="breadcrumb">
            <span>Institutional Governance</span>
            <span className="breadcrumb-sep">›</span>
            <span className="breadcrumb-active">Report Queue</span>
          </div>
          <h1 className="page-title">Report Queue</h1>
        </div>
      </div>

      <div className="rq-queue">
        {reportedPosts.map((item) => (
          <div key={item.id} className="rq-card">
            <div className="rq-card-header">
              <div className="rq-card-left">
                <span className="rq-id">#{item.id}</span>
                <span className="rq-dot">•</span>
                <span className="rq-course">{item.course}</span>
                <span className="rq-dot">•</span>
                <span className="rq-time">{item.time}</span>
              </div>
            </div>

            <div className="rq-card-body">
              <div className="rq-requestor">
                <span className="rq-author">{item.author}</span>
                <span className="rq-violation">{item.violation}</span>
              </div>
              <p className="rq-content">{item.content}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ReportQueue;
