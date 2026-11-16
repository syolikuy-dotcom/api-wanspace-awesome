import { Reveal } from "@/components/reveal";
import { SplitText } from "@/components/split-text";

export function SectionHeading({ label, title, description }: { label: string; title: string; description?: string }) {
  return (
    <div className="max-w-2xl">
      <Reveal>
        <p className="label">{label}</p>
      </Reveal>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
        <SplitText text={title} />
      </h2>
      {description && (
        <Reveal delay={0.1}>
          <p className="mt-4 text-sm leading-relaxed text-muted sm:text-base">{description}</p>
        </Reveal>
      )}
    </div>
  );
}
