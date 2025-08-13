import "@/styles/globals.css";

import type { Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "@/trpc/react";
import IdleLogout from "@/components/IdleLogout";

export const metadata: Metadata = {
	title: "PromptCrafter Chat",
	description: "AI chat for crafting and enhancing prompts",
	icons: [{ rel: "icon", url: "/favicon.ico" }],
};

const geist = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className={`${geist.variable} dark`}>
			<body className="bg-gray-950 text-gray-100">
				<IdleLogout />
				<TRPCReactProvider>{children}</TRPCReactProvider>
			</body>
		</html>
	);
}
