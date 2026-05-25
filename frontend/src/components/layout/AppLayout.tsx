import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export function AppLayout() {
  return (
    <div className="min-h-screen flex bg-pearl text-onyx">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header />
        <main className="flex-1 px-6 lg:px-10 py-10">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
