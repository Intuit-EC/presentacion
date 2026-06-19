import React from "react";
import { cn } from "@/lib/utils";
import { useCompany } from "@/hooks/useCompany";
import { toPublicImageUrl } from "@/lib/media";

interface LogoProps {
  className?: string;
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
  useCompanyData?: boolean;
}

export function Logo({
  className,
  variant = "light",
  size = "md",
  useCompanyData = false,
}: LogoProps) {
  const { data: company } = useCompany(useCompanyData);
  const color = variant === "light" ? "#E6E6E6" : "#3D2852";
  const sizes = {
    sm: "h-9",
    md: "h-16",
    lg: "h-20",
  };
  const isCompactWordmark = size === "sm";

  const logoUrl = getCompanyLogoUrl(company?.logo);

  if (logoUrl) {
    return (
      <div className={cn("flex flex-col", className || "items-center", sizes[size])}>
        <img
          src={logoUrl}
          alt={company?.name || "Logo del negocio"}
          className="h-full w-auto max-w-full object-contain"
          loading="eager"
        />
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col", className || "items-center", sizes[size])}>
      <svg
        viewBox={isCompactWordmark ? "0 0 420 56" : "0 0 420 86"}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-auto max-w-full overflow-visible"
      >
        <text
          x="210"
          y={isCompactWordmark ? "40" : "44"}
          textAnchor="middle"
          fill={color}
          style={{
            fontFamily: "Montserrat, sans-serif",
            fontWeight: 800,
            fontSize: isCompactWordmark ? "42px" : "52px",
            letterSpacing: isCompactWordmark ? "0.08em" : "0.12em",
          }}
        >
          DIFIORI
        </text>

        {isCompactWordmark ? null : (
          <text
            x="210"
            y="70"
            textAnchor="middle"
            fill={variant === "light" ? "#666666" : "#0D0717"}
            style={{
              fontFamily: "Montserrat, sans-serif",
              fontWeight: 700,
              fontSize: "18px",
              letterSpacing: "0.18em",
              opacity: 1,
            }}
          >
            FLORES • REGALOS • EVENTOS
          </text>
        )}
      </svg>
    </div>
  );
}

function getCompanyLogoUrl(logoPath?: string | null) {
  const url = toPublicImageUrl(logoPath);
  return url || null;
}
