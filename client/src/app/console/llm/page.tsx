import { ConsoleBackToOverview } from "@/components/console/console-back-to-overview";
import { LlmConfigurationPanel } from "@/components/settings/llm-configuration-panel";

export default function ConsoleLlmPage() {
  return (
    <div className="flex-1 overflow-y-auto min-h-0 p-6 sm:p-10">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">
        <header className="flex flex-wrap items-center gap-2">
          <ConsoleBackToOverview className="self-center" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white m-0">LLM configuration</h1>
        </header>
        <LlmConfigurationPanel />
      </div>
    </div>
  );
}