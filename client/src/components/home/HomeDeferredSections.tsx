import React from "react";
import { Star, Instagram, Facebook, Music2, Mail, MessageSquare, Phone } from "lucide-react";
import { cn } from "@/lib/utils";
import { FAQS } from "@/data/mock";
import { useCompany } from "@/hooks/useCompany";
import { useReviews, useCreateReview } from "@/hooks/useReviews";
import { DEFAULT_COMPANY } from "@/lib/site";
import "./home-deferred.css";

export function HomeDeferredSections() {
  const { data: dbReviews = [], isLoading: isLoadingReviews } = useReviews(true);
  const createReviewMutation = useCreateReview();
  const { data: company } = useCompany(true);
  const [newReview, setNewReview] = React.useState({ name: "", content: "", stars: 5 });
  const [showForm, setShowForm] = React.useState(false);
  const [reviewMessage, setReviewMessage] = React.useState("");

  const handleAddReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setReviewMessage("");
    if (!newReview.name || !newReview.content) return;

    try {
      await createReviewMutation.mutateAsync(newReview);
      setNewReview({ name: "", content: "", stars: 5 });
      setShowForm(false);
      setReviewMessage("Gracias por compartir tu experiencia.");
    } catch (err) {
      console.error("Error al enviar la resena:", err);
      setReviewMessage("No pudimos guardar tu resena. Intentalo nuevamente.");
    }
  };

  const companyPhoneDisplay = company?.phone || DEFAULT_COMPANY.phoneDisplay;
  const companyPhoneDigits = companyPhoneDisplay.replace(/[^0-9]/g, "") || DEFAULT_COMPANY.phoneDigits;
  const companyEmail = company?.email || DEFAULT_COMPANY.email;

  return (
    <>
      <section
        id="testimonios"
        className="deferred-section home-testimonials"
      >
        <div className="home-testimonials-accent" />

        <div className="home-deferred-heading">
          <h2 className="section-title">Lo que dicen quienes eligieron DIFIORI</h2>
          <p className="section-copy">Compras seguras, entregas puntuales y detalles que dejan una impresión duradera.</p>
        </div>
        <div className="home-deferred-action">
          <button type="button" onClick={() => setShowForm(!showForm)} className="ui-btn-primary">
            {showForm ? "Cerrar Formulario" : "Escribir una resena"}
          </button>
        </div>

        {showForm ? (
          <div className="home-review-form-wrap">
            <form onSubmit={handleAddReview} className="surface-card home-review-form">
              <div className="home-review-stars">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNewReview({ ...newReview, stars: star })}
                    className="transition-transform hover:scale-125"
                  >
                    <Star
                      className={cn("h-8 w-8", star <= newReview.stars ? "fill-accent text-accent" : "text-primary/20")}
                    />
                  </button>
                ))}
              </div>
              <input
                placeholder="Tu nombre"
                value={newReview.name}
                onChange={(e) => setNewReview({ ...newReview, name: e.target.value })}
                className="w-full rounded-2xl border border-primary/10 bg-primary/5 p-4 font-bold text-foreground outline-none placeholder:text-foreground/20 focus:border-accent"
                required
              />
              <textarea
                placeholder="Cuentanos tu experiencia..."
                value={newReview.content}
                onChange={(e) => setNewReview({ ...newReview, content: e.target.value })}
                className="h-32 w-full rounded-2xl border border-primary/10 bg-primary/5 p-4 font-medium text-foreground outline-none placeholder:text-foreground/20 focus:border-accent"
                required
              />
              <button type="submit" disabled={createReviewMutation.isPending} className="ui-btn-primary w-full">
                {createReviewMutation.isPending ? "Publicando..." : "Publicar Resena"}
              </button>
            </form>
          </div>
        ) : null}

        {reviewMessage ? (
          <p className="home-review-message">
            {reviewMessage}
          </p>
        ) : null}

        <div className="home-review-grid">
          {isLoadingReviews ? (
            <div className="home-review-loading">Cargando experiencias...</div>
          ) : dbReviews.length > 0 ? (
            dbReviews.map((review, i) => (
              <div
                key={review.id || i}
                className="surface-card home-review-card"
              >
                <div className="home-review-card-stars">
                  {[...Array(review.stars)].map((_, s) => (
                    <Star key={s} className="h-5 w-5 fill-accent text-accent" />
                  ))}
                </div>
                <p
                  className="mb-8 text-[1.7rem] font-black leading-relaxed text-[#4B1F6F]"
                  style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}
                >
                  "{review.content}"
                </p>
                <div className="home-review-card-meta">
                  <div className="home-review-avatar">
                    {review.name[0]}
                  </div>
                  <div>
                    <h4
                      className="text-[1.2rem] font-black uppercase tracking-[0.14em] text-[#4B1F6F]"
                      style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}
                    >
                      {review.name}
                    </h4>
                    <span
                      className="text-[1rem] font-black uppercase tracking-[0.12em] text-[#4B1F6F]"
                      style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}
                    >
                      {review.role || "Cliente"}
                    </span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="home-review-empty">
              Aun no hay resenas. Se el primero en compartir tu experiencia.
            </div>
          )}
        </div>
      </section>

      <section id="faq" className="deferred-section home-faq">
        <div className="home-deferred-heading home-faq-heading">
          <h2
            className="home-faq-title"
            style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}
          >
            Preguntas frecuentes
          </h2>
          <p
            className="home-faq-copy"
            style={{ fontFamily: "Arial, sans-serif" }}
          >
            Informacion clave sobre entregas, pagos y tiempos de atencion.
          </p>
        </div>

        <div className="home-faq-grid">
          {FAQS.map((faq) => (
            <article key={faq.question} className="surface-card home-faq-card">
              <h3
                className="home-faq-card-title"
                style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}
              >
                {faq.question}
              </h3>
              <p
                className="home-faq-card-copy"
                style={{ fontFamily: "Arial, sans-serif" }}
              >
                {faq.answer}
              </p>
            </article>
          ))}
        </div>
      </section>

      <footer id="contacto" className="deferred-section home-footer">
        <div className="home-footer-container">
          <div className="home-footer-grid">
            <div className="home-footer-brand">
              <img src="/logo-footer.png" alt="DIFIORI" className="home-footer-logo" loading="lazy" />
              <p
                className="home-footer-brand-copy"
                style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}
              >
                Disenando emociones con las flores mas frescas de exportacion en Guayaquil.
              </p>
              <div className="home-footer-socials">
                {[Instagram, Facebook, Music2].map((Icon, i) => (
                  <div
                    key={i}
                    className="home-footer-social"
                  >
                    <Icon className="h-7 w-7" />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h4
                className="home-footer-title"
                style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}
              >
                La Maison
              </h4>
              <ul className="home-footer-links" style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}>
                <li className="home-footer-link">Tienda</li>
                <li className="home-footer-link">Contacto</li>
                <li className="home-footer-link">Preguntas Frecuentes</li>
                <li className="home-footer-link">Terminos y Condiciones</li>
              </ul>
            </div>

            <div>
              <h4
                className="home-footer-title"
                style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}
              >
                Soporte
              </h4>
              <ul className="home-footer-links" style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}>
                <li className="home-footer-link">Envios y Entregas</li>
                <li className="home-footer-link">Cuidado de Flores</li>
                <li className="home-footer-link">Politica de Privacidad</li>
                <li className="home-footer-link">FAQs Soporte</li>
              </ul>
            </div>

            <div>
              <h4
                className="home-footer-title"
                style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}
              >
                Contacto Directo
              </h4>
              <div className="home-footer-contact-list">
                <div className="home-footer-contact-group">
                  <div className="home-footer-contact-icon">
                    <MessageSquare className="h-6 w-6 text-accent transition-colors duration-500 group-hover:text-white" />
                  </div>
                  <div
                    className="home-footer-contact-copy"
                    style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}
                  >
                    <span className="home-footer-contact-label">WhatsApp</span>
                    <a href={`https://wa.me/${companyPhoneDigits}`} className="home-footer-contact-link">
                      {companyPhoneDisplay}
                    </a>
                  </div>
                </div>
                <div className="home-footer-contact-group">
                  <div className="home-footer-contact-icon">
                    <Phone className="h-6 w-6 text-accent transition-colors duration-500 group-hover:text-white" />
                  </div>
                  <div
                    className="home-footer-contact-copy"
                    style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}
                  >
                    <span className="home-footer-contact-label">Llamadas</span>
                    <span className="home-footer-contact-link">{companyPhoneDisplay}</span>
                  </div>
                </div>
                <div className="home-footer-contact-group">
                  <div className="home-footer-contact-icon">
                    <Mail className="h-6 w-6 text-accent transition-colors duration-500 group-hover:text-white" />
                  </div>
                  <div
                    className="home-footer-contact-copy"
                    style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}
                  >
                    <span className="home-footer-contact-label">Email</span>
                    <span className="home-footer-contact-link home-footer-email">{companyEmail}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="home-footer-bottom">
            <p
              className="home-footer-bottom-copy"
              style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}
            >
              © 2026 DIFIORI Ecuador. Todos los derechos reservados.
            </p>
            <div
              className="home-footer-bottom-meta"
              style={{ fontFamily: '"Arial Black", Arial, sans-serif' }}
            >
              <span className="home-footer-bottom-link">Guayaquil, Ecuador</span>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
