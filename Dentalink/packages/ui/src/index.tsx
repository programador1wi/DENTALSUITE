export type ButtonVariant = "primary" | "secondary" | "danger";

export type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  const variantClass = variant === "primary" ? "button" : variant === "danger" ? "danger-button" : "secondary-button";
  return <button className={[variantClass, className].filter(Boolean).join(" ")} {...props} />;
}
