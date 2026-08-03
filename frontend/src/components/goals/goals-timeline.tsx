import { format, parseISO, differenceInDays } from "date-fns";

const GOALS = [
  {
    week: 21,
    label: "Media Maratón",
    subtitle: "Objetivo: 5:00 min/km",
    date: "2026-09-20",
    icon: "🏃",
  },
  {
    week: 24,
    label: "Carrera 10K",
    subtitle: "Mejorar velocidad",
    date: "2026-10-11",
    icon: "⚡",
  },
  {
    week: 49,
    label: "Ironman 70.3 Valencia",
    subtitle: "Domingo 18 de abril de 2027",
    date: "2027-04-18",
    icon: "🏅",
  },
];

export function GoalsTimeline() {
  const today = new Date();

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">Objetivos</h1>
      <div className="relative">
        <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-dark-400" />
        <div className="space-y-8">
          {GOALS.map((goal, i) => {
            const goalDate = parseISO(goal.date);
            const daysRemaining = differenceInDays(goalDate, today);
            const isPast = daysRemaining < 0;
            const progress = isPast
              ? 100
              : Math.min(Math.max(0, 100 - daysRemaining / 30 * 100), 100);

            return (
              <div
                key={goal.week}
                className={`relative flex flex-col md:flex-row ${
                  i % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                } items-start md:items-center gap-4`}
              >
                <div className="absolute left-4 md:left-1/2 w-8 h-8 rounded-full bg-dark-200 border-2 border-accent flex items-center justify-center text-lg z-10">
                  {goal.icon}
                </div>
                <div className="ml-14 md:ml-0 md:w-1/2">
                  <div className="card p-5 card-hover">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-accent-light uppercase tracking-wider">
                        Semana {goal.week}
                      </span>
                      <span
                        className={`text-xs font-medium ${
                          isPast ? "text-green-400" : "text-gray-400"
                        }`}
                      >
                        {isPast ? "Completado" : `${daysRemaining} días restantes`}
                      </span>
                    </div>
                    <h3 className="text-xl font-bold mb-1">{goal.label}</h3>
                    <p className="text-sm text-gray-400 mb-3">{goal.subtitle}</p>
                    <div className="progress-bar">
                      <div
                        className="progress-fill"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: isPast ? "#4ade80" : "#818cf8",
                        }}
                      />
                    </div>
                    <div className="text-xs text-gray-500 mt-1">{Math.round(progress)}% completado</div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}