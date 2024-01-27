import { type AppType } from "next/app";
import { ClerkProvider } from "@clerk/nextjs";
import { api } from "@/utils/api";
import { Inter, Lora, Space_Grotesk } from "next/font/google";
import "@/styles/globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const MyApp: AppType = ({ Component, pageProps }) => {
  return (
    <ClerkProvider {...pageProps}>
      <Component {...pageProps} />
    </ClerkProvider>
  );
};

export default api.withTRPC(MyApp);
