import { ReactNode } from "react";
import { Header } from "./header";
import { Footer } from "./footer";
import { JobsStatus } from "./jobs-status";

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  return (
    <div className="flex h-screen min-h-screen flex-col overflow-hidden bg-dark-50">
      <Header />
      <JobsStatus />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        {children}
        <Footer />
      </main>
    </div>
  );
}
