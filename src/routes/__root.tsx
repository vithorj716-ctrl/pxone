import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { EmpresaProvider } from "@/px-core/empresa-context";
import { SystemProvider } from "@/px-platform/system-context";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0b0f1a" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "PXOne" },
      { title: "PXOne — Sistema Operacional Corporativo do Grupo PX" },
      {
        name: "description",
        content:
          "Plataforma de inteligência corporativa do Grupo PX: indicadores executivos, valuation, payback, governança e decisão estratégica para PXLog, PXMed e PXFarma.",
      },
      { name: "author", content: "Grupo PX" },
      { property: "og:title", content: "PXOne — Sistema Operacional Corporativo do Grupo PX" },
      {
        property: "og:description",
        content:
          "Inteligência consolidada do Grupo PX. Executive Command Center, Business Plan, Valuation, Payback e governança societária.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:title", content: "PXOne — Sistema Operacional Corporativo do Grupo PX" },
      { name: "description", content: "Joyful Tests is a web application for creating and managing tests." },
      { property: "og:description", content: "Joyful Tests is a web application for creating and managing tests." },
      { name: "twitter:description", content: "Joyful Tests is a web application for creating and managing tests." },
      { property: "og:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/VxPT82q3qRdTjrzYPMXj21iynmg1/social-images/social-1782064526172-ChatGPT_Image_21_de_jun._de_2026,_14_53_17.webp" },
      { name: "twitter:image", content: "https://storage.googleapis.com/gpt-engineer-file-uploads/VxPT82q3qRdTjrzYPMXj21iynmg1/social-images/social-1782064526172-ChatGPT_Image_21_de_jun._de_2026,_14_53_17.webp" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600;700&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    if (typeof window === "undefined") return;
    import("@/integrations/supabase/client").then(({ supabase }) => {
      const { data } = supabase.auth.onAuthStateChange((event) => {
        if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      });
      return () => data.subscription.unsubscribe();
    });
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <SystemProvider>
        <EmpresaProvider>
          <Outlet />
          <Toaster theme="dark" position="top-right" />
        </EmpresaProvider>
      </SystemProvider>
    </QueryClientProvider>
  );
}
