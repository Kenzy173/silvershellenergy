export function SiteMark({ className = "", imgClassName = "" }: { className?: string; imgClassName?: string }) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/images/silvershell-logo-sm.png"
        alt="Silvershell Energy"
        width={640}
        height={196}
        className={imgClassName || "h-8 w-auto"}
      />
    </span>
  );
}
