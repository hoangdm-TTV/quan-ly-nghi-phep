import Image from "next/image";
import Link from "next/link";

interface BrandLogoProps {
  size?: "sm" | "md" | "lg";
  subtitle?: string;
  showBadge?: boolean;
  href?: string;
  className?: string;
}

export default function BrandLogo({
  size = "md",
  subtitle = "Quản lý nghỉ phép & đơn ra ngoài",
  showBadge = true,
  href = "/",
  className = "",
}: BrandLogoProps) {
  const isSm = size === "sm";
  const isLg = size === "lg";

  const content = (
    <div className={`flex items-center gap-2.5 sm:gap-3 ${className}`}>
      {/* Logo square box with rounded corners and subtle shadow/border */}
      <div
        className={`relative bg-white rounded-xl sm:rounded-2xl border border-slate-200/90 shadow-xs flex items-center justify-center shrink-0 overflow-hidden ${
          isSm
            ? "w-10 h-10 p-1 rounded-lg"
            : isLg
              ? "w-14 h-14 sm:w-16 sm:h-16 p-2 rounded-2xl"
              : "w-11 h-11 sm:w-12 sm:h-12 p-1.5"
        }`}
      >
        <Image
          src="/logo.png"
          alt="Tri Thức Việt"
          width={isLg ? 64 : isSm ? 40 : 48}
          height={isLg ? 64 : isSm ? 40 : 48}
          className="w-full h-full object-contain"
          priority
        />
      </div>

      {/* Brand Name & Subtitle */}
      <div className="flex flex-col min-w-0">
        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
          <span
            className={`font-black tracking-tight leading-none text-[#005a3c] ${
              isSm
                ? "text-sm"
                : isLg
                  ? "text-xl sm:text-2xl"
                  : "text-base sm:text-lg"
            }`}
          >
            TRI THỨC
          </span>
          <span
            className={`font-black tracking-tight leading-none text-[#991b1b] ${
              isSm
                ? "text-sm"
                : isLg
                  ? "text-xl sm:text-2xl"
                  : "text-base sm:text-lg"
            }`}
          >
            VIỆT
          </span>
          {showBadge && (
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] sm:text-[11px] font-bold bg-[#e0f2fe] text-[#0284c7] border border-[#bae6fd] tracking-wide leading-none">
              NỘI BỘ
            </span>
          )}
        </div>
        {subtitle && (
          <p
            className={`text-slate-500 font-normal leading-normal truncate mt-0.5 sm:mt-1 ${
              isSm ? "text-[10px]" : isLg ? "text-sm" : "text-xs sm:text-[13px]"
            }`}
          >
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="group hover:opacity-90 transition-opacity">
        {content}
      </Link>
    );
  }

  return content;
}
