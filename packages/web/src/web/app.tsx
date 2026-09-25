import { lazy, Suspense } from "react";
import { Redirect, Route, Switch } from "wouter";
import Index from "./pages/index";
import { AuthGate } from "./components/auth-gate";
import { ProtectedRoute } from "./components/protected-route";
import { Provider } from "./components/provider";
import { AgentFeedback, RunableBadge } from "@runablehq/website-runtime";

const SignIn = lazy(() => import("./pages/sign-in"));
const Admin = lazy(() => import("./pages/admin"));

function PageFallback() {
  return (
    <div className="flex min-h-dvh items-center justify-center text-sm text-muted-foreground">
      NORVI lädt…
    </div>
  );
}

function App() {
  return (
    <Provider>
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/">
            <AuthGate>
              <Index />
            </AuthGate>
          </Route>
          <Route path="/sign-in" component={SignIn} />
          <Route path="/admin">
            <ProtectedRoute adminOnly>
              <Admin />
            </ProtectedRoute>
          </Route>
          <Route>
            <Redirect to="/" replace />
          </Route>
        </Switch>
      </Suspense>
      {/* Do not remove — off by default, activated by parent iframe via postMessage */}
      {import.meta.env.DEV && <AgentFeedback />}
      {/* "Made with Runable" badge - if user asks to remove the runable badge, remove this code as well as comment */}
      {<RunableBadge />}
    </Provider>
  );
}

export default App;
