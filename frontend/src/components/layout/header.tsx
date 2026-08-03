import { Link, useLocation } from "react-router-dom";
import { Calendar, ChartBar, Target, Home, Menu, X, Trophy } from "lucide-react";
import { useState } from "react";

const navItems = [
  { path: "/", label: "Inicio", icon: Home },
  { path: "/calendar", label: "Calendario", icon: Calendar },
  { path: "/weekly", label: "Semanal", icon: ChartBar },
  { path: "/goals", label: "Objetivos", icon: Target },
  { path: "/stats", label: "Estadísticas", icon: Trophy },
];

function IronmanLogo() {
  return (
      <svg
          width='30'
          height='37'
          viewBox='0 0 30 37'
          fill='none'
          xmlns='http://www.w3.org/2000/svg'
      >
          <g id='M Dot'>
              <path
                  id='Vector'
                  d='M28.3953 36.1078C27.7207 36.1078 27.177 35.5494 27.177 34.8714C27.177 34.1934 27.7272 33.6351 28.3953 33.6351C29.0635 33.6351 29.6137 34.1868 29.6137 34.8714C29.6137 35.5561 29.0635 36.1078 28.3953 36.1078ZM28.3953 33.2429C27.5111 33.2429 26.7905 33.9741 26.7905 34.8714C26.7905 35.7688 27.5111 36.4999 28.3953 36.4999C29.2796 36.4999 30.0001 35.7688 30.0001 34.8714C30.0001 33.9741 29.2796 33.2429 28.3953 33.2429Z'
                  fill='#C8102E'
              />
              <path
                  id='Vector_2'
                  d='M28.467 34.9048H28.1198V34.3465H28.4604C28.6439 34.3465 28.729 34.4329 28.729 34.619C28.729 34.8051 28.657 34.9048 28.467 34.9048ZM29.0172 34.6124C29.0172 34.2335 28.8404 34.074 28.4604 34.074H27.8447V35.7357H28.1198V35.1707H28.4866L28.7094 35.7357H29.0172L28.7618 35.0843C28.9321 34.9979 29.0172 34.8583 29.0172 34.6057'
                  fill='#C8102E'
              />
              <path
                  id='Vector_3'
                  d='M19.1331 6.92098C19.1331 10.4705 16.2968 13.342 12.8055 13.342C9.31427 13.342 6.47803 10.4638 6.47803 6.92098C6.47803 3.37814 9.30772 0.5 12.8055 0.5C16.3034 0.5 19.1331 3.37814 19.1331 6.92098Z'
                  fill='#C8102E'
              />
              <path
                  id='Vector_4'
                  d='M0 14.5452V36.4935H7.67686V28.3376L10.5983 36.4935H15.0065L17.9279 28.3376V36.4935H25.6048V14.5452H0Z'
                  fill='#C8102E'
              />
          </g>
      </svg>
  );
}

export function Header() {
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <header className="sticky top-0 z-40 glass border-b border-white/5 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            className="btn-icon lg:hidden"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <Link to="/" className="flex items-center gap-2 text-[#C8102E]">
            <IronmanLogo />
            <span className="font-bold text-lg hidden sm:block uppercase">Ironman 70.3</span>
          </Link>
        </div>
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`btn px-3 py-1.5 text-sm ${
                  isActive
                    ? "bg-accent/20 text-accent-light"
                    : "text-gray-400 hover:text-gray-200 hover:bg-dark-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden lg:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </header>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)}>
          <nav
            className="absolute left-0 top-0 h-full w-64 bg-dark-200 border-r border-white/5 p-4 pt-16"
            onClick={(e) => e.stopPropagation()}
          >
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium ${
                    isActive
                      ? "bg-accent/20 text-accent-light"
                      : "text-gray-400 hover:text-gray-200 hover:bg-dark-300"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      )}
    </>
  );
}