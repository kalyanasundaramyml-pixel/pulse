import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { oneOnOnesApi } from '../../api/oneOnOnes';
import { OneOnOneTemplateDetail, OneOnOneTrendResponse } from '../../types/api';
import { ApiError } from '../../api/client';
import { TrendChart } from '../../components/oneOnOnes/TrendChart';
import { TextResponseList } from '../../components/dashboard/TextResponseList';

export function OneOnOneTrendPage() {
  const { id, userId } = useParams<{ id: string; userId: string }>();
  const [template, setTemplate] = useState<OneOnOneTemplateDetail | null>(null);
  const [trend, setTrend] = useState<OneOnOneTrendResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id || !userId) return;
    Promise.all([oneOnOnesApi.get(id), oneOnOnesApi.getTrend(id, userId)])
      .then(([templateRes, trendRes]) => {
        setTemplate(templateRes.template);
        setTrend(trendRes);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load trend'))
      .finally(() => setLoading(false));
  }, [id, userId]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p className="form-error">{error}</p>;
  if (!template || !trend) return null;

  const recipient = template.recipients.find((r) => r.user.id === userId)?.user;

  return (
    <div className="page">
      <h1>
        {template.title} — {recipient?.name ?? 'Trend'}
      </h1>
      <p className="muted">
        {trend.runCount} completed run{trend.runCount === 1 ? '' : 's'}, oldest to newest.
      </p>

      {trend.runCount === 0 ? (
        <p className="empty-state">No completed runs yet for this person.</p>
      ) : (
        <section className="question-summaries">
          {trend.questions.map((series) => {
            const question = template.questions.find((q) => q.id === series.questionId);
            return (
              <div className="question-summary-card" key={series.questionId}>
                <h3>{series.prompt}</h3>
                {series.type === 'RATING' && (
                  <TrendChart
                    points={series.points as { runId: string; submittedAt: string; value: number | null }[]}
                    min={question?.ratingScaleMin ?? 1}
                    max={question?.ratingScaleMax ?? 5}
                  />
                )}
                {series.type === 'TEXT' && (
                  <TextResponseList
                    responses={(series.points as { submittedAt: string; text: string | null }[])
                      .filter((p) => p.text)
                      .map((p) => `${new Date(p.submittedAt).toLocaleDateString()}: ${p.text}`)}
                  />
                )}
                {(series.type === 'SINGLE_CHOICE' || series.type === 'MULTI_CHOICE') && (
                  <TextResponseList
                    responses={(series.points as { submittedAt: string; selectedLabels: string[] }[])
                      .filter((p) => p.selectedLabels.length > 0)
                      .map((p) => `${new Date(p.submittedAt).toLocaleDateString()}: ${p.selectedLabels.join(', ')}`)}
                  />
                )}
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
