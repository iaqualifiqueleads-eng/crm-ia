import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import './styles/globals.css';

import { AppLayout } from '@/components/layout/AppLayout';
import { ProtectedRoute } from '@/components/layout/ProtectedRoute';
import { LoginPage } from '@/pages/LoginPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { CustomerDetailPage } from '@/pages/CustomerDetailPage';
import { OrdersPage } from '@/pages/OrdersPage';
import { TasksPage } from '@/pages/TasksPage';
import { TemplatesPage } from '@/pages/TemplatesPage';
import { TeamPage } from '@/pages/TeamPage';
import { AutomationPage } from '@/pages/AutomationPage';
import { NotificationsPage } from '@/pages/NotificationsPage';
import { AccountPage } from '@/pages/AccountPage';

import { ChatPage } from '@/pages/ChatPage';

// Fase 3
import { AgentsPage } from '@/pages/AgentsPage';
import { PlaygroundPage } from '@/pages/PlaygroundPage';
import { AgentUsagePage } from '@/pages/AgentUsagePage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: '#0A0A0B', color: '#FAFAF7', borderRadius: 2,
              fontSize: 13, padding: '12px 16px', border: '1px solid #2A2A2F',
            },
          }}
        />

        <Routes>
          <Route path="/login" element={<LoginPage />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="customers"        element={<CustomersPage />} />
            <Route path="customers/:id"    element={<CustomerDetailPage />} />
            <Route path="orders"           element={<OrdersPage />} />
            <Route path="tasks"            element={<TasksPage />} />
            <Route path="templates"        element={<TemplatesPage />} />
            <Route path="team"             element={<TeamPage />} />
            <Route path="automation"       element={<AutomationPage />} />
            <Route path="chat"             element={<ChatPage />} />
            <Route path="chat/:customerId" element={<ChatPage />} />
            <Route path="notifications"    element={<NotificationsPage />} />
            <Route path="account"          element={<AccountPage />} />

            {/* Fase 3 */}
            <Route path="agents"                  element={<AgentsPage />} />
            <Route path="agents/:id/playground"   element={<PlaygroundPage />} />
            <Route path="agents/:id/usage"        element={<AgentUsagePage />} />
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
);
