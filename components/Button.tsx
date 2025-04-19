import type { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: "primary" | "secondary" | "outline";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
}

export default function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  className = "",
  disabled = false,
  ...props
}: ButtonProps) {
  const baseStyles = "rounded font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2";
  
  // Add cursor-pointer only when not disabled
  const cursorStyles = disabled ? "" : "cursor-pointer";
  
  // Add opacity when disabled
  const opacityStyles = disabled ? "opacity-50" : "";
  
  const variantStyles = {
    primary: "bg-black text-white hover:bg-gray-800 focus:ring-black",
    secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300 focus:ring-gray-500",
    outline: "bg-transparent text-gray-800 border border-gray-300 hover:bg-gray-100 focus:ring-gray-500",
  };
  
  const sizeStyles = {
    sm: "px-3 py-1 text-sm",
    md: "px-4 py-2",
    lg: "px-6 py-3 text-lg",
  };
  
  const widthStyles = fullWidth ? "w-full" : "";
  
  const buttonStyles = `${baseStyles} ${cursorStyles} ${opacityStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${widthStyles} ${className}`;
  
  return (
    <button type="button" className={buttonStyles} disabled={disabled} {...props}>
      {children}
    </button>
  );
} 