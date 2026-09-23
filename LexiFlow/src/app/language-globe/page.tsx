import type { Metadata } from "next"
import { MonochromeLanguageGlobe } from "@/components/language-globe/monochrome-language-globe"

export const metadata: Metadata = {
  title: "Monochrome Particle Language Globe",
  description: "Words Create A Wider You.",
}

export default function LanguageGlobePage() {
  return (
    <main style={{ width: "100%", height: "100svh", overflow: "hidden", background: "#000" }}>
      <MonochromeLanguageGlobe />
    </main>
  )
}
