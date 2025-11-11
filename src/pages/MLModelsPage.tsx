import { useState } from "react";
import { Cpu, Brain, Shield, TrendingUp, Settings, Sparkles } from "lucide-react";
import { Panel, Section, Button } from "@/components";
import { runModel, modelConfigs } from "@/ml-models/registry";
import { MLInput, MLOutput } from "@/types";

/**
 * ML Models Dashboard Page
 *
 * Features:
 * - 6 pre-configured ML model UIs
 * - Interactive parameter inputs
 * - Real-time model execution
 * - Output visualization
 * - Model metadata and guardrails
 */

const categoryIcons: Record<string, React.ReactNode> = {
  capacity: <TrendingUp className="w-5 h-5" />,
  performance: <Sparkles className="w-5 h-5" />,
  risk: <Shield className="w-5 h-5" />,
  detection: <Brain className="w-5 h-5" />,
  tuning: <Settings className="w-5 h-5" />,
  optimization: <Cpu className="w-5 h-5" />,
};

const categoryColors: Record<string, string> = {
  capacity: "text-blue-400 border-blue-400",
  performance: "text-purple-400 border-purple-400",
  risk: "text-red-400 border-red-400",
  detection: "text-emerald-400 border-emerald-400",
  tuning: "text-amber-400 border-amber-400",
  optimization: "text-cyan-400 border-cyan-400",
};

interface ModelState {
  inputs: MLInput;
  output: MLOutput | null;
  loading: boolean;
  error: string | null;
}

export function MLModelsPage() {
  const [selectedModel, setSelectedModel] = useState<string>("capacityPlanning");
  const [modelStates, setModelStates] = useState<Record<string, ModelState>>(() => {
    const states: Record<string, ModelState> = {};
    Object.keys(modelConfigs).forEach((modelId) => {
      const config = modelConfigs[modelId];
      const defaultInputs: MLInput = {};
      config.inputs.forEach((input) => {
        defaultInputs[input.key] = input.default;
      });
      states[modelId] = {
        inputs: defaultInputs,
        output: null,
        loading: false,
        error: null,
      };
    });
    return states;
  });

  const currentConfig = modelConfigs[selectedModel];
  const currentState = modelStates[selectedModel];

  const handleInputChange = (modelId: string, key: string, value: number) => {
    setModelStates((prev) => ({
      ...prev,
      [modelId]: {
        ...prev[modelId],
        inputs: {
          ...prev[modelId].inputs,
          [key]: value,
        },
      },
    }));
  };

  const handleRunModel = async (modelId: string) => {
    setModelStates((prev) => ({
      ...prev,
      [modelId]: { ...prev[modelId], loading: true, error: null },
    }));

    try {
      const output = await runModel(modelId, modelStates[modelId].inputs);
      setModelStates((prev) => ({
        ...prev,
        [modelId]: { ...prev[modelId], output, loading: false },
      }));
    } catch (error) {
      setModelStates((prev) => ({
        ...prev,
        [modelId]: {
          ...prev[modelId],
          error: error instanceof Error ? error.message : "Unknown error",
          loading: false,
        },
      }));
    }
  };

  const handleResetModel = (modelId: string) => {
    const config = modelConfigs[modelId];
    const defaultInputs: MLInput = {};
    config.inputs.forEach((input) => {
      defaultInputs[input.key] = input.default;
    });

    setModelStates((prev) => ({
      ...prev,
      [modelId]: {
        inputs: defaultInputs,
        output: null,
        loading: false,
        error: null,
      },
    }));
  };

  return (
    <div className="min-h-screen bg-dark-bg text-zinc-200 flex flex-col">
      {/* Top Bar */}
      <div className="flex items-center justify-between px-5 py-3 bg-dark-panel border-b border-dark-border">
        <div className="flex items-center gap-2">
          <Brain className="w-6 h-6 text-purple-400" />
          <div className="text-white font-extrabold text-lg">ML Models Dashboard</div>
        </div>
        <div className="text-xs text-slate-400">
          {Object.keys(modelConfigs).length} Models Available
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 xl:grid-cols-[280px_1fr] gap-px bg-dark-border flex-1 min-h-0">
        {/* Left Sidebar - Model List */}
        <Panel>
          <Section title="Model Selection">
            <div className="flex flex-col gap-2">
              {Object.values(modelConfigs).map((config) => (
                <div
                  key={config.id}
                  onClick={() => setSelectedModel(config.id)}
                  className={`p-3 rounded cursor-pointer transition-all border-l-4 ${
                    selectedModel === config.id
                      ? `${categoryColors[config.category]} bg-white/5`
                      : "border-transparent bg-dark-bg hover:bg-dark-hover"
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    {categoryIcons[config.category]}
                    <span className="font-semibold text-sm">{config.name}</span>
                  </div>
                  <div className="text-[10px] text-slate-400 uppercase tracking-wide">
                    {config.category}
                  </div>
                </div>
              ))}
            </div>
          </Section>

          <Section title="Legend">
            <div className="space-y-2 text-[11px]">
              {Object.entries(categoryIcons).map(([category, icon]) => (
                <div key={category} className="flex items-center gap-2">
                  <div className={categoryColors[category]}>{icon}</div>
                  <span className="capitalize">{category}</span>
                </div>
              ))}
            </div>
          </Section>
        </Panel>

        {/* Right Panel - Model Details */}
        <Panel>
          {currentConfig && (
            <>
              {/* Model Header */}
              <div className="m-3 p-4 rounded-lg border border-dark-border bg-dark-panel">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={categoryColors[currentConfig.category]}>
                        {categoryIcons[currentConfig.category]}
                      </div>
                      <h2 className="text-xl font-bold">{currentConfig.name}</h2>
                    </div>
                    <p className="text-sm text-slate-300 mb-3">{currentConfig.description}</p>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-2 py-1 rounded text-[10px] bg-blue-500/20 text-blue-400 border border-blue-500/30">
                        {currentConfig.category.toUpperCase()}
                      </span>
                      {currentConfig.guardrails && currentConfig.guardrails.length > 0 && (
                        <span className="px-2 py-1 rounded text-[10px] bg-amber-500/20 text-amber-400 border border-amber-500/30">
                          {currentConfig.guardrails.length} GUARDRAILS
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Use Cases */}
              <Section title="Use Cases">
                <div className="grid grid-cols-2 gap-2">
                  {currentConfig.useCases.map((useCase, idx) => (
                    <div
                      key={idx}
                      className="p-2 rounded bg-dark-bg border border-dark-border text-xs"
                    >
                      {useCase}
                    </div>
                  ))}
                </div>
              </Section>

              {/* Input Parameters */}
              <Section
                title="Input Parameters"
                action={
                  <Button
                    size="sm"
                    variant="dark"
                    onClick={() => handleResetModel(selectedModel)}
                  >
                    Reset
                  </Button>
                }
              >
                <div className="space-y-4">
                  {currentConfig.inputs.map((input) => (
                    <div key={input.key} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm font-semibold">{input.label}</label>
                        <span className="text-sm text-emerald-400 font-mono">
                          {currentState.inputs[input.key]}
                        </span>
                      </div>
                      {input.type === "slider" && (
                        <input
                          type="range"
                          min={input.min}
                          max={input.max}
                          step={input.step}
                          value={currentState.inputs[input.key]}
                          onChange={(e) =>
                            handleInputChange(selectedModel, input.key, Number(e.target.value))
                          }
                          className="w-full"
                        />
                      )}
                      {input.type === "number" && (
                        <input
                          type="number"
                          min={input.min}
                          max={input.max}
                          step={input.step}
                          value={currentState.inputs[input.key]}
                          onChange={(e) =>
                            handleInputChange(selectedModel, input.key, Number(e.target.value))
                          }
                          className="w-full px-3 py-2 bg-dark-bg border border-dark-border rounded text-sm"
                        />
                      )}
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <Button
                    variant="primary"
                    onClick={() => handleRunModel(selectedModel)}
                    disabled={currentState.loading}
                    icon={<Cpu className="w-4 h-4" />}
                    className="w-full"
                  >
                    {currentState.loading ? "Running Model..." : "Run Model"}
                  </Button>
                </div>
              </Section>

              {/* Output */}
              <Section title="Model Output">
                {currentState.error && (
                  <div className="p-4 rounded bg-red-500/10 border border-red-500/30 text-red-400">
                    <div className="font-semibold mb-1">Error</div>
                    <div className="text-sm">{currentState.error}</div>
                  </div>
                )}

                {!currentState.output && !currentState.error && !currentState.loading && (
                  <div className="text-center text-slate-400 py-8">
                    Run the model to see output
                  </div>
                )}

                {currentState.loading && (
                  <div className="text-center text-slate-400 py-8">
                    <Cpu className="w-8 h-8 mx-auto mb-2 animate-spin" />
                    <div>Running model...</div>
                  </div>
                )}

                {currentState.output && !currentState.error && (
                  <div className="space-y-3">
                    {Object.entries(currentState.output).map(([key, value]) => (
                      <div
                        key={key}
                        className="p-3 rounded bg-dark-bg border border-dark-border"
                      >
                        <div className="text-[11px] uppercase text-slate-400 mb-1">
                          {currentConfig.outputLabels[key] || key}
                        </div>
                        <div className="font-mono text-lg font-bold text-emerald-400">
                          {typeof value === "number" ? value.toFixed(3) : value}
                        </div>
                      </div>
                    ))}

                    {/* JSON View */}
                    <details className="mt-4">
                      <summary className="cursor-pointer text-sm text-slate-400 hover:text-slate-300">
                        View Raw JSON
                      </summary>
                      <pre className="mt-2 p-3 rounded bg-dark-bg border border-dark-border text-xs overflow-auto">
                        {JSON.stringify(currentState.output, null, 2)}
                      </pre>
                    </details>
                  </div>
                )}
              </Section>

              {/* Guardrails */}
              {currentConfig.guardrails && currentConfig.guardrails.length > 0 && (
                <Section title="Guardrails">
                  <div className="space-y-2">
                    {currentConfig.guardrails.map((guardrail, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 p-2 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs"
                      >
                        <Shield className="w-4 h-4" />
                        <span>{guardrail}</span>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Model Info */}
              <Section title="Model Information">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded bg-dark-bg">
                    <div className="text-slate-400 mb-1">Model ID</div>
                    <div className="font-mono">{currentConfig.id}</div>
                  </div>
                  <div className="p-3 rounded bg-dark-bg">
                    <div className="text-slate-400 mb-1">Category</div>
                    <div className="capitalize">{currentConfig.category}</div>
                  </div>
                  <div className="p-3 rounded bg-dark-bg">
                    <div className="text-slate-400 mb-1">Input Parameters</div>
                    <div>{currentConfig.inputs.length}</div>
                  </div>
                  <div className="p-3 rounded bg-dark-bg">
                    <div className="text-slate-400 mb-1">Output Fields</div>
                    <div>{Object.keys(currentConfig.outputLabels).length}</div>
                  </div>
                </div>
              </Section>
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}
