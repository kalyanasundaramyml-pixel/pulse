import { Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { LoginPage } from './routes/LoginPage';
import { ForceChangePasswordPage } from './routes/ForceChangePasswordPage';
import { SurveyListPage } from './routes/surveys/SurveyListPage';
import { SurveyBuilderPage } from './routes/surveys/SurveyBuilderPage';
import { SurveyRecipientsPage } from './routes/surveys/SurveyRecipientsPage';
import { SurveyTakePage } from './routes/surveys/SurveyTakePage';
import { SurveyDashboardPage } from './routes/surveys/SurveyDashboardPage';
import { UserListPage } from './routes/admin/UserListPage';
import { UserImportPage } from './routes/admin/UserImportPage';
import { GroupListPage } from './routes/groups/GroupListPage';
import { GroupEditPage } from './routes/groups/GroupEditPage';
import { OneOnOneListPage } from './routes/oneOnOnes/OneOnOneListPage';
import { OneOnOneBuilderPage } from './routes/oneOnOnes/OneOnOneBuilderPage';
import { OneOnOneRecipientsPage } from './routes/oneOnOnes/OneOnOneRecipientsPage';
import { OneOnOneTakePage } from './routes/oneOnOnes/OneOnOneTakePage';
import { OneOnOneTrendPage } from './routes/oneOnOnes/OneOnOneTrendPage';
import { TemplatesHubPage } from './routes/templates/TemplatesHubPage';
import { SurveyTemplateListPage } from './routes/templates/SurveyTemplateListPage';
import { OneOnOneTemplateListPage } from './routes/templates/OneOnOneTemplateListPage';
import { HelpPage } from './routes/help/HelpPage';

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/change-password" element={<ForceChangePasswordPage />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/surveys" replace />} />
          <Route path="/surveys" element={<SurveyListPage />} />
          <Route path="/surveys/:id/take" element={<SurveyTakePage />} />
          <Route path="/surveys/:id/dashboard" element={<SurveyDashboardPage />} />

          <Route path="/one-on-ones" element={<OneOnOneListPage />} />
          <Route path="/one-on-ones/runs/:runId/take" element={<OneOnOneTakePage />} />
          <Route path="/help" element={<HelpPage />} />

          <Route element={<ProtectedRoute roles={['LEADER', 'ADMIN']} />}>
            <Route path="/surveys/new" element={<SurveyBuilderPage />} />
            <Route path="/surveys/templates" element={<SurveyTemplateListPage variant="pick" />} />
            <Route path="/surveys/:id/edit" element={<SurveyBuilderPage />} />
            <Route path="/surveys/:id/recipients" element={<SurveyRecipientsPage />} />
            <Route path="/groups" element={<GroupListPage />} />
            <Route path="/groups/:id" element={<GroupEditPage />} />
            <Route path="/templates" element={<TemplatesHubPage />} />
            <Route path="/templates/surveys" element={<SurveyTemplateListPage />} />
            <Route path="/templates/one-on-ones" element={<OneOnOneTemplateListPage />} />
            <Route path="/one-on-ones/new" element={<OneOnOneBuilderPage />} />
            <Route path="/one-on-ones/templates" element={<OneOnOneTemplateListPage variant="pick" />} />
            <Route path="/one-on-ones/:id/edit" element={<OneOnOneBuilderPage />} />
            <Route path="/one-on-ones/:id/recipients" element={<OneOnOneRecipientsPage />} />
            <Route path="/one-on-ones/:id/trend/:userId" element={<OneOnOneTrendPage />} />
          </Route>

          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="/admin/users" element={<UserListPage />} />
            <Route path="/admin/users/import" element={<UserImportPage />} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
