import { Inter } from "next/font/google";
import type { PropsWithChildren } from "react";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const PageLayout = (props: PropsWithChildren) => {
  return (
    <main className={`flex h-screen justify-center ${inter.className}`}>
      <div className="flex h-full w-full flex-col border-x border-slate-400 md:max-w-2xl">
        {props.children}
      </div>
    </main>
  );
};
