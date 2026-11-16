import { Clapperboard, Film, Gamepad2, Globe, MoonStar, Newspaper, Palette, PartyPopper, Sparkles, Wrench, type LucideProps } from "lucide-react";

const map = { Sparkles, Clapperboard, Newspaper, Wrench, Film, Gamepad2, Globe2: Globe, MoonStar, PartyPopper, Palette } as const;

export function CategoryIcon({ name, ...props }: { name: string } & LucideProps) {
  const Icon = (map as Record<string, typeof Sparkles>)[name] ?? Sparkles;
  return <Icon {...props} />;
}
