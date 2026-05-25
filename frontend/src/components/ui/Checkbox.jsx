import { forwardRef } from "react";

export const Checkbox = forwardRef(function Checkbox({ label, className = "", ...props }, ref) {
  return (
    <label className={`flex items-center gap-2.5 cursor-pointer group ${className}`}>
      <input
        ref={ref}
        type="checkbox"
        className="w-4 h-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500 cursor-pointer"
        {...props}
      />
      <span className="text-sm text-gray-700 group-hover:text-gray-900 select-none">{label}</span>
    </label>
  );
});
