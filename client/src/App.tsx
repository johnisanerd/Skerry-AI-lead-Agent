import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { RouterProvider } from "@tanstack/react-router";
import { getRouter } from "./router";
import { BrandProvider } from "./contexts/BrandContext";

const router = getRouter();

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" switchable>
        <BrandProvider>
          <TooltipProvider>
            <Toaster />
            <RouterProvider router={router} />
          </TooltipProvider>
        </BrandProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
