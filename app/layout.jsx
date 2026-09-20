import { Suspense } from "react";
import "./globals.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import AdminNotifier from "../components/AdminNotifier";
import NavigationProgressBar from "../components/NavigationProgressBar";
import { ThemeProvider } from "../components/ThemeProvider";
import { ToastProvider } from "../components/Toast";
import { AuthDrawerProvider } from "../components/AuthDrawer";
import BackToTop from "../components/BackToTop";

export const metadata = {
  title: "Shotzi – A soft place for loud feelings",
  description:
    "A visual social platform centered around sharing moments, places, tiny details, campus life, sunsets, streets, objects, and random beautiful things.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,100..1000;1,9..40,100..1000&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen bg-bg text-ink font-sans antialiased selection:bg-accent/20 selection:text-ink overflow-x-hidden">
        <Suspense fallback={null}>
          <NavigationProgressBar />
        </Suspense>
        <ThemeProvider>
          <ToastProvider>
            <AuthDrawerProvider>
              <div className="relative min-h-screen flex flex-col overflow-x-hidden">
                <Navbar />
                {/* Admin moderation notifier (for admin user) */}
                <AdminNotifier />
                <main className="flex-1 w-full max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-8">
                  {children}
                </main>
                <Footer />
                <BackToTop />
              </div>
            </AuthDrawerProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
