import { Sidebar } from "./Sidebar";

export function Layout({ children }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 ml-60 min-h-screen">
        <div className="max-w-screen-2xl mx-auto px-6 xl:px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
