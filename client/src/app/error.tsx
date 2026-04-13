"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-1 min-h-0 items-center justify-center p-6 bg-gray-50 dark:bg-gray-950">
      <div className="max-w-md rounded-xl border border-red-200 dark:border-red-900/60 bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Something went wrong</h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {error.message || "An unexpected error occurred."}
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="text-sm font-medium px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
