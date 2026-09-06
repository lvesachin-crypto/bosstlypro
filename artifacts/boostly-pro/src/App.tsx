import { useEffect, lazy, Suspense, useRef } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation, useNavigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { CurrencyProvider } from "@/hooks/useCurrency";
import { ScrollToTop } from "@/components/ScrollToTop";
import { toast } from "sonner";
import { AppErrorBoundary } from "@/components/app/AppErrorBoundary";
import { Loader2 } from "lucide-react";

import { ClerkProvider, SignIn, SignUp, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY
);

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env file");
}

const clerkAppearance = {
  theme: shadcn,
  variables: {
    colorPrimary: "hsl(221 83% 53%)",
    colorForeground: "hsl(0 0% 8%)",
    colorMutedForeground: "hsl(220 9% 40%)",
    colorDanger: "hsl(358 72% 52%)",
    colorBackground: "hsl(0 0% 100%)",
    colorInput: "hsl(0 0% 100%)",
    colorInputForeground: "hsl(0 0% 8%)",
    colorNeutral: "hsl(220 13% 89%)",
    fontFamily: "Inter, system-ui, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-white rounded-2xl w-[440px] max-w-full overflow-hidden",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-bold",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground font-medium",
    formFieldLabel: "text-muted-foreground font-semibold",
    footerActionLink: "text-primary font-semibold hover:text-primary/90",
    footerActionText: "text-muted-foreground",
    dividerText: "text-muted-foreground text-sm",
    identityPreviewEditButton: "text-primary hover:text-primary/90",
    formFieldSuccessText: "text-success",
    alertText: "text-destructive",
  },
};


function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function ClerkProviderWithRoutes({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => navigate(to)}
      routerReplace={(to) => navigate(to, { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      {children}
    </ClerkProvider>
  );
}

// Landing eager (LCP) — everything else lazy for smaller initial bundle
import Index from "./pages/Index";

const SmmPanelUsa = lazy(() => import("./pages/SmmPanelUsa"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Auth = lazy(() => import("./pages/Auth"));
const Dashboard = lazy(() => import("./pages/CoreDashboard"));
const Orders = lazy(() => import("./pages/CoreOrders"));
const Wallet = lazy(() => import("./pages/CoreWallet"));
const Settings = lazy(() => import("./pages/CoreSettings"));
const Support = lazy(() => import("./pages/CoreSupport"));
const Maintenance = lazy(() => import("./pages/Maintenance"));

// 🔧 Maintenance mode toggle — set to false to bring the site back online
const MAINTENANCE_MODE = false;

const TermsOfService = lazy(() => import("./pages/legal/TermsOfService"));
const PrivacyPolicy = lazy(() => import("./pages/legal/PrivacyPolicy"));
const RefundPolicy = lazy(() => import("./pages/legal/RefundPolicy"));
const CookiePolicy = lazy(() => import("./pages/legal/CookiePolicy"));
const ContactUs = lazy(() => import("./pages/legal/ContactUs"));
const AboutUs = lazy(() => import("./pages/legal/AboutUs"));
const ShippingPolicy = lazy(() => import("./pages/legal/ShippingPolicy"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 15 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchOnMount: false,
      retry: 2,
      retryDelay: (i) => Math.min(1000 * 2 ** i, 10000),
    },
    mutations: {
      retry: 1,
      retryDelay: 1000,
    },
  },
});

const PageFallback = () => (
  <div className="min-h-screen flex items-center justify-center">
    <Loader2 className="w-8 h-8 animate-spin text-primary" />
  </div>
);

const AppRoutes = () => {
  const location = useLocation();
  const allowThroughMaintenance =
    location.pathname === "/auth" ||
    location.pathname.startsWith("/sign-in") ||
    location.pathname.startsWith("/sign-up");

  if (MAINTENANCE_MODE && !allowThroughMaintenance) {
    return (
      <Routes>
        <Route path="/auth" element={<Auth />} />
        <Route path="/sign-in/*" element={<Auth />} />
        <Route path="/sign-up/*" element={<Auth />} />
        <Route path="*" element={<Maintenance />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/sign-in/*" element={<Auth />} />
      <Route path="/sign-up/*" element={<Auth />} />
      
      {/* Keep the old /auth route as an alias to sign-in or let the Auth component redirect? The auth component probably can redirect if we want. But the instructions say "preserve all existing routes" so we'll leave it in. */}
      <Route path="/auth" element={<Auth />} />

      {/* User pages */}
      <Route path="/" element={<Index />} />
      <Route path="/smm-panel-usa" element={<SmmPanelUsa />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/orders" element={<Orders />} />
      <Route path="/wallet" element={<Wallet />} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/support" element={<Support />} />

      {/* Legal */}
      <Route path="/terms" element={<TermsOfService />} />
      <Route path="/privacy" element={<PrivacyPolicy />} />
      <Route path="/refund" element={<RefundPolicy />} />
      <Route path="/cookies" element={<CookiePolicy />} />
      <Route path="/contact" element={<ContactUs />} />
      <Route path="/about" element={<AboutUs />} />
      <Route path="/shipping" element={<ShippingPolicy />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => {
  useEffect(() => {
    const handleRejection = (e: PromiseRejectionEvent) => {
      console.error("Unhandled rejection:", e.reason);
      toast.error("An error occurred. Please try again.");
      e.preventDefault();
    };
    const handleError = (e: ErrorEvent) => {
      console.error("Unhandled error:", e.error || e.message);
    };
    window.addEventListener("unhandledrejection", handleRejection);
    window.addEventListener("error", handleError);
    return () => {
      window.removeEventListener("unhandledrejection", handleRejection);
      window.removeEventListener("error", handleError);
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename={basePath}>
        <ClerkProviderWithRoutes>
          <AuthProvider>
            <CurrencyProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <AppErrorBoundary>
                  <ScrollToTop />
                  <Suspense fallback={<PageFallback />}>
                    <AppRoutes />
                  </Suspense>
                </AppErrorBoundary>
              </TooltipProvider>
            </CurrencyProvider>
          </AuthProvider>
        </ClerkProviderWithRoutes>
      </BrowserRouter>
    </QueryClientProvider>
  );
};

export default App;
