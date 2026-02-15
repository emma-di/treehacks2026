import type { Metadata } from "next";
import "./globals.css";
import { LayoutWithHospitalLoading } from "./components/LayoutWithHospitalLoading";

export const metadata: Metadata = {
  title: "Atria",
  description: "Atria Hospital Patient/Room Allocator & Scheduler",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <LayoutWithHospitalLoading>{children}</LayoutWithHospitalLoading>
      </body>
    </html>
  );
}
