import { BriefcaseBusiness, Code2 } from 'lucide-react'

const SOCIAL_LINKS = [
  {
    label: 'GitHub',
    href: 'https://github.com/AlexLeontovych',
    icon: Code2
  },
  {
    label: 'LinkedIn',
    href: 'https://www.linkedin.com/in/alexleontovych/',
    icon: BriefcaseBusiness
  }
] as const

/**
 * Renders the site author footer with external profile links.
 *
 * @returns A compact branded footer.
 *
 * @example
 * <SiteFooter />
 */
const SiteFooter = () => (
  <footer className="ui-site-footer" aria-label="Site author links">
    <div className="ui-site-footer__glow" aria-hidden="true" />
    <div className="ui-site-footer__content">
      <p className="ui-site-footer__credit">
        Created by <strong>Oleksandr Leontovych</strong> 2026
      </p>

      <div className="ui-site-footer__links" aria-label="Social links">
        {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
          <a
            key={label}
            className="ui-site-footer__link"
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label={`Open ${label} profile`}
          >
            <Icon size={15} />
            <span>{label}</span>
          </a>
        ))}
      </div>
    </div>
  </footer>
)

export default SiteFooter
