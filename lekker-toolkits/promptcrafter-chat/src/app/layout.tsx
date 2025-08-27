import "@/styles/globals.css";
// Local Font Awesome CSS (installed via @fortawesome/fontawesome-free for offline use)
// Using tree-shaken SVG Font Awesome via react component; no global CSS import needed.

import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";

export const metadata: Metadata = {
	title: "PromptCrafter",
	description: "PromptCrafter – AI assistant for building and enhancing prompts",
	icons: [{ rel: "icon", url: "public/branding/favicon.ico" }],
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={`${geist.variable} dark`}>
					<head>{/* No external CDN links to allow full offline operation */}</head>
			<body className="bg-gray-950 text-gray-100">
				<TRPCReactProvider>{children}</TRPCReactProvider>
			</body>
		</html>
	);
}
