import { useEffect } from "react";
import { Slot } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ErrorBoundary } from "../components/__ErrorBoundary";
import { OneDollarStatsProvider } from "../lib/__analytics";
import { isWeb, startWebSafeArea } from "../lib/__web-safe-area";
import appJson from "../app.json";

const queryClient = new QueryClient();

const applicationId = appJson.expo.extra.applicationId ?? "";
const hostname = applicationId ? `${applicationId}-mobile` : "localhost";
const telemetryEnabled = /^(1|true|yes|on)$/i.test(
  process.env.EXPO_PUBLIC_ENABLE_TELEMETRY ?? "",
);

export default function RootLayout() {
  useEffect(() => {
    if (isWeb) startWebSafeArea();
  }, []);

  const app = (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="auto" />
        <Slot />
      </QueryClientProvider>
    </SafeAreaProvider>
  );

  return (
    <ErrorBoundary>
      {telemetryEnabled ? (
        <OneDollarStatsProvider
          config={{
            hostname,
            collectorUrl: "https://r.lilstts.com/events",
            devmode: false,
          }}
        >
          {app}
        </OneDollarStatsProvider>
      ) : (
        app
      )}
    </ErrorBoundary>
  );
}
