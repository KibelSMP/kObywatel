// Renders a monochrome UI icon from /icns_ui via a CSS mask so it inherits
// currentColor (themes + hover states for free). Decorative by default
// (aria-hidden); pass a `label` to expose it to assistive tech.

export default function Icon({ name, size = 20, className = '', label }) {
  const style = {
    '--icon': `url(/icns_ui/${name}.svg)`,
    width: size,
    height: size,
  };
  return (
    <span
      className={`ui-icon ${className}`}
      style={style}
      role={label ? 'img' : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
    />
  );
}
