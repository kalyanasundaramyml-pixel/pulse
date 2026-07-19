import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { dashboardApi } from '../../api/dashboard';
import { DashboardDTO } from '../../types/api';
import { ApiError } from '../../api/client';
import { CompletionRateBar } from '../../components/dashboard/CompletionRateBar';
import { RatingDistributionChart } from '../../components/dashboard/RatingDistributionChart';
import { ChoiceTallyChart } from '../../components/dashboard/ChoiceTallyChart';
import { TextResponseList } from '../../components/dashboard/TextResponseList';
import { RespondentTable } from '../../components/dashboard/RespondentTable';
import { AnonymityBadge } from '../../components/surveys/AnonymityBadge';

export function SurveyDashboardPage() {
  const { id } = useParams<{ id: string }>();
  const [dashboard, setDashboard] = useState<DashboardDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    dashboardApi
      .get(id)
      .then(setDashboard)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!dashboard) return null;

  return (
    <div className="page">
      <h1>{dashboard.survey.title} — Dashboard</h1>
      <AnonymityBadge isAnonymous={dashboard.survey.isAnonymous} />
      <CompletionRateBar {...dashboard.completion} />

      <section className="question-summaries">
        {dashboard.questions.map((q) => (
          <div className="question-summary-card" key={q.questionId}>
            <h3>{q.prompt}</h3>
            {q.summary.withheld ? (
              <p className="muted">
                Results withheld to protect anonymity: only {q.summary.responseCount} of at least{' '}
                {q.summary.minRequired} required responses received so far.
              </p>
            ) : q.type === 'RATING' && 'distribution' in q.summary ? (
              <>
                <RatingDistributionChart average={q.summary.average} distribution={q.summary.distribution} />
                {q.summary.comments.length > 0 && (
                  <div className="question-summary-comments">
                    <h4>Comments</h4>
                    <TextResponseList responses={q.summary.comments} />
                  </div>
                )}
              </>
            ) : q.type === 'TEXT' && 'responses' in q.summary ? (
              <TextResponseList responses={q.summary.responses} />
            ) : 'tally' in q.summary && q.options ? (
              <>
                <ChoiceTallyChart tally={q.summary.tally} options={q.options} />
                {q.summary.comments.length > 0 && (
                  <div className="question-summary-comments">
                    <h4>Comments</h4>
                    <TextResponseList responses={q.summary.comments} />
                  </div>
                )}
              </>
            ) : null}
          </div>
        ))}
      </section>

      {'respondents' in dashboard && (
        <section>
          <h2>Respondents</h2>
          <RespondentTable respondents={dashboard.respondents} />
        </section>
      )}
    </div>
  );
}
