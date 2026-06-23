"use client";

interface DeleteConfirmButtonProps {
  message?: string;
  label?: string;
  className?: string;
}

export function DeleteConfirmButton({
  message = "削除してよろしいですか？",
  label = "削除する",
  className = "rounded-xl border border-red-200 px-4 py-2 text-sm text-red-600 hover:bg-red-50",
}: DeleteConfirmButtonProps) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {label}
    </button>
  );
}
