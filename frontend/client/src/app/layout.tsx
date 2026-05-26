"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "react-hot-toast";
import { useState } from "react";
import Navbar from "@/components/Navbar";
import "./globals.css";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );
 return (
    <html lang="en">
      <head>
        <title>ATS Platform</title>
        <meta
          name="description"
          content="Applicant Tracking System - Find and hire the best talent"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-screen flex flex-col bg-cover bg-center bg-fixed"
        style={{ backgroundImage: `url('/bk2.jpg')` }}
      >
        <QueryClientProvider client={queryClient}>
          <div className="flex flex-col min-h-screen backdrop-blur-xl bg-black/20">
            <Navbar />
            <main className="flex-1">{children}</main>
            <footer className="bg-black/20 backdrop-blur-xl border-t border-white/10 shadow-lg text-white/70 py-8 mt-auto">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-sm">
                <p>
                  &copy; {new Date().getFullYear()} ATS Platform. All rights
                  reserved.
                </p>
              </div>
            </footer>
          </div>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: "#363636",
                color: "#fff",
              },
              success: {
                style: {
                  background: "#059669",
                },
              },
              error: {
                style: {
                  background: "#dc2626",
                },
              },
            }}
          />
        </QueryClientProvider>
      </body>
    </html>
  );
}