import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import { Home, TrendingUp, Zap, Brain } from "lucide-react";
import { HomePage, MBOPage, HFTPage, MLModelsPage } from "@/pages";

/**
 * Order Flow Pro — Main Application
 *
 * A comprehensive trading platform with:
 * - MBO (Market By Order) analysis
 * - HFT (High-Frequency Trading) strategies
 * - ML model integration for production systems
 *
 * Built with React 18, Vite 5, TypeScript, and Tailwind CSS
 */

function App() {
  return (
    <Router>
      <div className="flex h-screen bg-dark-bg">
        {/* Sidebar Navigation */}
        <nav className="w-16 bg-dark-panel border-r border-dark-border flex flex-col items-center py-4 gap-2">
          <NavLink
            to="/"
            className={({ isActive }) =>
              `w-12 h-12 flex items-center justify-center rounded-lg transition-all ${
                isActive
                  ? "bg-emerald-500 text-white"
                  : "text-slate-400 hover:bg-dark-hover hover:text-white"
              }`
            }
            title="Home"
          >
            <Home className="w-5 h-5" />
          </NavLink>

          <div className="w-10 h-px bg-dark-border my-2" />

          <NavLink
            to="/mbo"
            className={({ isActive }) =>
              `w-12 h-12 flex items-center justify-center rounded-lg transition-all ${
                isActive
                  ? "bg-emerald-500 text-white"
                  : "text-slate-400 hover:bg-dark-hover hover:text-white"
              }`
            }
            title="MBO - Market By Order"
          >
            <TrendingUp className="w-5 h-5" />
          </NavLink>

          <NavLink
            to="/hft"
            className={({ isActive }) =>
              `w-12 h-12 flex items-center justify-center rounded-lg transition-all ${
                isActive
                  ? "bg-yellow-500 text-white"
                  : "text-slate-400 hover:bg-dark-hover hover:text-white"
              }`
            }
            title="HFT - High-Frequency Trading"
          >
            <Zap className="w-5 h-5" />
          </NavLink>

          <NavLink
            to="/ml-models"
            className={({ isActive }) =>
              `w-12 h-12 flex items-center justify-center rounded-lg transition-all ${
                isActive
                  ? "bg-purple-500 text-white"
                  : "text-slate-400 hover:bg-dark-hover hover:text-white"
              }`
            }
            title="ML Models"
          >
            <Brain className="w-5 h-5" />
          </NavLink>

          {/* Version Badge */}
          <div className="mt-auto text-[10px] text-slate-600 font-mono">v1.0</div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/mbo" element={<MBOPage />} />
            <Route path="/hft" element={<HFTPage />} />
            <Route path="/ml-models" element={<MLModelsPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
