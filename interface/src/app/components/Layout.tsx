import { Outlet } from 'react-router';
import { Header } from './Header';

export function Layout() {
  return (
    <div className="size-full flex flex-col">
      <Header />
      <main className="flex-1 overflow-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}
