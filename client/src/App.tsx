import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { PasswordProvider, usePassword } from "./contexts/PasswordContext";
import Home from "./pages/Home";
import Products from "./pages/Products";
import ProductDetail from "./pages/ProductDetail";
import CrawlerManager from "./pages/CrawlerManager";
import Notifications from "./pages/Notifications";
import SettingsPage from "./pages/Settings";
import DashboardLayout from "./components/DashboardLayout";
import PasswordGate from "./pages/PasswordGate";

function ProtectedRouter() {
  const { isVerified } = usePassword();

  if (!isVerified) {
    return <PasswordGate />;
  }

  return (
    <DashboardLayout>
      <Switch>
        <Route path="/" component={Home} />
        <Route path="/products" component={Products} />
        <Route path="/products/:id" component={ProductDetail} />
        <Route path="/crawler" component={CrawlerManager} />
        <Route path="/notifications" component={Notifications} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <PasswordProvider>
          <TooltipProvider>
            <Toaster richColors theme="dark" />
            <ProtectedRouter />
          </TooltipProvider>
        </PasswordProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
