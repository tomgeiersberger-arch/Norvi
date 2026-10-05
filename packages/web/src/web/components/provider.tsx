import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { DesktopAssistantListener } from "./desktop-assistant-listener";
import { FirstRunWizard } from "./first-run-wizard";
import { DesktopErrorLogger } from "./desktop-error-logger";

const queryClient = new QueryClient();

interface ProviderProps {
  children: React.ReactNode;
}

// App-level providers — add theme/context providers here, wrapping children.
// QueryClientProvider must stay (all API calls run through TanStack Query).
export function Provider({ children }: ProviderProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <DesktopErrorLogger />
      <DesktopAssistantListener />
      {children}
      <FirstRunWizard />
    </QueryClientProvider>
  );
}
