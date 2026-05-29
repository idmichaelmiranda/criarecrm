import { useState } from "react";
import { Sidebar } from "./Sidebar";

export function Layout({ children }) {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem("sidebar_collapsed") === "true"
  );

  function toggle() {
    setCollapsed((v) => {
      localStorage.setItem("sidebar_collapsed", String(!v));
      return !v;
    });
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <main
        className="flex-1 min-h-screen transition-[margin] duration-300 ease-in-out"
        style={{ marginLeft: collapsed ? "64px" : "240px" }}
      >
        <div className="max-w-screen-2xl mx-auto px-6 xl:px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
