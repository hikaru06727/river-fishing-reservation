import {
  DATE_EXCEPTION_UNIQUE_CONSTRAINT,
  isUniqueViolation,
  logPostgresError,
} from "@/lib/db/postgres-error";

const DATE_EXCEPTION_DUPLICATE_MESSAGE =
  "この日付の例外日はすでに登録されています。既存の設定を編集してください。";

const DATE_EXCEPTION_SAVE_FAILED_MESSAGE =
  "例外日の保存に失敗しました。入力内容を確認してもう一度お試しください。";

const DATE_EXCEPTION_DELETE_FAILED_MESSAGE =
  "例外日の削除に失敗しました。もう一度お試しください。";

type DateExceptionMutationOperation = "create" | "update" | "delete";

export function mapDateExceptionMutationError(
  error: unknown,
  operation: DateExceptionMutationOperation,
): { error: string; status: number } {
  logPostgresError(`business-hours.date-exception.${operation}`, error);

  if (
    (operation === "create" || operation === "update") &&
    isUniqueViolation(error, DATE_EXCEPTION_UNIQUE_CONSTRAINT)
  ) {
    return { error: DATE_EXCEPTION_DUPLICATE_MESSAGE, status: 409 };
  }

  if (operation === "delete") {
    return { error: DATE_EXCEPTION_DELETE_FAILED_MESSAGE, status: 500 };
  }

  return { error: DATE_EXCEPTION_SAVE_FAILED_MESSAGE, status: 500 };
}

export {
  DATE_EXCEPTION_DUPLICATE_MESSAGE,
  DATE_EXCEPTION_SAVE_FAILED_MESSAGE,
};
