interface SectionHeadingProps {
  title: string;
  subtitle?: string;
}

export default function SectionHeading({ title, subtitle }: SectionHeadingProps) {
  return (
    <div className="mb-6">
      <h2 className="text-xl font-bold text-navy sm:text-2xl">{title}</h2>
      {subtitle && <p className="mt-2 text-navy-muted">{subtitle}</p>}
    </div>
  );
}
