import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import { HomePage, MBOPage, HFTPage, MLModelsPage, PerformancePage } from "@/pages";

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-dark-bg">
        <nav className="w-48 bg-dark-panel border-r border-dark-border flex flex-col py-4">
          <div className="px-4 py-3 mb-4 border-b border-dark-border">
            <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Trading Platform
            </div>
          </div>

          <NavLink
            to="/"
            className={({ isActive }) =>
              `px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-dark-hover text-slate-200 border-l-2 border-slate-400"
                  : "text-slate-400 hover:bg-dark-hover hover:text-slate-300"
              }`
            }
            title="Home"
          >
            Dashboard
          </NavLink>

          <div className="my-2 px-4">
            <div className="h-px bg-dark-border" />
          </div>

          <NavLink
            to="/mbo"
            className={({ isActive }) =>
              `px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-dark-hover text-slate-200 border-l-2 border-slate-400"
                  : "text-slate-400 hover:bg-dark-hover hover:text-slate-300"
              }`
            }
            title="MBO - Market By Order"
          >
            Market By Order
          </NavLink>

          <NavLink
            to="/hft"
            className={({ isActive }) =>
              `px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-dark-hover text-slate-200 border-l-2 border-slate-400"
                  : "text-slate-400 hover:bg-dark-hover hover:text-slate-300"
              }`
            }
            title="HFT - High-Frequency Trading"
          >
            High-Frequency Trading
          </NavLink>

          <NavLink
            to="/ml-models"
            className={({ isActive }) =>
              `px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-dark-hover text-slate-200 border-l-2 border-slate-400"
                  : "text-slate-400 hover:bg-dark-hover hover:text-slate-300"
              }`
            }
            title="ML Models"
          >
            ML Models
          </NavLink>

          <NavLink
            to="/performance"
            className={({ isActive }) =>
              `px-4 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-dark-hover text-slate-200 border-l-2 border-slate-400"
                  : "text-slate-400 hover:bg-dark-hover hover:text-slate-300"
              }`
            }
            title="Performance & Testing"
          >
            Performance & Testing
          </NavLink>

          <div className="mt-auto px-4 py-3 border-t border-dark-border">
            <div className="text-[10px] text-slate-600 font-mono">v1.0.0</div>
          </div>
        </nav>

        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/mbo" element={<MBOPage />} />
            <Route path="/hft" element={<HFTPage />} />
            <Route path="/ml-models" element={<MLModelsPage />} />
            <Route path="/performance" element={<PerformancePage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
