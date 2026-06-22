type PostgresErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

export const DATE_EXCEPTION_UNIQUE_CONSTRAINT =
  "fishing_spot_date_exceptions_fishing_spot_id_exception_date_key";

export function getPostgresErrorLike(error: unknown): PostgresErrorLike | null {
  if (error instanceof Error) {
    const enriched = error as Error & PostgresErrorLike;
    return {
      message: enriched.message,
      code: enriched.code,
      details: enriched.details,
      hint: enriched.hint,
    };
  }

  if (error && typeof error === "object" && "message" in error) {
    const record = error as PostgresErrorLike;
    if (typeof record.message === "string") {
      return record;
    }
  }

  return null;
}

export function isUniqueViolation(
  error: unknown,
  constraintName?: string,
): boolean {
  const pg = getPostgresErrorLike(error);
  if (!pg?.message) {
    return false;
  }

  const matchesConstraint = constraintName
    ? pg.message.includes(constraintName)
    : true;

  if (pg.code === "23505" && matchesConstraint) {
    return true;
  }

  return pg.message.includes("duplicate key") && matchesConstraint;
}

export function logPostgresError(context: string, error: unknown): void {
  const pg = getPostgresErrorLike(error);
  if (!pg) {
    console.error(`[${context}]`, error);
    return;
  }

  console.error(`[${context}]`, {
    message: pg.message,
    code: pg.code,
    details: pg.details,
    hint: pg.hint,
  });
}

export function throwSupabaseMutationError(error: {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}): never {
  const err = new Error(error.message) as Error & PostgresErrorLike;
  err.code = error.code;
  err.details = error.details ?? undefined;
  err.hint = error.hint ?? undefined;
  throw err;
}
