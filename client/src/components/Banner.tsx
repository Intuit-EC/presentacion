import React, { useEffect, useMemo, useState } from "react";
import { ArrowRight, MessageCircle } from "lucide-react";
import { useCMS, type HomeHero } from "@/hooks/useCMS";
import { getResponsiveImageSrcSet, toPublicImageUrl } from "@/lib/media";
import { DEFAULT_COMPANY } from "@/lib/site";
import "./banner.css";

const FIXED_BANNER = {
  mobileImage: "/assets/banner_collage_mobile.webp",
  desktopImage: "/assets/banner_collage_desktop.webp",
  title: "Sorprende hoy. Nosotros lo entregamos por ti.",
  subtitle: "Historias reales de alegria en Guayaquil",
  cta: "Más vendidos",
  href: "/#catalogo",
};

type BannerImage = {
  url: string;
  desktopUrl?: string;
  alt: string;
};

interface BannerProps {
  onProductsClick?: () => void;
}

function normalizeHeroImages(hero?: HomeHero | null): BannerImage[] {
  const rawImages = Array.isArray(hero?.images) ? hero?.images : [];

  return rawImages
    .map((image, index) => {
      if (typeof image === "string") {
        return {
          url: toPublicImageUrl(image),
          alt: `${hero?.title || FIXED_BANNER.title} - imagen ${index + 1}`,
        };
      }

      const url = toPublicImageUrl(image?.url || "");
      return {
        url,
        alt: image?.alt || `${hero?.title || FIXED_BANNER.title} - imagen ${index + 1}`,
      };
    })
    .filter((image) => image.url);
}

export function Banner({ onProductsClick }: BannerProps) {
  const { data: hero } = useCMS();
  const cmsImages = useMemo(() => normalizeHeroImages(hero), [hero]);
  const fallbackImages = useMemo<BannerImage[]>(
    () => [
      {
        url: FIXED_BANNER.mobileImage,
        desktopUrl: FIXED_BANNER.desktopImage,
        alt: `Floreria DIFIORI - ${FIXED_BANNER.title}`,
      },
    ],
    [],
  );
  const carouselImages = (cmsImages.length > 0 ? cmsImages : fallbackImages).slice(0, 3);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mountedImageIndexes, setMountedImageIndexes] = useState<ReadonlySet<number>>(() => new Set([0]));
  const title = hero?.title?.trim() || FIXED_BANNER.title;
  const subtitle = hero?.description?.trim() || FIXED_BANNER.subtitle;

  useEffect(() => {
    setActiveIndex(0);
    setMountedImageIndexes(new Set([0]));
  }, [carouselImages.length]);

  useEffect(() => {
    setMountedImageIndexes((current) => {
      if (current.has(activeIndex)) return current;
      const next = new Set(current);
      next.add(activeIndex);
      return next;
    });
  }, [activeIndex]);

  useEffect(() => {
    if (carouselImages.length < 2) return;

    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % carouselImages.length);
    }, 5500);

    return () => window.clearInterval(timer);
  }, [carouselImages.length]);

  return (
    <section className="hero-banner">
      <div className="hero-banner-stage">
        <div className="hero-banner-carousel" aria-hidden={false}>
          {carouselImages.map((image, index) => {
            if (!mountedImageIndexes.has(index)) return null;

            const isActive = index === activeIndex;
            const srcSet = getResponsiveImageSrcSet(image.url, [768, 1024, 1440, 1920]);
            const desktopSrcSet = image.desktopUrl
              ? getResponsiveImageSrcSet(image.desktopUrl, [768, 1024, 1440, 1920])
              : undefined;

            return (
              <picture
                key={`${image.url}-${index}`}
                className={`hero-banner-image ${isActive ? "hero-banner-image-active" : ""}`}
              >
                {image.desktopUrl ? (
                  <source
                    media="(min-width: 768px)"
                    srcSet={desktopSrcSet || image.desktopUrl}
                    sizes="100vw"
                  />
                ) : null}
                <img
                  src={image.url}
                  srcSet={srcSet}
                  alt={image.alt}
                  width={1600}
                  height={900}
                  loading={index === 0 ? "eager" : "lazy"}
                  decoding="async"
                  fetchPriority={index === 0 ? "high" : "low"}
                  sizes="100vw"
                />
              </picture>
            );
          })}
        </div>

        <div className="hero-banner-overlay hero-banner-overlay-soft" />
        <div className="hero-banner-overlay hero-banner-overlay-gradient" />
        <div className="hero-banner-overlay hero-banner-overlay-desktop" />

        {carouselImages.length > 1 ? (
          <div className="hero-banner-dots" aria-label="Imagenes del carrusel">
            {carouselImages.map((image, index) => (
              <button
                key={`${image.url}-dot`}
                type="button"
                aria-label={`Ver imagen ${index + 1}`}
                aria-current={index === activeIndex}
                className="hero-banner-dot"
                onClick={() => setActiveIndex(index)}
              />
            ))}
          </div>
        ) : null}

        <div className="hero-banner-content-wrap">
          <div className="hero-banner-content-padding">
            <div className="hero-banner-content">
              <div className="hero-banner-kicker">
                DIFIORI Guayaquil
              </div>
              <h2 className="hero-banner-title">
                {title}
              </h2>
              <p className="hero-banner-subtitle">
                {subtitle}
              </p>

              <div className="hero-banner-actions">
                <button
                  type="button"
                  onClick={onProductsClick || (() => { window.location.href = FIXED_BANNER.href; })}
                  className="hero-banner-btn hero-banner-btn-primary"
                >
                  {FIXED_BANNER.cta}
                  <ArrowRight className="h-4 w-4" />
                </button>

                <a
                  href={`https://wa.me/${DEFAULT_COMPANY.phoneDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hero-banner-btn hero-banner-btn-whatsapp"
                >
                  <MessageCircle className="h-5 w-5 sm:h-6 sm:w-6" />
                  WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
