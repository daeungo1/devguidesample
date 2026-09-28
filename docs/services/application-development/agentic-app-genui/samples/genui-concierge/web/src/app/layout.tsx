import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@copilotkit/react-core/v2/styles.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Contoso 디바이스 컨시어지 · Generative UI 데모",
  description: "Controlled, Declarative, MCP Apps and Fully Open generative UI on Azure OpenAI GPT-5.6.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
