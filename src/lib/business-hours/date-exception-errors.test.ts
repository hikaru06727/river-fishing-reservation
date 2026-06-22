import { describe, expect, it, vi } from "vitest";
import {
  DATE_EXCEPTION_DUPLICATE_MESSAGE,
  DATE_EXCEPTION_SAVE_FAILED_MESSAGE,
  mapDateExceptionMutationError,
} from "./date-exception-errors";

describe("mapDateExceptionMutationError", () => {
  it("unique violation (code 23505) を日本語メッセージに変換する", () => {
    const error = Object.assign(
      new Error(
        'duplicate key value violates unique constraint "location_date_exceptions_location_id_exception_date_key"',
      ),
      { code: "23505" },
    );

    const result = mapDateExceptionMutationError(error, "create");

    expect(result).toEqual({
      error: DATE_EXCEPTION_DUPLICATE_MESSAGE,
      status: 409,
    });
  });

  it("constraint 名のみでも duplicate key を日本語メッセージに変換する", () => {
    const error = new Error(
      'duplicate key value violates unique constraint "location_date_exceptions_location_id_exception_date_key"',
    );

    const result = mapDateExceptionMutationError(error, "update");

    expect(result.error).toBe(DATE_EXCEPTION_DUPLICATE_MESSAGE);
    expect(result.status).toBe(409);
  });

  it("想定外エラー時に汎用日本語メッセージを返す", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = mapDateExceptionMutationError(new Error("connection failed"), "create");

    expect(result).toEqual({
      error: DATE_EXCEPTION_SAVE_FAILED_MESSAGE,
      status: 500,
    });
    expect(consoleSpy).toHaveBeenCalled();

    consoleSpy.mockRestore();
  });
});
