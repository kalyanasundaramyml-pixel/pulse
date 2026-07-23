import { Link } from 'react-router-dom';

export function TemplatesHubPage() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Templates</h1>
      </div>
      <p className="muted">Reusable question sets you can start a survey or a 1:1 from, without rebuilding from scratch.</p>

      <div className="template-hub-grid">
        <Link to="/templates/surveys" className="template-hub-card">
          <h2>Survey templates</h2>
          <p className="muted">Browse your saved survey templates and public ones shared by other creators.</p>
        </Link>
        <Link to="/templates/one-on-ones" className="template-hub-card">
          <h2>One-on-One templates</h2>
          <p className="muted">Browse your saved 1:1 templates and public ones shared by other creators.</p>
        </Link>
      </div>
    </div>
  );
}
