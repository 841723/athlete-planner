import { ReactNode } from "react";
import { Header } from "./header";
import { Footer } from "./footer";

interface ShellProps {
  children: ReactNode;
}

export function Shell({ children }: ShellProps) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-dark-50">
      <Header />
      <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
        {children}
        <Footer />
      </main>
    </div>
  );
}